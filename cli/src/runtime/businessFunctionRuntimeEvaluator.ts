import { renderEnterprisePrompt, buildEnterpriseRepairPrompt } from "../prompts/enterprisePrompt";
import type { BusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { attachBusinessFunctionJob, getBusinessFunction } from "../business/businessFunctionRuntimeStore";
import { getEnterpriseByIdOrName } from "../enterprise/enterpriseStore";
import { refuseTaskWithoutWork } from "../work/workLocks";
import type { OrganisationalEventInput } from "../events/organisationalEvent";
import { resolveNextStepModel } from "../guidance/nextStepAdvisor";
import { generateWithConfiguredLlm, generateWithPaidEscalation } from "../llm/llmClient";
import { canUsePaidEscalation } from "../llm/modelRouting";
import { getJob, type Job } from "./jobQueue";
import { carriedTaskArgs } from "../task/carriedTaskArgs";
import { claimNextAction, finishNextAction, recordNextAction } from "./nextActions";
import { appendRuntimeEventToStore } from "./runtimeEventStore";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import {
  isWorkerCapability,
  type WorkerCapability,
} from "../control/workers";
import {
  inferBusinessFunctionCapabilities,
} from "./businessFunctionRuntimeRouting";
import {
  canCreateFollowUpTask,
  describeFollowUpLimitReached,
} from "./followUpChain";
import {
  listOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  getArtefact,
  getArtefactVersion,
} from "../artefacts/artefactStore";

import {
  formatArtefactReference,
  parseArtefactReference,
} from "../artefacts/artefact";

export type RuntimeSignalDecision = {
  readonly shouldCreateJob: boolean;
  readonly task?: string;
  readonly reason: string;
  readonly requiredCapabilities?: readonly WorkerCapability[];
};

export type RuntimeSignalEvaluation = {
  readonly businessFunction: string;
  readonly runtimeId: string;
  readonly decision?: RuntimeSignalDecision;
  readonly job?: Job;
  readonly error?: string;
};

export type RuntimeSignalReasoner = (
  definition: BusinessFunctionDefinition,
  signal: OrganisationalEventInput
) => Promise<RuntimeSignalDecision>;

/**
 * Resolves exact Artefact references carried by a deterministic Event payload.
 *
 * Invalid, missing, or cross-Enterprise references are excluded rather than
 * being copied into a downstream Job.
 */
export function resolveSignalInputArtefactRefs(
  signal:
    OrganisationalEventInput,
  enterpriseId:
    string
): readonly string[] {
  const value =
    signal.payload
      ?.evidenceArtefacts;
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    return [];
  }

  const references:
    string[] =
    [];
  for (
    const item of
      value.split(
        ","
      )
  ) {
    try {
      const reference =
        parseArtefactReference(
          item.trim()
        );
      const artefact =
        getArtefact(
          reference.artefactId
        );
      if (
        !artefact ||
        artefact.enterpriseId !==
          enterpriseId ||
        !getArtefactVersion(
          reference
        )
      ) {
        continue;
      }
      references.push(
        formatArtefactReference(
          reference
        )
      );
    } catch {
      // Untrusted signal metadata does not become downstream Job evidence.
    }
  }

  return [
    ...new Set(
      references
    ),
  ];
}

const RUNTIME_COORDINATION_TASK_PATTERNS = [
  /\b(assign|select|choose|route|delegate|appoint|allocate|find)\b[\s\S]{0,80}\b(worker|agent|operator|reviewer)\b/i,
  /\b(worker|agent|operator|reviewer)\b[\s\S]{0,80}\b(assignment|selection|routing|delegation)\b/i,
] as const;

/** Returns true when a proposed Job incorrectly describes Runtime routing work. */
export function isRuntimeCoordinationTask(task: string): boolean {
  return RUNTIME_COORDINATION_TASK_PATTERNS.some(
    (pattern) => pattern.test(task)
  );
}

/** Ensures a Runtime decision contains Worker-executable domain work. */
export function validateRuntimeSignalDecision(
  decision: RuntimeSignalDecision
): RuntimeSignalDecision {
  if (
    decision.shouldCreateJob &&
    decision.task &&
    isRuntimeCoordinationTask(decision.task)
  ) {
    throw new Error(
      "Function decision Task must describe domain work, not assigning, selecting, routing, or delegating a Worker."
    );
  }

  return decision;
}

/** Rejects task text that embeds the Worker named by an availability signal. */
export function validateRuntimeSignalDecisionForSignal(
  decision: RuntimeSignalDecision,
  signal: OrganisationalEventInput
): RuntimeSignalDecision {
  validateRuntimeSignalDecision(decision);

  const signalledWorker = signal.payload?.worker;
  if (
    decision.shouldCreateJob &&
    decision.task &&
    typeof signalledWorker === "string" &&
    signalledWorker.trim() &&
    decision.task.toLowerCase().includes(
      signalledWorker.trim().toLowerCase()
    )
  ) {
    throw new Error(
      "Function decision Task must not name the Worker supplied by the availability signal; Arturo assigns Workers separately."
    );
  }

  return decision;
}

function stripMarkdownFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses and validates a model decision about an observed signal. */
export function parseRuntimeSignalDecision(value: string): RuntimeSignalDecision {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripMarkdownFences(value));
  } catch {
    throw new Error("Function decision was not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Function decision must be a JSON object.");
  }

  if (typeof parsed.shouldCreateJob !== "boolean") {
    throw new Error("Function decision shouldCreateJob must be a boolean.");
  }

  if (typeof parsed.reason !== "string" || parsed.reason.trim().length === 0) {
    throw new Error("Function decision reason must be a non-empty string.");
  }

  const task = typeof parsed.task === "string" ? parsed.task.trim() : undefined;

  const requiredCapabilities =
    Array.isArray(parsed.requiredCapabilities)
      ? parsed.requiredCapabilities.filter(
          (capability): capability is WorkerCapability =>
            typeof capability === "string" &&
            isWorkerCapability(capability)
        )
      : [];

  if (parsed.shouldCreateJob && !task) {
    throw new Error("Function decision Task must be a non-empty string when a Task is required.");
  }

  return validateRuntimeSignalDecision({
    shouldCreateJob: parsed.shouldCreateJob,
    task,
    reason: parsed.reason.trim(),
    requiredCapabilities,
  });
}

/** Asks the configured model whether a signal warrants work for an Objective. */
export async function reasonAboutRuntimeSignal(
  definition: BusinessFunctionDefinition,
  signal: OrganisationalEventInput
): Promise<RuntimeSignalDecision> {
  const model = resolveNextStepModel();
  const runtime = definition.runtimeId
    ? getBusinessFunction(definition.runtimeId)
    : undefined;
  const operationalMemory = definition.runtimeId
    ? listOperationalMemory(definition.runtimeId)
    : [];
  const prompt = renderEnterprisePrompt("Business Signal Assessment", {
    FUNCTION_NAME: definition.label,
    FUNCTION_OBJECTIVE: definition.objective || `Continuously pursue ${definition.label}.`,
    DECLARED_INPUTS: definition.inputs.length > 0 ? definition.inputs.join(", ") : "(none declared; assess semantically)",
    SUCCESS_CRITERIA: definition.successCriteria.length > 0 ? definition.successCriteria.join(", ") : "(none declared)",
    REFINEMENTS: runtime?.refinements.length ? runtime.refinements.join(" | ") : "(none yet)",
    OPERATIONAL_MEMORY: operationalMemory.length ? operationalMemory.map((entry) => entry.content).join(" | ") : "(none yet)",
    SIGNAL: signal.label,
    SIGNAL_SOURCE: signal.sourceBusinessFunction,
    SIGNAL_PAYLOAD: JSON.stringify(signal.payload ?? {})
  });

  // Three repair attempts, the same allowance the staffing planner gives its
  // own structured output. One was not enough: on llama3.2 this decision
  // returned unparseable JSON on roughly one run in three, and each failure
  // is a Function silently declining to react to an Event — the one moment
  // autonomy is visible. A local model complies with a schema intermittently,
  // so the number of attempts is the difference between "Arturo reacted" and
  // "Function could not check whether work was needed".
  const REPAIR_ATTEMPTS = 3;

  let result = await generateWithConfiguredLlm({
    model,
    prompt,
  });
  let lastError: unknown;

  for (let attempt = 0; attempt <= REPAIR_ATTEMPTS; attempt += 1) {
    try {
      return validateRuntimeSignalDecisionForSignal(
        parseRuntimeSignalDecision(result.response),
        signal
      );
    } catch (error) {
      lastError = error;
      if (attempt === REPAIR_ATTEMPTS) break;
      result = await generateWithConfiguredLlm({
        model,
        prompt: buildEnterpriseRepairPrompt(prompt, result.response, error instanceof Error ? error.message : String(error)),
      });
    }
  }

  if (!canUsePaidEscalation()) throw lastError;

  const escalated = await generateWithPaidEscalation({
    reason: "repeated-structured-output-failure",
    prompt: buildEnterpriseRepairPrompt(prompt, result.response, lastError instanceof Error ? lastError.message : String(lastError)),
  });
  return validateRuntimeSignalDecisionForSignal(
    parseRuntimeSignalDecision(escalated.response),
    signal
  );
}

function recordRuntimeEvaluation(input: {
  readonly runtimeId: string;
  readonly businessFunction: string;
  readonly signalEventId: string;
  readonly signal: OrganisationalEventInput;
  readonly decision?: RuntimeSignalDecision;
  readonly jobId?: string;
  readonly error?: string;
}): void {
  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type: input.error ? "runtime.signal.evaluation_failed" : "runtime.signal.evaluated",
    level: input.error ? "error" : "info",
    message: input.error
      ? `${input.businessFunction} could not evaluate ${input.signal.label}: ${input.error}`
      : `${input.businessFunction} evaluated ${input.signal.label}: ${input.decision?.reason}`,
    timestamp: Date.now(),
    payload: {
      runtimeId: input.runtimeId,
      businessFunction: input.businessFunction,
      signalEventId: input.signalEventId,
      signalLabel: input.signal.label,
      shouldCreateJob: input.decision?.shouldCreateJob,
      jobId: input.jobId,
      error: input.error,
    },
  });
}

/** Evaluates a signal for every running Runtime in the named Enterprise. */
export async function evaluateSignalForRunningRuntimes(
  signal: OrganisationalEventInput,
  signalEventId: string,
  reasoner: RuntimeSignalReasoner = reasonAboutRuntimeSignal,
  targetRuntimeIds?: readonly string[]
): Promise<readonly RuntimeSignalEvaluation[]> {
  const enterprise = getEnterpriseByIdOrName(signal.enterpriseName);

  if (!enterprise) {
    return [];
  }

  // An Event raised by a Task on a named piece of work is not read by a
  // model at all: a Function deciding what to do next would send that work's
  // content where the send log does not see it, and nothing continues named
  // work automatically (work/workLocks.ts).
  if (
    typeof signal.payload?.sourceJobId === "string" &&
    getJob(signal.payload.sourceJobId)?.workId
  ) {
    return [];
  }

  const targetedRuntimeIds = targetRuntimeIds
    ? new Set(targetRuntimeIds)
    : undefined;
  const definitions = listBusinessFunctionDefinitionsByEnterprise(enterprise.id)
    .filter((definition) => {
      return Boolean(
        definition.runtimeId &&
        (!targetedRuntimeIds || targetedRuntimeIds.has(definition.runtimeId)) &&
        getBusinessFunction(definition.runtimeId)?.state === "running"
      );
    });

  const evaluations: RuntimeSignalEvaluation[] = [];

  for (const definition of definitions) {
    const runtimeId = definition.runtimeId as string;

    try {
      const decision = validateRuntimeSignalDecisionForSignal(
        await reasoner(definition, signal),
        signal
      );
      let job: Job | undefined;

      // The completed Task behind this Event, when there was one. It carries
      // the chain's depth, so a cascade that alternates between this path and
      // the outcome path is bounded once rather than twice from zero.
      const sourceTask =
        typeof signal.payload?.sourceJobId === "string"
          ? getJob(signal.payload.sourceJobId)
          : undefined;

      if (
        decision.shouldCreateJob &&
        decision.task &&
        sourceTask &&
        !canCreateFollowUpTask(sourceTask)
      ) {
        recordRuntimeEvaluation({
          runtimeId,
          businessFunction: definition.label,
          signalEventId,
          signal,
          error: describeFollowUpLimitReached(sourceTask),
        });
        evaluations.push({
          businessFunction: definition.label,
          runtimeId,
          decision,
        });
        continue;
      }

      // A Function creating work from an Event skips createTask, so the rules
      // for named work are applied here too, before anything is written: work
      // on a named piece of work is never continued automatically, a law
      // practice's Task that needs a matter is not created without one, and
      // nothing naming a client with "no AI" work is created (work/workLocks.ts).
      if (decision.shouldCreateJob && decision.task) {
        const workRefusal = sourceTask?.workId
          ? `the Task behind this Event (${sourceTask.id}) belongs to a named piece of work, and work on it is never continued automatically.`
          : refuseTaskWithoutWork({
              enterpriseId: enterprise.id,
              clientId: sourceTask?.clientId,
              hasDocuments: resolveSignalInputArtefactRefs(signal, enterprise.id).length > 0,
              instruction: decision.task,
            });
        if (workRefusal) {
          recordRuntimeEvaluation({
            runtimeId,
            businessFunction: definition.label,
            signalEventId,
            signal,
            error: `${definition.label} did not create a Task from ${signal.label}: ${workRefusal}`,
          });
          evaluations.push({
            businessFunction: definition.label,
            runtimeId,
            decision,
          });
          continue;
        }
      }

      if (decision.shouldCreateJob && decision.task) {
        const inferredCapabilities =
          inferBusinessFunctionCapabilities(
            definition
          );
        const requiredCapabilities =
          [
            ...new Set([
              ...(
                decision.requiredCapabilities
                  ?.length
                  ? decision
                      .requiredCapabilities
                  : inferredCapabilities
              ),
              ...inferredCapabilities
                .filter(
                  (capability) =>
                    capability ===
                    "web-research" || capability === "office-read" || capability === "office-write"
                ),
            ]),
          ];
        // createTask chooses the Worker, as it does for a person's Task.
        const inputArtefactRefs =
          resolveSignalInputArtefactRefs(
            signal,
            enterprise.id
          );
        // An Event never switches search on, nor supplies search words: its
        // payload may carry text a model wrote (S4).

        // Created through createTask (C1), under a claim good once for this
        // Event and Function (runtime/nextActions.ts): a Task behind the
        // Event that nobody signed off, or that was set aside, is refused
        // there; its client and the person who asked are carried; the chain
        // counter is stamped; and every check a person's Task gets is made.
        const claimKey = `${signalEventId}:${definition.id}`;
        if (!recordNextAction("event-task", claimKey) || claimNextAction("event-task", claimKey) !== "claimed") {
          throw new Error(`${definition.label} already created a Task from this Event once.`);
        }
        let created: Awaited<ReturnType<typeof createEventTask>>;
        try {
          created = await createEventTask({
            task: decision.task,
            functionId: definition.id,
            enterpriseId: enterprise.id,
            sourceTask,
            inputArtefactRefs,
          });
        } finally {
          finishNextAction("event-task", claimKey);
        }
        if ("refused" in created) {
          throw new Error(`${definition.label} did not create a Task from ${signal.label}: ${created.refused}`);
        }
        job = created.job;
        if (job.worker) {
          broadcastEvent(
            "worker.assigned",
            "success",
            `Worker ${job.worker} assigned to Task ${job.id}`
          );
        }
        attachBusinessFunctionJob(runtimeId, job.id);
        broadcastEvent(
          "job.created",
          "success",
          `Function ${definition.label} created Task from ${signal.label}: ${job.task}`
        );
      }

      recordRuntimeEvaluation({
        runtimeId,
        businessFunction: definition.label,
        signalEventId,
        signal,
        decision,
        jobId: job?.id,
      });

      evaluations.push({
        businessFunction: definition.label,
        runtimeId,
        decision,
        job,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      recordRuntimeEvaluation({
        runtimeId,
        businessFunction: definition.label,
        signalEventId,
        signal,
        error: message,
      });

      evaluations.push({
        businessFunction: definition.label,
        runtimeId,
        error: message,
      });
    }
  }

  return evaluations;
}

/** Formats transparent ongoing Job decisions for command output. */
export function formatRuntimeSignalEvaluations(
  evaluations: readonly RuntimeSignalEvaluation[]
): string {
  if (evaluations.length === 0) {
    return "No running Functions observed this signal.";
  }

  return [
    "Function evaluations",
    "",
    ...evaluations.map((evaluation) => {
      if (evaluation.error) {
        return `${evaluation.businessFunction}: Evaluation failed — ${evaluation.error}`;
      }

      if (evaluation.job) {
        return `${evaluation.businessFunction}: Task queued — ${evaluation.job.task}\n  Reason: ${evaluation.decision?.reason}`;
      }

      return `${evaluation.businessFunction}: No Task created\n  Reason: ${evaluation.decision?.reason}`;
    }),
  ].join("\n");
}

/**
 * Creates a Function's Task from an Event through createTask, following the
 * Task behind the Event when there was one.
 *
 * SIDE EFFECT: May create one Task.
 */
export async function createEventTask(input: {
  readonly task: string;
  readonly functionId: string;
  readonly enterpriseId: string;
  readonly sourceTask?: Job;
  readonly inputArtefactRefs: readonly string[];
}): Promise<{ readonly job: Job } | { readonly refused: string }> {
  const { createTask } = await import("../repl/taskRoutingCommands");
  const outcome = createTask([
    input.task,
    "--function", input.functionId,
    "--enterprise", input.enterpriseId,
    ...(input.sourceTask ? carriedTaskArgs(input.sourceTask) : []),
    ...(input.inputArtefactRefs.length ? ["--input-artefact", input.inputArtefactRefs.join(",")] : []),
    ...(input.sourceTask ? ["--follows", input.sourceTask.id] : []),
  ]);
  const job = outcome.created && outcome.taskId ? getJob(outcome.taskId) : undefined;
  return job ? { job } : { refused: outcome.message.split("\n")[0] };
}
