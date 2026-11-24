import { chainDepthOf, MAX_CHAIN_DEPTH } from "../runtime/followUpChain";
import { refuseWebStepRequest, type WebSearchRefusalCode } from "../runtime/webSearchSwitch";
import { refuseUnacceptedHandOver } from "../runtime/resultSignOff";
import { recordPassOnChoice, refusePassOnChoice } from "../runtime/passOnRules";
import { readResultSetAsideStanding } from "../runtime/resultSetAside";
import { describeMissingAbility, findMissingAbility, inferTaskAbilities, type AbilityId } from "../capabilities/abilities";
import { refuseWorkUnderChecks } from "../business/functionChecks";
import { refuseStaffNotReady } from "../business/staffCheck";
import { refuseTaskWithoutWork, refuseWorkUnderLocks, type DraftKind } from "../work/workLocks";
import { getWork } from "../work/workStore";
import { UNVERIFIED_WORK, type WorkRecord } from "../work/workRecord";
import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { formatClientRecordForWorker, type ClientRecord } from "../clients/clientRecords";
import { getClientRecord, getClientTerms } from "../clients/clientStore";
import { isWorkerAvailableForNewTask, listWorkers } from "../control/workers";
import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  listBusinessFunctionDefinitions,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  getWorker,
  isConsequentialCapability,
  workerSupportsCapabilities,
  type Worker,
  type WorkerCapability,
} from "../control/workers";

import {
  formatArtefactReference,
  parseArtefactReferences,
} from "../artefacts/artefact";

import {
  parseProcedureReference,
} from "../procedures/procedure";

import {
  formatArtefactContextForWorker,
} from "../artefacts/artefactStore";

import {
  waitForArtefactApprovals,
} from "../artefacts/artefactWorkflow";

import {
  getEnterpriseByIdOrName,
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  inferBusinessFunctionCapabilities,
  inferCapabilitiesFromText,
} from "../runtime/businessFunctionRuntimeRouting";

import {
  enqueueJob,
  getJob,
} from "../runtime/jobQueue";

import {
  getHumanTask,
} from "../runtime/humanTaskStore";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  listStaffingAssignments,
} from "../staffing/staffingStore";

const TASK_CREATE_USAGE =
  'Usage: /task create "<one-clear-outcome>" [--job "<job>"] [--enterprise "<enterprise>"] [--search-query "<query>"] [--input-artefact <id@version[,id@version]>] [--after-artefact-approval <id@version[,id@version]>] [--procedure <proc-id@version>] [--follows <task-id>] [--asked-by "<person>"] [--client <client-id>] [--work <work-id>] [--pass-on <business-function|off>] [--write-only]';

const TASK_CAPABILITY_FLAGS = [
  "--capability",
  "--bounded-task",
] as const;

const TASK_OPTION_FLAGS = [
  // --function is the current name for the owning ongoing Function. --job is
  // the pre-rename spelling, kept so existing scripts and scenarios still run.
  "--function",
  "--job",
  "--enterprise",
  "--search-query",
  "--input-artefact",
  "--after-artefact-approval",
  "--procedure",
  // The finished Task this one continues from.
  "--follows",
  // The person who asked for the work.
  "--asked-by",
  // The client the work is for.
  "--client",
  // The named piece of work (a matter, a book or a deal) this Task belongs to.
  "--work",
  // Where its result goes before a person signs it off: another business
  // function's AI worker to check it, or "off" for straight back.
  "--pass-on",
] as const;

export type TaskCreateOptions = {
  readonly request: string;
  readonly jobReference?: string;
  readonly enterpriseReference?: string;
  readonly webSearchQuery?: string;
  readonly inputArtefactReferences?: string;
  readonly artefactApprovalReferences?: string;
  readonly procedureRef?: string;
  /**
   * A finished Task this one continues from.
   *
   * The operator sequences the work — create the second Task once the first is
   * done — and Arturo carries the material across, rather than the operator
   * retyping it into the instruction and the Worker inventing the rest.
   */
  readonly followsTaskId?: string;
  /**
   * A finished Human Task this one works from.
   *
   * Same flag as followsTaskId, resolved by id shape. What a person observed
   * and what an AI Worker produced are both "work that has finished", and
   * making the operator remember which kind of id goes in which switch would
   * be asking them to know Arturo's schema.
   */
  readonly followsHumanTaskId?: string;
  /**
   * For this task alone: "off" to bring its result straight back to a person,
   * or a business function to send it to first, to be checked
   * (runtime/passOnRules.ts). Refused for a business function set to never
   * pass its results on.
   */
  readonly passOn?: string;
  /** The person who asked for this work, as typed; checked against the company's people. */
  readonly askedBy?: string;
  /** The client the work is for, by id; checked against the company's clients. */
  readonly clientReference?: string;
  /** The named piece of work this Task belongs to, by id (work/workStore.ts). Set once. */
  readonly workReference?: string;
  /**
   * The person knows no AI worker can do what the instruction asks (add a
   * client, send email, change other software, set a reminder) and wants it
   * written about instead.
   */
  readonly writeOnly?: boolean;
};

type TaskCreateParseResult =
  | {
      readonly ok: true;
      readonly options: TaskCreateOptions;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type JobResolution =
  | {
      readonly ok: true;
      readonly job: BusinessFunctionDefinition;
      readonly inferred: boolean;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/** Parses the outcome and supported options for /task create. */
export function parseTaskCreateOptions(
  args: readonly string[]
): TaskCreateParseResult {
  const values: {
    jobReference?: string;
    enterpriseReference?: string;
    webSearchQuery?: string;
    inputArtefactReferences?: string;
    artefactApprovalReferences?: string;
    procedureRef?: string;
    followsTaskId?: string;
    followsHumanTaskId?: string;
    askedBy?: string;
    clientReference?: string;
    workReference?: string;
    writeOnly?: boolean;
    passOn?: string;
  } = {};
  const requestParts: string[] = [];

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const argument =
      args[index];
    const directCapabilityFlag =
      TASK_CAPABILITY_FLAGS.find(
        (flag) =>
          argument === flag ||
          argument.startsWith(
            `${flag}=`
          )
      );
    if (directCapabilityFlag) {
      // Both flags were removed when capabilities stopped being typed by hand.
      // The old spellings survive in written material, so the refusal has to
      // teach the replacement rather than just name the flag. It also has to
      // read as a refusal to captureUiCommandOutput, or a rejected command is
      // announced under the label "Task created".
      return {
        ok: false,
        message:
          directCapabilityFlag === "--capability"
            ? [
                "--capability is no longer used, so Arturo cannot accept it.",
                "A Task's required capabilities now come from the Worker staffed",
                "on the Function that owns it.",
                "",
                "Run /task, describe the outcome, and Arturo works out the rest.",
              ].join("\n")
            : [
                "--bounded-task is no longer used, so Arturo cannot accept it.",
                "The bounded outcome is the Task itself.",
                "",
                "Run /task and describe what you want done.",
              ].join("\n"),
      };
    }

    if (argument === "--write-only") {
      values.writeOnly = true;
      continue;
    }

    const optionFlag =
      TASK_OPTION_FLAGS.find(
        (flag) =>
          argument === flag ||
          argument.startsWith(
            `${flag}=`
          )
      );
    if (optionFlag) {
      const equalsPrefix =
        `${optionFlag}=`;
      const value =
        argument.startsWith(equalsPrefix)
          ? argument.slice(
              equalsPrefix.length
            )
          : args[++index];
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          message:
            `${optionFlag} requires a value.`,
        };
      }

      if (optionFlag === "--function" || optionFlag === "--job") {
        values.jobReference = value;
      } else if (optionFlag === "--enterprise") {
        values.enterpriseReference = value;
      } else if (optionFlag === "--search-query") {
        values.webSearchQuery = value;
      } else if (optionFlag === "--follows") {
        // A Human Task is named by its own id shape, so the operator types the
        // id they were given rather than choosing a switch by record type.
        const humanSource = getHumanTask(value);
        if (humanSource) {
          if (humanSource.status !== "completed") {
            return {
              ok: false,
              message: `Human Task ${value} has not been completed, so there is nothing for this one to work from yet.`,
            };
          }
          if (!humanSource.notes?.trim()) {
            return {
              ok: false,
              message: `Human Task ${value} was completed without notes, so it records nothing for this Task to work from.`,
            };
          }
          values.followsHumanTaskId = humanSource.id;
        } else {
          const source = getJob(value);
          if (!source) {
            return { ok: false, message: `No Task or Human Task found with id ${value}.` };
          }
          if (source.status !== "completed") {
            return {
              ok: false,
              message: `Task ${value} has not finished, so there is nothing for this one to work from yet.`,
            };
          }
          values.followsTaskId = source.id;
        }
      } else if (optionFlag === "--client") {
        values.clientReference = value;
      } else if (optionFlag === "--work") {
        values.workReference = value;
      } else if (optionFlag === "--pass-on") {
        values.passOn = value;
      } else if (optionFlag === "--asked-by") {
        values.askedBy = value;
      } else if (optionFlag === "--input-artefact") {
        values.inputArtefactReferences = value;
      } else if (optionFlag === "--procedure") {
        try {
          parseProcedureReference(value);
        } catch (error: unknown) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : String(error),
          };
        }
        values.procedureRef = value;
      } else {
        values.artefactApprovalReferences = value;
      }
      continue;
    }

    if (argument.startsWith("--")) {
      return {
        ok: false,
        message: `Unknown /task create option: ${argument}`,
      };
    }

    requestParts.push(argument);
  }

  const request =
    requestParts.join(" ").trim();
  if (!request) {
    return {
      ok: false,
      message: TASK_CREATE_USAGE,
    };
  }

  return {
    ok: true,
    options: {
      request,
      ...values,
    },
  };
}

function tokenize(
  value: string
): readonly string[] {
  return [
    ...new Set(
      (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
        .filter(
          (token) =>
            token.length > 2 &&
            !STOP_WORDS.has(token)
        )
    ),
  ];
}

function countSharedTokens(
  source: readonly string[],
  candidate: readonly string[]
): number {
  const candidateTokens =
    new Set(candidate);

  return source.filter(
    (token) =>
      candidateTokens.has(token)
  ).length;
}

/** How a request fits one Function, part by part. */
export type TaskFitParts = {
  /** Words the request shares with the Function's name. */
  readonly nameWords: number;
  /** Words it shares with the Function's objective, description, inputs and outputs. */
  readonly otherWords: number;
  /** Different words it shares with the Function anywhere, each counted once. */
  readonly sharedWords: number;
  /** Kinds of work (review, research…) both ask for. */
  readonly capabilities: number;
  /** The request names the Function, as whole words. */
  readonly named: boolean;
  /** The score inference ranks Functions by. */
  readonly total: number;
};

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How well a request fits one Function, and why.
 *
 * PURE: No side effects.
 */
export function taskFitParts(
  request: string,
  job: BusinessFunctionDefinition
): TaskFitParts {
  const requestTokens =
    tokenize(request);
  const labelTokens =
    tokenize(job.label);
  const supportingText = [
    job.objective,
    job.description ?? "",
    ...job.inputs,
    ...job.outputs,
    ...job.successCriteria,
  ].join(" ");
  const supportingTokens =
    tokenize(supportingText);
  const requestCapabilities =
    inferCapabilitiesFromText(
      request
    );
  const jobCapabilities =
    inferBusinessFunctionCapabilities(
      job
    );
  const capabilities =
    requestCapabilities.filter(
      (capability) =>
        jobCapabilities.includes(
          capability
        )
    ).length;

  const normalizedLabel =
    job.label.toLowerCase().trim();
  // Whole words only: a Function called "Ads" is not named by "reads".
  const named =
    normalizedLabel.length > 0 &&
    new RegExp(
      `(?:^|[^a-z0-9])${escapePattern(normalizedLabel)}(?:$|[^a-z0-9])`
    ).test(request.toLowerCase());
  const nameWords =
    countSharedTokens(
      requestTokens,
      labelTokens
    );
  const otherWords =
    countSharedTokens(
      requestTokens,
      supportingTokens
    );

  const anywhere = new Set([...labelTokens, ...supportingTokens]);
  return {
    nameWords,
    otherWords,
    sharedWords: requestTokens.filter((token) => anywhere.has(token)).length,
    capabilities,
    named,
    total:
      nameWords * 5 +
      otherWords +
      capabilities * 8 +
      (named ? 20 : 0),
  };
}

function jobMatchScore(
  request: string,
  job: BusinessFunctionDefinition
): number {
  return taskFitParts(request, job).total;
}

/** The least score at which a Function is taken to fit a request. */
export const TASK_OWNING_JOB_MIN_SCORE = 5;

/**
 * How well a request fits one Function, by the same measure inference uses.
 *
 * PURE: No side effects.
 */
export function scoreTaskOwningJob(
  request: string,
  job: BusinessFunctionDefinition
): number {
  return jobMatchScore(request, job);
}

/**
 * Infers an owning Job only when one candidate is distinctly suitable.
 * A single Job is always unambiguous within its Enterprise.
 */
export function inferTaskOwningJob(
  request: string,
  candidates: readonly BusinessFunctionDefinition[]
): BusinessFunctionDefinition | undefined {
  if (candidates.length === 1) {
    return candidates[0];
  }

  const ranked =
    candidates
      .map(
        (job) => ({
          job,
          score: jobMatchScore(
            request,
            job
          ),
        })
      )
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.job.label.localeCompare(
            right.job.label
          )
      );
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (
    !best ||
    best.score < TASK_OWNING_JOB_MIN_SCORE ||
    best.score === runnerUp?.score
  ) {
    return undefined;
  }

  return best.job;
}

function formatJobCandidates(
  candidates: readonly BusinessFunctionDefinition[]
): string {
  return candidates.map(
    (job) =>
      `  - ${job.label}`
  ).join("\n");
}

export function resolveTaskJob(
  options: TaskCreateOptions
): JobResolution {
  const enterprise =
    options.enterpriseReference
      ? getEnterpriseByIdOrName(
          options.enterpriseReference
        )
      : undefined;
  if (
    options.enterpriseReference &&
    !enterprise
  ) {
    return {
      ok: false,
      message:
        `Enterprise not found: ${options.enterpriseReference}`,
    };
  }

  const jobReference =
    options.jobReference;
  if (jobReference) {
    const matchingJobs =
      enterprise
        ? listBusinessFunctionDefinitionsByEnterprise(
            enterprise.id
          ).filter(
            (candidate) =>
              candidate.id === jobReference ||
              candidate.label
                .trim()
                .toLowerCase() ===
                jobReference
                  .trim()
                  .toLowerCase()
          )
        : listBusinessFunctionDefinitions().filter(
            (candidate) =>
              candidate.id === jobReference ||
              candidate.label
                .trim()
                .toLowerCase() ===
                jobReference
                  .trim()
                  .toLowerCase()
          );
    if (matchingJobs.length === 0) {
      return {
        ok: false,
        message: enterprise
          ? `Function not found in ${enterprise.name}: ${jobReference}`
          : `Function not found: ${jobReference}`,
      };
    }

    if (matchingJobs.length > 1) {
      return {
        ok: false,
        message: [
          `More than one Function matches: ${jobReference}.`,
          "Use its exact Function ID or add --enterprise to choose one.",
        ].join("\n"),
      };
    }

    return {
      ok: true,
      job: matchingJobs[0],
      inferred: false,
    };
  }

  const enterprises =
    listEnterprises();
  if (!enterprise && enterprises.length > 1) {
    return {
      ok: false,
      message: [
        "More than one Enterprise is available.",
        'Use --enterprise "<enterprise>" or --job "<job>" to choose where this Task belongs.',
      ].join("\n"),
    };
  }

  const candidates =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        )
      : enterprises.length === 1
        ? listBusinessFunctionDefinitionsByEnterprise(
            enterprises[0].id
          )
        : [];
  if (candidates.length === 0) {
    return {
      ok: false,
      message:
        'No Functions are available for this Task. Create one first with /function create "<name>" --enterprise "<enterprise>" --objective "<objective>".',
    };
  }

  const job =
    inferTaskOwningJob(
      options.request,
      candidates
    );
  if (!job) {
    return {
      ok: false,
      message: [
        "Arturo could not determine one Function for this Task.",
        "Candidates:",
        formatJobCandidates(candidates),
        'Use /task create --job "<job>" "<one-clear-outcome>".',
      ].join("\n"),
    };
  }

  return {
    ok: true,
    job,
    inferred: true,
  };
}

function isAvailableAiWorker(
  worker: Worker<any, any>
): boolean {
  return (
    (worker.kind === "ai" || worker.kind === "workflow") &&
    isWorkerAvailableForNewTask(worker)
  );
}

function resolveStaffedAiWorker(
  job: BusinessFunctionDefinition,
  capabilities: readonly WorkerCapability[]
):
  | {
      readonly ok: true;
      readonly worker: Worker<any, any>;
      readonly unmetCapabilities: readonly WorkerCapability[];
    }
  | {
      readonly ok: false;
      readonly message: string;
    } {
  const assignments =
    listStaffingAssignments(
      job.id
    ).filter(
      (assignment) =>
        assignment.role === "ai"
    );
  if (assignments.length === 0) {
    return {
      ok: false,
      // The Enterprise's name, not its id: an operator types names everywhere
      // else, and "enterprise-1" is not something they ever chose.
      message: [
        `${job.label} has no Worker assigned to it, so there is nobody to do this.`,
        "",
        "  /staff",
        "",
        "Registering a Worker does not assign it to a Function; /staff does that.",
      ].join("\n"),
    };
  }

  const workers =
    assignments
      .map(
        (assignment) =>
          getWorker(
            assignment.workerName
          )
      )
      .filter(
        (worker): worker is Worker<any, any> =>
          worker !== undefined
      )
      .filter(
        worker => isAvailableAiWorker(worker) && workerBelongsToEnterprise(worker.name, job.enterpriseId)
      )
      .sort(
        (left, right) =>
          left.name.localeCompare(
            right.name
          )
      );

  const required = [...capabilities];

  // Prefer a single Worker that covers every required capability — the strict,
  // fully-attested match.
  const fullyCovering =
    workers.find(
      (candidate) =>
        workerSupportsCapabilities(
          candidate,
          required
        )
    );
  if (fullyCovering) {
    return {
      ok: true,
      worker: fullyCovering,
      unmetCapabilities: [],
    };
  }

  // A Function is often staffed by a TEAM whose archetypes only together cover
  // its capabilities, so no single Worker holds the union. Rather than refuse
  // the Task, route it to the Worker that covers the MOST of what it needs
  // (deterministic tie-break by the name sort above) and report the shortfall,
  // so a team-staffed Function is not structurally unable to accept work.
  const coverageOf = (candidate: Worker<any, any>): WorkerCapability[] => {
    const held = new Set(candidate.capabilities ?? []);
    return required.filter((capability) => held.has(capability));
  };

  const best =
    workers.reduce<
      | { worker: Worker<any, any>; covered: readonly WorkerCapability[] }
      | undefined
    >((chosen, candidate) => {
      const covered = coverageOf(candidate);
      if (
        !chosen ||
        covered.length > chosen.covered.length
      ) {
        return { worker: candidate, covered };
      }
      return chosen;
    }, undefined);

  // No staffed Worker covers even one required capability. Whether that
  // refuses depends on what the capabilities authorise. Cognitive shortfalls
  // (summarisation, writing…) route to a reasoning Worker with the gap
  // reported — a walkthrough hit this as a hard dead end straight after
  // applying Arturo's own staffing plan, with the suggested /staff re-run
  // unable to fix it. Consequential capabilities (side effects, authority)
  // keep failing closed: routing must never hand work to a Worker that lacks
  // the capability that Governance and dispatch checks key on.
  if (!best || best.covered.length === 0) {
    const missingConsequential =
      required.filter(isConsequentialCapability);

    if (missingConsequential.length === 0 && workers.length > 0) {
      const fallback =
        workers.find(
          (candidate) =>
            (candidate.capabilities ?? []).includes("llm")
        ) ?? workers[0];
      return {
        ok: true,
        worker: fallback,
        unmetCapabilities: required,
      };
    }

    const enterpriseName =
      getEnterpriseByIdOrName(job.enterpriseId)?.name ?? job.enterpriseId;
    return {
      ok: false,
      message: [
        `No available staffed AI Worker for ${job.label} in ${enterpriseName} holds ${missingConsequential.length > 0 ? missingConsequential.join(", ") : capabilities.join(", ")}, which this Task needs before it can run.`,
        "",
        `  /add-ai-worker "<name>" <archetype>    register a Worker whose archetype holds it`,
        "  /staff                                     then assign Workers to Functions",
      ].join("\n"),
    };
  }

  const unmetCapabilities =
    required.filter(
      (capability) => !best.covered.includes(capability)
    );

  return {
    ok: true,
    worker: best.worker,
    unmetCapabilities,
  };
}

function parseTaskArtefactContext(
  options: TaskCreateOptions
):
  | {
      readonly ok: true;
      readonly inputArtefactRefs?: string[];
      readonly artefactApprovalDependencies?: string[];
      readonly context: string;
    }
  | {
      readonly ok: false;
      readonly message: string;
    } {
  let inputArtefactRefs:
    string[] |
    undefined;
  let artefactApprovalDependencies:
    string[] |
    undefined;
  let context = "";

  try {
    if (options.inputArtefactReferences) {
      const references =
        parseArtefactReferences(
          options.inputArtefactReferences
        );
      inputArtefactRefs =
        references.map(
          formatArtefactReference
        );
      context =
        formatArtefactContextForWorker(
          references
        );
    }

    if (options.artefactApprovalReferences) {
      const dependencies =
        parseArtefactReferences(
          options.artefactApprovalReferences
        );
      artefactApprovalDependencies =
        dependencies.map(
          formatArtefactReference
        );

      if (!inputArtefactRefs) {
        inputArtefactRefs = [
          ...artefactApprovalDependencies,
        ];
        context =
          formatArtefactContextForWorker(
            dependencies
          );
      }
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }

  return {
    ok: true,
    inputArtefactRefs,
    artefactApprovalDependencies,
    context,
  };
}

export function inferTaskCapabilities(
  request: string
): WorkerCapability[] {
  const capabilities =
    inferCapabilitiesFromText(
      request
    );
  const isEvidenceReview =
    /\b(review|assess|audit)\b/i.test(
      request
    ) &&
    /\bevidence\b/i.test(
      request
    ) &&
    !/\b(research|search|source|market|supplier)\b/i.test(
      request
    );

  return isEvidenceReview
    ? capabilities.filter(
        (capability) =>
          capability !== "research"
      )
    : capabilities;
}

export type TaskCreateOutcome = {
  readonly created: boolean;
  readonly taskId?: string;
  readonly message: string;
  /** Refused because no AI worker can do what the instruction asks (capabilities/abilities.ts). */
  readonly missingAbility?: AbilityId;
  /** A fixed refusal code, where the refusal has one. */
  readonly code?: TaskCreateRefusalCode;
};

/** Fixed refusal codes from createTask. */
export type TaskCreateRefusalCode = "chain_depth_exceeded" | WebSearchRefusalCode;

/**
 * The refusal when a Task would be deeper than MAX_CHAIN_DEPTH in a chain
 * (scenario additions S2). PURE.
 */
export function chainDepthRefusal(sourceTaskId: string): string {
  return `${sourceTaskId} is already ${MAX_CHAIN_DEPTH} steps deep in a chain of work, the most Arturo carries on from one request, so no task follows it. Nothing was started. Read it, and ask for the next step as new work if it is still needed.`;
}

/**
 * What only Arturo itself may pass to createTask, never anything typed.
 */
export type TaskCreateInternal = {
  /**
   * Says whether an unsigned result may be followed because a business
   * function's pass-on rule is passing it on now, under a claim Arturo made
   * for that result (runtime/resultPassOn.ts).
   */
  readonly passOnClaim?: (sourceTaskId: string) => boolean;
  /**
   * A precedent draft or its checker (steps 3 and 7). On a law practice it
   * must belong to a matter (work/workLocks.ts refuseTaskWithoutWork).
   */
  readonly draftKind?: DraftKind;
};

/** The capabilities of each AI Worker staffed on a Function. SIDE EFFECT: Reads staffing and Worker state. */
export function staffedAiCapabilities(functionId: string): string[][] {
  return listStaffingAssignments(functionId)
    .filter((assignment) => assignment.role === "ai")
    .map((assignment) => [...(getWorker(assignment.workerName)?.capabilities ?? [])]);
}

/**
 * Creates one bounded Task and reports what happened, without printing.
 * The terminal and the overview's "New work" form both call this, so a Task
 * started from the page is recorded exactly as one started from /task create.
 */
export function createTask(
  args: readonly string[],
  internal: TaskCreateInternal = {}
): TaskCreateOutcome {
  const lines: string[] = [];
  const say = (line: string) => { lines.push(line); };
  const refuse = (message: string): TaskCreateOutcome => ({ created: false, message });

  const parsed =
    parseTaskCreateOptions(
      args
    );
  if (!parsed.ok) {
    return refuse(parsed.message);
  }

  // A result written by an AI model goes on to other work only once someone
  // has signed it off, or set aside it goes nowhere. The page refused both and
  // /task create did not, so the terminal passed unsigned drafts from one AI
  // Worker to another. The one exception is a business function's own
  // pass-on rule, set by a person (runtime/resultPassOn.ts), which reaches
  // here only from Arturo itself with a claim made for this result.
  if (parsed.options.followsTaskId) {
    const source = getJob(parsed.options.followsTaskId);
    if (source && readResultSetAsideStanding(source).state === "set_aside") {
      return refuse(`${source.id} was set aside, so its result does not go on to another task.`);
    }
    if (source && refuseUnacceptedHandOver(source) && !(internal.passOnClaim && internal.passOnClaim(source.id))) {
      return refuse([
        `${source.id} was written by an AI model and nobody has signed it off, so no other task works from it yet.`,
        `Read it with /task inspect ${source.id}. If you accept it, run /task signoff ${source.id}, then create this Task again.`,
      ].join("\n"));
    }
    // One chain counter for every path (S2): a Task that follows another is
    // one deeper than it, and none is created deeper than MAX_CHAIN_DEPTH.
    if (source && chainDepthOf(source) + 1 > MAX_CHAIN_DEPTH) {
      return { created: false, code: "chain_depth_exceeded", message: chainDepthRefusal(source.id) };
    }
  }

  const jobResolution =
    resolveTaskJob(
      parsed.options
    );
  if (!jobResolution.ok) {
    return refuse(jobResolution.message);
  }

  // Who asked is a person of this company, named as Arturo knows them, or the
  // record would carry a name nobody can be held to.
  let requestedBy: string | undefined;
  if (parsed.options.askedBy !== undefined) {
    const named = parsed.options.askedBy.trim().toLowerCase();
    const person = listWorkers().find((worker) =>
      worker.kind === "human" &&
      (worker.name.toLowerCase() === named || (worker.displayName ?? "").toLowerCase() === named) &&
      workerBelongsToEnterprise(worker.name, jobResolution.job.enterpriseId));
    if (!person) {
      return refuse(`No person called ${parsed.options.askedBy.trim()} works in this company, so the work was not started. Name someone listed under People & Workers.`);
    }
    requestedBy = person.name;
  }

  // The client must be one of this company's: their record is quoted to the
  // Worker, and another business's client must never reach it.
  let client: ClientRecord | undefined;
  if (parsed.options.clientReference !== undefined) {
    client = getClientRecord(parsed.options.clientReference.trim());
    if (!client || client.enterpriseId !== jobResolution.job.enterpriseId) {
      return refuse(`No ${getClientTerms(jobResolution.job.enterpriseId).singular} ${parsed.options.clientReference.trim()} is recorded for this company, so the work was not started.`);
    }
  }

  // The named piece of work this Task belongs to (work/workStore.ts): given
  // with --work, or inherited from the Task it follows, which it can neither
  // drop nor change. Nothing is written here.
  const enterpriseOfFunction = jobResolution.job.enterpriseId ?? "";
  // One refuse-before-write staff check, per business, before anything is
  // written and before any model is called. Old /setup businesses are not exempt.
  const staffNotReady = refuseStaffNotReady(enterpriseOfFunction);
  if (staffNotReady) {
    return refuse(staffNotReady);
  }
  let work: WorkRecord | undefined;
  if (parsed.options.workReference !== undefined) {
    const reference = parsed.options.workReference.trim();
    const standing = getWork(reference);
    if (standing.state === "unverified") return refuse(`${UNVERIFIED_WORK} Nothing was started.`);
    if (standing.state === "missing" || standing.work.enterpriseId !== enterpriseOfFunction) {
      return refuse(`No work called ${reference} is recorded for this company, so the work was not started. See /work list.`);
    }
    work = standing.work;
  }
  const followed = parsed.options.followsTaskId ? getJob(parsed.options.followsTaskId) : undefined;
  if (followed?.workId && !work) {
    const standing = getWork(followed.workId);
    if (standing.state !== "verified" || standing.work.enterpriseId !== enterpriseOfFunction) return refuse(`${UNVERIFIED_WORK} Nothing was started.`);
    work = standing.work;
  }
  if (followed && work && followed.workId !== work.id) {
    return refuse(`A draft belongs to one piece of work and can't be moved. ${followed.id} ${followed.workId ? "belongs to other work" : "belongs to no piece of work"}, so this Task cannot follow it under ${work.name}. Nothing was started.`);
  }
  if (work?.clientId) {
    if (client && client.id !== work.clientId) {
      return refuse(`${work.name} is for another ${getClientTerms(enterpriseOfFunction).singular}, not ${client.name}. Nothing was started.`);
    }
    if (!client) {
      const ofWork = getClientRecord(work.clientId);
      if (!ofWork || ofWork.enterpriseId !== enterpriseOfFunction) return refuse(`The ${getClientTerms(enterpriseOfFunction).singular} ${work.name} is for is not recorded for this company. Nothing was started.`);
      client = ofWork;
    }
  }
  if (work && parsed.options.passOn !== undefined && parsed.options.passOn.trim().toLowerCase() !== "off") {
    return refuse(`Work on ${work.name} comes straight back to you: passing it on and routes are off for named work. Nothing was started.`);
  }

  // Where this task's result goes before a person signs it off, chosen for
  // this task alone. Checked now, before anything is queued.
  let passOnChoice: string | undefined;
  if (parsed.options.passOn !== undefined) {
    const wanted = parsed.options.passOn.trim();
    const enterpriseId = jobResolution.job.enterpriseId ?? "";
    passOnChoice = wanted.toLowerCase() === "off"
      ? "off"
      : listBusinessFunctionDefinitionsByEnterprise(enterpriseId).find((definition) => definition.id === wanted || definition.label.toLowerCase() === wanted.toLowerCase())?.id ?? wanted;
    const refusal = refusePassOnChoice({ enterpriseId, functionId: jobResolution.job.id, choice: passOnChoice });
    if (refusal) return refuse(`${refusal} Nothing was started.`);
  }

  // A web step: a person's own search words, for a business with web search
  // on, never on matter work at a law practice (S4, W3, W5). Checked now,
  // before anything is written; the Task then waits for its own go-ahead,
  // and everything is checked again right before it searches.
  if (parsed.options.webSearchQuery !== undefined) {
    const webRefusal = refuseWebStepRequest({ enterpriseId: jobResolution.job.enterpriseId, workId: work?.id, words: parsed.options.webSearchQuery });
    if (webRefusal) return { ...refuse(`${webRefusal.message} Nothing was started.`), code: webRefusal.code };
  }

  // Some things no AI Worker can do: add a client (a person does, through
  // Arturo's own read-back), send email, change other software, set a
  // reminder. A Task that asks for one is refused here, before anything is
  // queued, rather than given to a Worker that can only write about it. Every
  // way of creating a Task (the terminal, the page, a watched folder, a
  // suggestion) comes through here, so all refuse alike. --write-only says the
  // person wants it written about anyway.
  if (!parsed.options.writeOnly) {
    const terms = getClientTerms(jobResolution.job.enterpriseId ?? "");
    const missing = findMissingAbility(inferTaskAbilities(parsed.options.request, terms), staffedAiCapabilities(jobResolution.job.id));
    if (missing) {
      return {
        created: false,
        missingAbility: missing.id,
        message: [
          describeMissingAbility(missing, terms),
          ...(missing.id === "arturo-records" ? [`To add one, use /talk "<what you know about them>" --as "<your name>".`] : []),
          "To have an AI Worker write it out instead, add --write-only.",
        ].join(" "),
      };
    }
  }

  // Function marks and work-type locks, before looking for an AI worker, so
  // a locked or people-only Function is not told to run /staff for an AI worker.
  const lockedEarly = refuseWorkUnderLocks({ workId: work?.id, enterpriseId: enterpriseOfFunction, functionId: jobResolution.job.id, when: "create" });
  if (lockedEarly) {
    return refuse(`${lockedEarly} Nothing was started.`);
  }

  const inferredCapabilities =
    inferTaskCapabilities(
      parsed.options.request
    );
  inferredCapabilities.push(...inferBusinessFunctionCapabilities(jobResolution.job).filter(cap => cap === "office-read" || cap === "office-write"));
  if (
    parsed.options.webSearchQuery &&
    !inferredCapabilities.includes(
      "web-research"
    )
  ) {
    inferredCapabilities.push(
      "web-research"
    );
  }
  const capabilities =
    inferredCapabilities.length > 0
      ? inferredCapabilities
      : inferBusinessFunctionCapabilities(
          jobResolution.job
        );
  const workerResolution =
    resolveStaffedAiWorker(
      jobResolution.job,
      capabilities
    );
  if (!workerResolution.ok) {
    return refuse(workerResolution.message);
  }

  // When the Function is team-staffed and no single Worker covers everything the
  // Task needs, it is routed to the best-covering Worker. Say so plainly, and
  // record it on the Task, so a partial capability match is never mistaken for a
  // full one.
  const partialCoverageNote =
    workerResolution.unmetCapabilities.length > 0
      ? ` Best-available coverage: ${workerResolution.worker.name} does not hold ${workerResolution.unmetCapabilities.join(", ")}; that Worker archetype is staffed on this Function by a team. Add a Worker whose archetype covers it if the Task depends on it.`
      : "";

  const artefactContext =
    parseTaskArtefactContext(
      parsed.options
    );
  if (!artefactContext.ok) {
    return refuse(artefactContext.message);
  }

  // The locks on named work, and the rule for when a law practice's Task must
  // belong to a matter, checked in code before anything is queued, so the
  // terminal, the page, a watched folder and every caller refuse alike
  // (work/workLocks.ts). Checked again when the Task starts, before each model
  // call, when it finishes and at sign-off.
  const lockedWork = refuseWorkUnderLocks({ workId: work?.id, enterpriseId: enterpriseOfFunction, functionId: jobResolution.job.id, when: "create" });
  if (lockedWork) {
    return refuse(`${lockedWork} Nothing was started.`);
  }
  const unboundWork = refuseTaskWithoutWork({
    enterpriseId: enterpriseOfFunction,
    workId: work?.id,
    clientId: client?.id,
    hasDocuments: Boolean(artefactContext.inputArtefactRefs?.length || artefactContext.artefactApprovalDependencies?.length),
    draftKind: internal.draftKind,
    instruction: parsed.options.request,
  });
  if (unboundWork) {
    return refuse(`${unboundWork} Nothing was started.`);
  }

  // The checks Arturo makes itself, in code, before any model is asked: a
  // Function that needs a document, and a word limit it counts for itself.
  // Both the terminal and the company page reach this function, so both
  // refuse in the same way, and nothing has been queued yet.
  const refusedByChecks = refuseWorkUnderChecks({
    functionId: jobResolution.job.id,
    functionLabel: jobResolution.job.label,
    documents: artefactContext.inputArtefactRefs ?? [],
    continuesEarlierWork: Boolean(parsed.options.followsTaskId || parsed.options.followsHumanTaskId),
  });
  if (refusedByChecks) {
    return refuse(refusedByChecks);
  }

  const request = client
    ? [parsed.options.request, "", formatClientRecordForWorker(client, getClientTerms(client.enterpriseId))].join("\n")
    : parsed.options.request;
  const task =
    artefactContext.context
      ? [
          request,
          "",
          artefactContext.context,
        ].join("\n")
      : request;
  const queuedTask =
    enqueueJob(
      task,
      workerResolution.worker.name,
      {
        owningJobId:
          jobResolution.job.id,
        requiredCapabilities:
          capabilities,
        selectedWorker:
          workerResolution.worker.name,
        routingReason:
          (jobResolution.inferred
            ? `Inferred Function ${jobResolution.job.label}; selected its staffed Worker ${workerResolution.worker.name}.`
            : `Selected staffed Worker ${workerResolution.worker.name} for ${jobResolution.job.label}.`) +
          partialCoverageNote,
        enterpriseId:
          jobResolution.job.enterpriseId,
        // Recorded so governance can scope to the Function. Without it, a
        // Function-scoped approval rule has nothing to match and the Task runs
        // as though the Function had no requirement at all.
        businessFunctionId:
          jobResolution.job.id,
        webSearchQuery:
          parsed.options.webSearchQuery,
        inputArtefactRefs:
          artefactContext.inputArtefactRefs,
        artefactApprovalDependencies:
          artefactContext.artefactApprovalDependencies,
        procedureRef:
          parsed.options.procedureRef,
        sourceTaskId:
          parsed.options.followsTaskId,
        // chainDepth (stored as followUpDepth): the followed Task's plus one.
        ...(followed ? { followUpDepth: chainDepthOf(followed) + 1 } : {}),
        sourceHumanTaskId:
          parsed.options.followsHumanTaskId,
        requestedBy,
        clientId: client?.id,
        workId: work?.id,
      }
    );
  const taskWithGates =
    waitForArtefactApprovals(
      queuedTask
    );
  if (passOnChoice) {
    recordPassOnChoice({ jobId: taskWithGates.id, choice: passOnChoice, ...(requestedBy ? { by: requestedBy } : {}), at: Date.now() });
  }

  say(
    `task queued: ${taskWithGates.id}`
  );
  say(
    `selected Function: ${jobResolution.job.label}`
  );
  if (requestedBy) say(`asked for by: ${requestedBy}`);
  if (client) say(`for: ${client.name} (${client.id})`);
  if (work) say(`work: ${work.name} (${work.id})`);
  say(
    `selected worker: ${workerResolution.worker.displayName ?? workerResolution.worker.name}`
  );
  if (workerResolution.unmetCapabilities.length > 0) {
    // "Partial coverage" over a Worker that holds none of what the Task needs
    // overstates the match. Onboarding Analyst took work needing monitoring and
    // planning and held neither, under a heading claiming partial cover. Say
    // which it is, because the two mean different things to whoever reads it.
    const coversNothing =
      workerResolution.unmetCapabilities.length === capabilities.length;
    const name =
      workerResolution.worker.displayName ?? workerResolution.worker.name;
    say(
      coversNothing
        ? `no capability match: ${name} holds none of ${workerResolution.unmetCapabilities.join(", ")} — it was chosen because it can reason and no staffed Worker holds any of them. Add a Worker whose archetype covers this if the Task depends on it.`
        : `partial coverage: ${name} does not hold ${workerResolution.unmetCapabilities.join(", ")} — this Function is team-staffed and no single Worker covers everything the Task needs.`
    );
  }
  if (
    taskWithGates.status ===
    "awaiting_artefact_approval"
  ) {
    say(
      `status: awaiting Artefact approval (${artefactContext.artefactApprovalDependencies?.join(", ")})`
    );
  }

  broadcastEvent(
    "job.queued",
    "info",
    `Task queued for ${workerResolution.worker.name}: ${taskWithGates.id}`
  );
  return { created: true, taskId: taskWithGates.id, message: lines.join("\n") };
}

/**
 * Creates one bounded Task for an explicit or unambiguously inferred Job.
 * Capability metadata is derived from the Task outcome and selected Job;
 * callers cannot assign it directly.
 */
export function handleTaskCreateCommand(
  args: readonly string[]
): void {
  console.log(createTask(args).message);
}

/** Legacy alias for /task create. */
export function handleTaskCapCommand(
  args: readonly string[]
): void {
  handleTaskCreateCommand(
    args
  );
}
