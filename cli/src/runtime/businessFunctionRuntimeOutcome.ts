import { describeMissingAbility, findMissingAbility, inferTaskAbilities } from "../capabilities/abilities";
import { getClientTerms } from "../clients/clientStore";
import { refuseWorkUnderChecks } from "../business/functionChecks";
import { refuseTaskWithoutWork } from "../work/workLocks";
import { listStaffingAssignments } from "../staffing/staffingStore";
import { getWorker } from "../control/workers";
import { renderEnterprisePrompt, buildEnterpriseRepairPrompt } from "../prompts/enterprisePrompt";
import {
  attachBusinessFunctionJob,
  getBusinessFunction,
  listBusinessFunctions,
  refineBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import {
  canCreateFollowUpTask,
  describeFollowUpLimitReached,
  mayGrowFollowOnWork,
} from "./followUpChain";
import { carriedTaskArgs } from "../task/carriedTaskArgs";
import { createLoggedProviderCaller, recordProviderSend } from "./providerSendLog";
import { finishNextAction, claimNextAction, recordNextAction } from "./nextActions";
import type {
  BusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";
import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";
import {
  getBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByRuntimeId,
} from "../business/businessFunctionDefinitionStore";
import {
  isWorkerCapability,
  type WorkerCapability,
} from "../control/workers";
import {
  extractJsonObjectSubstring,
  resolveNextStepModel,
} from "../guidance/nextStepAdvisor";
import {
  generateWithPaidEscalation,
} from "../llm/llmClient";
import { canUsePaidEscalation } from "../llm/modelRouting";
import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";
import {
  addOperationalMemory,
} from "../memory/operationalMemoryStore";
import {
  appendRuntimeEventToStore,
  listRuntimeEventStore,
} from "./runtimeEventStore";
import {
  getJob,
  type Job,
} from "./jobQueue";
import { UNVERIFIED_MODEL_OUTPUT_PREFIX } from "./taskExecutor";

export type RuntimeOutcomeAssessment = {
  readonly health: "healthy" | "monitoring" | "degraded" | "critical";
  readonly objectiveProgress: string;
  readonly lesson: string;
  readonly shouldCreateFollowUpJob: boolean;
  readonly followUpTask?: string;
  readonly requiredCapabilities: readonly WorkerCapability[];
};

export type RuntimeOutcomeReasoner = (
  definition: BusinessFunctionDefinition,
  runtime: BusinessFunctionRuntime,
  job: Job
) => Promise<RuntimeOutcomeAssessment>;

const measuringJobIds =
  new Set<string>();

export function parseRuntimeOutcomeAssessment(
  value: string
): RuntimeOutcomeAssessment {
  // llama3.2 routinely writes a sentence after the closing brace, which
  // JSON.parse rejects with "Unexpected non-whitespace character after JSON".
  // The staffing planner already extracts the outermost object rather than
  // trusting the model to return nothing else; this does the same.
  const parsed = JSON.parse(
    extractJsonObjectSubstring(value)
  ) as Record<string, unknown>;
  const healthValues = [
    "healthy",
    "monitoring",
    "degraded",
    "critical",
  ] as const;

  // Each field is checked on its own so the message names what is wrong.
  //
  // "Runtime outcome assessment is incomplete" told the repair prompt nothing
  // it could act on, and the repair is the whole recovery path: the validation
  // error is fed straight back to the model. A local model given a six-field
  // schema and no indication of which field it missed simply misses it again.
  if (!healthValues.includes(parsed.health as never)) {
    throw new Error(
      `Runtime outcome health must be one of ${healthValues.join(", ")}.`
    );
  }

  if (typeof parsed.objectiveProgress !== "string" || !parsed.objectiveProgress.trim()) {
    throw new Error("Runtime outcome objectiveProgress must be a non-empty string.");
  }

  if (typeof parsed.lesson !== "string" || !parsed.lesson.trim()) {
    throw new Error("Runtime outcome lesson must be a non-empty string.");
  }

  if (typeof parsed.shouldCreateFollowUpJob !== "boolean") {
    throw new Error("Runtime outcome shouldCreateFollowUpJob must be true or false.");
  }

  const followUpTask =
    typeof parsed.followUpTask === "string"
      ? parsed.followUpTask.trim()
      : undefined;

  if (parsed.shouldCreateFollowUpJob && !followUpTask) {
    throw new Error("Runtime follow-up task is required.");
  }

  return {
    health: parsed.health as RuntimeOutcomeAssessment["health"],
    objectiveProgress: parsed.objectiveProgress.trim(),
    lesson: parsed.lesson.trim(),
    shouldCreateFollowUpJob: parsed.shouldCreateFollowUpJob,
    followUpTask,
    requiredCapabilities: Array.isArray(parsed.requiredCapabilities)
      ? parsed.requiredCapabilities.filter(
          (capability): capability is WorkerCapability =>
            typeof capability === "string" &&
            isWorkerCapability(capability)
        )
      : [],
  };
}

/** What the assessment is told in place of the result, which it never reads (C1). */
export const OUTCOME_WITHHELD =
  "(not shown: Arturo never sends a finished Task's result to this assessment. Judge only from the task and how it ended.)";

/** Uses the configured model to measure progress and choose any follow-up. */
export async function reasonAboutRuntimeJobOutcome(
  definition: BusinessFunctionDefinition,
  runtime: BusinessFunctionRuntime,
  job: Job
): Promise<RuntimeOutcomeAssessment> {
  const model = resolveNextStepModel();
  const prompt = renderEnterprisePrompt("Task Outcome Assessment", {
    FUNCTION_NAME: definition.label,
    FUNCTION_OBJECTIVE: runtime.objective,
    SUCCESS_CRITERIA: definition.successCriteria.join(", ") || "(none declared)",
    REFINEMENTS: runtime.refinements.join(" | ") || "(none)",
    TASK: job.task,
    TASK_STATUS: job.status,
    // No model reading a result's text creates work (C1), so the result is
    // never sent here: the assessment sees what was asked and how it ended.
    OUTCOME: OUTCOME_WITHHELD,
  });
  // Every call is stored in the provider send log before it is made.
  const callModel = createLoggedProviderCaller(job, "outcome-assessment");
  const result = await callModel({
    model,
    prompt,
  });

  // Three repairs, the allowance the staffing planner and the signal evaluator
  // both give their structured output. One was not enough: a local model
  // complies with a schema intermittently, and every failure here is a Function
  // silently declining to carry the work on.
  const REPAIR_ATTEMPTS = 3;
  let latest = result;
  let lastError: unknown;

  for (let attempt = 0; attempt <= REPAIR_ATTEMPTS; attempt += 1) {
    try {
      return parseRuntimeOutcomeAssessment(latest.response);
    } catch (error) {
      lastError = error;
      if (attempt === REPAIR_ATTEMPTS) break;
      latest = await callModel({
        model,
        prompt: buildEnterpriseRepairPrompt(prompt, latest.response, error instanceof Error ? error.message : String(error)),
      });
    }
  }

  if (!canUsePaidEscalation()) throw lastError;

  recordProviderSend(job, "outcome-assessment", REPAIR_ATTEMPTS + 2);
  const escalated = await generateWithPaidEscalation({
    reason: "repeated-structured-output-failure",
    prompt: buildEnterpriseRepairPrompt(prompt, latest.response, lastError instanceof Error ? lastError.message : String(lastError)),
  });
  return parseRuntimeOutcomeAssessment(escalated.response);
}

/** The running Function a Task names, when it names one. */
function resolveRuntimeFromJobFunction(
  job: Job
): BusinessFunctionRuntime | undefined {
  if (!job.businessFunctionId) return undefined;
  const definition = getBusinessFunctionDefinition(job.businessFunctionId);
  return definition?.runtimeId
    ? getBusinessFunction(definition.runtimeId)
    : undefined;
}

/** Measures a Runtime-generated Job and feeds the lesson into future decisions. */
export async function measureRuntimeJobOutcome(
  job: Job,
  reasoner: RuntimeOutcomeReasoner = reasonAboutRuntimeJobOutcome
): Promise<RuntimeOutcomeAssessment | undefined> {
  // A Task on a named piece of work is not assessed by a model for follow-on
  // work: that would send its result where the send log does not see it, and
  // nothing continues named work automatically (work/workLocks.ts).
  if (job.workId) {
    return undefined;
  }

  // Attached work first, then the Function the Task says it belongs to.
  //
  // jobIds only ever holds Tasks the Runtime created itself, so measuring by
  // that alone meant a Task the operator typed was never assessed and could
  // never begin a chain — which is the case this exists for. A /task carries
  // businessFunctionId; jobGovernance already resolves a Function that way,
  // preferring the recorded id and falling back to a scan.
  const runtime =
    listBusinessFunctions().find(
      (candidate) => candidate.jobIds.includes(job.id)
    ) ?? resolveRuntimeFromJobFunction(job);

  if (!runtime) {
    return undefined;
  }

  const definition =
    getBusinessFunctionDefinitionByRuntimeId(runtime.id);

  if (!definition) {
    return undefined;
  }

  const alreadyMeasured = listRuntimeEventStore().some((event) => {
    if (
      event.type !== "runtime.outcome.measured" &&
      event.type !== "runtime.outcome.measurement_failed" &&
      event.type !== "runtime.outcome.measurement_skipped"
    ) {
      return false;
    }

    const payload = event.payload;
    return typeof payload === "object" &&
      payload !== null &&
      "jobId" in payload &&
      payload.jobId === job.id;
  });

  if (
    alreadyMeasured ||
    measuringJobIds.has(job.id)
  ) {
    return undefined;
  }

  if (job.status === "failed" && job.error?.startsWith("[OUTPUT_INTEGRITY]")) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.outcome.measurement_failed",
      level: "error",
      message: `Untrusted Worker output from Task ${job.id} was excluded from Function learning and follow-up work.`,
      timestamp: Date.now(),
      payload: { runtimeId: runtime.id, jobId: job.id, reason: job.error },
    });
    return undefined;
  }

  // Unverified output stops Arturo *learning*, not Arturo *continuing*.
  //
  // These were one early return, which meant an ordinary AI Task — every one
  // of which carries this prefix — taught nothing and led nowhere. Continuing
  // the work is what the operator asked for: a triage result that names the
  // confirmations it needs should produce the Task that gets them. Treating
  // that same unchecked text as a durable lesson about how the business
  // operates is a different claim, and still refused.
  const learnFromOutcome =
    !(job.status === "completed" && job.output?.startsWith(UNVERIFIED_MODEL_OUTPUT_PREFIX));

  if (!learnFromOutcome) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.outcome.measurement_skipped",
      level: "warn",
      message: `An AI model wrote the result of Task ${job.id} and nobody has checked it, so Arturo has not learned from it. It may still create follow-on work from it.`,
      timestamp: Date.now(),
      payload: { runtimeId: runtime.id, jobId: job.id, reason: "verified evidence or human acceptance required" },
    });
  }

  const mayContinue = mayGrowFollowOnWork(definition, job);

  // Nothing to learn and nothing to continue: do not ask the model at all.
  // It was asked after every Task regardless, which is a model call per Task
  // whose answer could only ever be acted on by creating unrequested work.
  if (!learnFromOutcome && !mayContinue) {
    return undefined;
  }

  measuringJobIds.add(job.id);

  try {
    const assessment = await reasoner(
      definition,
      runtime,
      job
    );

    if (learnFromOutcome) {
      refineBusinessFunction(
        runtime.id,
        assessment.lesson
      );

      const memoryEntry = addOperationalMemory({
        scopeId: runtime.id,
        content: assessment.lesson,
        source: `runtime-outcome:${job.id}`,
      });

      broadcastEvent(
        "memory.entry.added",
        "success",
        `${definition.label} retained lesson: ${memoryEntry.content}`
      );
    }

    let followUpJob: Job | undefined;
    // A chain that has run its length stops here, and says so. Silence would
    // be indistinguishable from the model deciding nothing more was needed,
    // and those are different facts about the business.
    if (
      assessment.shouldCreateFollowUpJob &&
      assessment.followUpTask &&
      !mayContinue
    ) {
      // Said rather than dropped, so the owner can see what Arturo would have
      // done and decide whether to ask for it.
      appendRuntimeEventToStore({
        id: crypto.randomUUID(),
        type: "runtime.followup.not_enabled",
        level: "info",
        message: `${definition.label} did not create follow-on work from Task ${job.id}: ${job.status === "completed" ? "follow-on work is not turned on for this Function" : "the Task did not finish"}.`,
        timestamp: Date.now(),
        payload: {
          runtimeId: runtime.id,
          jobId: job.id,
          proposedTask: assessment.followUpTask,
        },
      });
    } else if (
      assessment.shouldCreateFollowUpJob &&
      assessment.followUpTask &&
      !canCreateFollowUpTask(job)
    ) {
      appendRuntimeEventToStore({
        id: crypto.randomUUID(),
        type: "runtime.followup.limit_reached",
        level: "warn",
        message: describeFollowUpLimitReached(job),
        timestamp: Date.now(),
        payload: {
          runtimeId: runtime.id,
          jobId: job.id,
          proposedTask: assessment.followUpTask,
        },
      });
    } else if (
      assessment.shouldCreateFollowUpJob &&
      assessment.followUpTask &&
      refuseFollowUpWork(definition, assessment.followUpTask, job.inputArtefactRefs ?? [], job)
    ) {
      // The checks every other way of creating work makes: a model's
      // follow-on instruction was queued directly, so a task asking for an
      // email to be sent, or one under a business function's own checks, was
      // created without either being asked.
      appendRuntimeEventToStore({
        id: crypto.randomUUID(),
        type: "runtime.followup.refused",
        level: "warn",
        message: `${definition.label} did not create follow-on work from Task ${job.id}: ${refuseFollowUpWork(definition, assessment.followUpTask, job.inputArtefactRefs ?? [], job)}`,
        timestamp: Date.now(),
        payload: {
          runtimeId: runtime.id,
          jobId: job.id,
          proposedTask: assessment.followUpTask,
        },
      });
    } else if (
      assessment.shouldCreateFollowUpJob &&
      assessment.followUpTask
    ) {
      // Created through createTask --follows, under a claim good once for
      // this result (C1): an unsigned or set-aside source is refused there,
      // the client and the person who asked are carried, the chain counter is
      // stamped, and every check a person's Task gets is made.
      const created = await createOutcomeFollowOn(definition, job, assessment.followUpTask);
      if ("taskId" in created) {
        followUpJob = getJob(created.taskId);
        if (followUpJob?.worker) {
          broadcastEvent(
            "worker.assigned",
            "success",
            `Worker ${followUpJob.worker} assigned to Task ${followUpJob.id}`
          );
        }
        attachBusinessFunctionJob(runtime.id, created.taskId);
        broadcastEvent(
          "job.created",
          "success",
          `Function ${definition.label} created follow-up Task: ${followUpJob?.task ?? assessment.followUpTask}`
        );
      } else {
        appendRuntimeEventToStore({
          id: crypto.randomUUID(),
          type: "runtime.followup.refused",
          level: "warn",
          message: `${definition.label} did not create follow-on work from Task ${job.id}: ${created.refused}`,
          timestamp: Date.now(),
          payload: {
            runtimeId: runtime.id,
            jobId: job.id,
            proposedTask: assessment.followUpTask,
            ...(created.code ? { code: created.code } : {}),
          },
        });
      }
    }

    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.outcome.measured",
      level: assessment.health === "critical" ? "error" : "info",
      message: `${definition.label} measured Task outcome: ${assessment.objectiveProgress}`,
      timestamp: Date.now(),
      payload: {
        runtimeId: runtime.id,
        jobId: job.id,
        health: assessment.health,
        objectiveProgress: assessment.objectiveProgress,
        lesson: assessment.lesson,
        followUpJobId: followUpJob?.id,
      },
    });

    return assessment;
  } catch (error) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.outcome.measurement_failed",
      level: "error",
      message: `${definition.label} could not measure Task ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: Date.now(),
      payload: {
        runtimeId: runtime.id,
        jobId: job.id,
      },
    });
    return undefined;
  } finally {
    measuringJobIds.delete(job.id);
  }
}

/**
 * Why follow-on work a model proposed must not be created, by the same checks
 * createTask makes: something no AI Worker staffed here can do (send email,
 * change other software…; capabilities/abilities.ts), and the business
 * function's own checks (business/functionChecks.ts). Follow-on work carries
 * the finished Task's documents and continues it, so a "needs a document"
 * check is met.
 *
 * SIDE EFFECT: Reads staffing, Worker and Function-check state.
 */
export function refuseFollowUpWork(
  definition: BusinessFunctionDefinition,
  followUpTask: string,
  suppliedReferences: readonly string[],
  source?: Pick<Job, "workId" | "clientId">
): string | undefined {
  // Work on a named piece of work comes straight back to a person: nothing
  // continues it on its own, as passing on and routes are off for it.
  if (source?.workId) return "the Task belongs to a named piece of work, and work on it is never continued automatically.";
  // The rule for a law practice's Task that must belong to a typed piece of work, and the
  // refusal of anything naming a client with "no AI" work (work/workLocks.ts).
  const unbound = refuseTaskWithoutWork({
    enterpriseId: definition.enterpriseId ?? "",
    clientId: source?.clientId,
    hasDocuments: suppliedReferences.length > 0,
    instruction: followUpTask,
  });
  if (unbound) return unbound;
  const terms = getClientTerms(definition.enterpriseId ?? "");
  const staffed = listStaffingAssignments(definition.id)
    .filter((assignment) => assignment.role === "ai")
    .map((assignment) => [...(getWorker(assignment.workerName)?.capabilities ?? [])]);
  const missing = findMissingAbility(inferTaskAbilities(followUpTask, terms), staffed);
  if (missing) return describeMissingAbility(missing, terms);
  return refuseWorkUnderChecks({
    functionId: definition.id,
    functionLabel: definition.label,
    documents: suppliedReferences,
    continuesEarlierWork: true,
  });
}

/**
 * Creates the follow-on Task through createTask --follows, once per result.
 * The claim is durable (runtime/nextActions.ts), so a result measured again
 * after a restart cannot start a second follow-on. No pass-on claim is given,
 * so a result an AI model wrote is followed only once a person signed it off.
 *
 * SIDE EFFECT: May create one Task and write one next-step record.
 */
export async function createOutcomeFollowOn(
  definition: BusinessFunctionDefinition,
  source: Job,
  followUpTask: string
): Promise<{ readonly taskId: string } | { readonly refused: string; readonly code?: string }> {
  const enterpriseId = definition.enterpriseId ?? source.enterpriseId;
  if (!enterpriseId) return { refused: "the business function belongs to no business." };
  if (!recordNextAction("outcome-follow-on", source.id) || claimNextAction("outcome-follow-on", source.id) !== "claimed") {
    return { refused: "follow-on work from this result was already started once." };
  }
  try {
    const { createTask } = await import("../repl/taskRoutingCommands");
    const supplied = source.inputArtefactRefs ?? [];
    const outcome = createTask([
      followUpTask,
      "--function", definition.id,
      "--enterprise", enterpriseId,
      ...carriedTaskArgs(source),
      ...(supplied.length ? ["--input-artefact", supplied.join(",")] : []),
      "--follows", source.id,
    ]);
    if (!outcome.created || !outcome.taskId) {
      return { refused: outcome.message.split("\n")[0], ...(outcome.code ? { code: outcome.code } : {}) };
    }
    return { taskId: outcome.taskId };
  } finally {
    finishNextAction("outcome-follow-on", source.id);
  }
}
