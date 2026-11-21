import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { isWorkerAvailableForNewTask } from "../control/workers";
import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  getWorker,
  listWorkers,
  workerSupportsCapabilities,
  type Worker,
  type WorkerCapability,
} from "../control/workers";

import {
  listStaffingAssignments,
} from "../staffing/staffingStore";

import {
  isConsequentialCapability,
} from "./jobGovernance";

const CAPABILITY_SIGNALS:
  readonly {
    readonly pattern: RegExp;
    readonly capability: WorkerCapability;
  }[] = [
    {
      pattern: /\b(back[ -]?up|backup|archive|snapshot)\b/i,
      capability: "backup",
    },
    {
      // Governed Web Search, which fails closed when it is not configured, so
      // this must indicate an intent to *look something up* — not merely
      // mention a web-related noun. "It does not include website design"
      // described what a service excludes and still routed the Task to Web
      // Search, which then failed with "Web Search is disabled". The verb has
      // to be present, in the same sentence, or the phrase has to name a
      // search outright.
      pattern:
        /\b(search|research|look ?up|browse|crawl|scrape|find|check|get|gather|collect|retrieve|monitor|track)\b[^.!?]*\b(web|internet|online|website|webpage)\b|\b(web|internet|online)[ -](search|research)\b|\bsearch engine\b/i,
      capability: "web-research",
    },
    {
      pattern: /\b(safe|safety|hazard|incident|risk)\b/i,
      capability: "safety",
    },
    {
      pattern: /\b(monitor|compliance|regulat|inspect|quality)\b/i,
      capability: "monitoring",
    },
    {
      pattern: /\b(research|market|supplier|sourc|evidence)\b/i,
      capability: "research",
    },
    {
      pattern: /\b(summari[sz]|synthesi[sz])/i,
      capability: "summarisation",
    },
    {
      pattern: /\b(review|rating|assess|audit)\b/i,
      capability: "review",
    },
    {
      pattern: /\b(educat|content|communicat|guidance)\b/i,
      capability: "writing",
    },
    {
      // Analysis work. Its absence was a plain omission — every neighbouring
      // capability had a signal — and it mattered: a Governance rule keyed on
      // "analysis" could never match a Task from /task create, because no Task
      // instruction could ever declare it. An operator wrote exactly that rule,
      // saw it stored, and it silently never fired.
      pattern: /\banalys[ei]|\banalyz[ei]|\banalytic/i,
      capability: "analysis",
    },
    {
      pattern: /\bconvert|\btranslat|\breformat|\btranscrib/i,
      capability: "conversion",
    },
    {
      pattern: /\boptimi[sz]|\bmost efficient|\btrade-?off/i,
      capability: "optimization",
    },
    {
      pattern: /\bsimulat|\bwhat-?if\b|\bmodel the outcome/i,
      capability: "simulation",
    },
    {
      pattern: /\bcoach|\bmentor/i,
      capability: "coaching",
    },
    {
      pattern: /\bplan\b|\bplanning\b|\broadmap\b|\bmilestones?\b/i,
      capability: "planning",
    },
    {
      pattern: /\badvis[eo]|\badvice\b|\brecommend/i,
      capability: "advice",
    },
    {
      // Drafting an email is writing work; actually sending one is not, and
      // must never be implied by prose — see the note below.
      pattern: /\b(draft|write|compose|prepare)\b[^.!?]*\be-?mail\b/i,
      capability: "email-draft",
    },
    {
      pattern: /\b(partner|negotia|relationship)\b/i,
      capability: "negotiation",
    },
    {
      pattern: /\b(refund|return|coordinate|operation)\b/i,
      capability: "coordination",
    },
    {
      // External outreach. Routes to the human-contact capability so the Task
      // declares that it touches someone outside the system: a governance rule
      // keyed on human-contact can then gate it, and only a Worker cleared for
      // contact is eligible. The capability prepares or routes contact; it
      // never sends directly (that needs a governed connector), which is
      // exactly the honest boundary for an "email the customer" Task.
      pattern: /\b(e-?mail|notify|contact|message|reach out|apologi[sz]e|escalat)\b/i,
      capability: "human-contact",
    },

    // DELIBERATELY ABSENT, and not an oversight to be "completed" later:
    //
    // execution, file-read, file-write, shell-read, shell-execute, web and
    // email-send are eligibility to use an approved tool, not a description of
    // the work. A Task saying "write a file" is not thereby authorised to, and
    // every one of them is consequential — so inferring one from a turn of
    // phrase makes the Task demand a capability nobody staffed and fail closed.
    // That is the "website design" defect with worse consequences: work blocked
    // for a word it happened to contain. Authorisation belongs to the Worker's
    // capabilities and the Procedure, and gating belongs to a Governance rule.
    //
    // llm is held by every AI Worker and used by every AI Task, so inferring it
    // would attach a capability that distinguishes nothing.
    //
    // human-review creates an approval gate. Prose *about* human judgement —
    // "explain why a trained person must decide" — is not an instruction to
    // *obtain* one, and no pattern separates the two reliably. Getting it wrong
    // blocks work the operator never asked to block. Requiring a person is what
    // a Governance rule is for: deterministic, inspectable, and stated once.
  ];


/**
 * The capabilities Arturo can work out from typed Task or Function text.
 *
 * Derived from the signal table rather than hand-listed, so it cannot drift
 * from what inference actually produces. A Governance rule keyed on anything
 * outside this set will not match a Task the operator types — it can still
 * match work that declares the capability another way (an Event-driven
 * follow-up, a Procedure, a Workflow's operator step), which is why the
 * distinction has to be shown rather than the choice removed.
 */
export const INFERABLE_CAPABILITIES: readonly WorkerCapability[] =
  Array.from(
    new Set(
      CAPABILITY_SIGNALS.map(({ capability }) => capability)
    )
  );

/** Infers explicit routing capabilities from free-form Task or Job text. */
export function inferCapabilitiesFromText(
  text: string
): WorkerCapability[] {
  return [
    ...new Set(
      CAPABILITY_SIGNALS
        .filter(
          ({ pattern }) =>
            pattern.test(
              text
            )
        )
        .map(
          ({ capability }) =>
            capability
        )
    ),
  ];
}

/** Infers the smallest useful capability set from a Business Function. */
export function inferBusinessFunctionCapabilities(
  definition: BusinessFunctionDefinition,
  includeStaffingProposal = false
): WorkerCapability[] {
  const description = [
    definition.label,
    definition.objective,
    definition.description ?? "",
    ...definition.inputs,
    ...definition.outputs,
    ...definition.successCriteria,
  ].join(" ");

  const inferred =
    inferCapabilitiesFromText(
      description
    );

  return [
    ...new Set(
      inferred.length > 0
        ? inferred
        : [
            "analysis" as const,
          ]
    ),
  ];
}

/**
 * The Worker a Runtime picks for a Task it created itself, and what that
 * Worker does not cover.
 *
 * `unmetCapabilities` is empty on a full match. When it is not, the Task is
 * still routed — see `selectRuntimeWorkerWithCoverage` — and the shortfall is
 * recorded on the Task rather than discarded.
 */
export type RuntimeWorkerSelection = {
  readonly worker: Worker<any, any>;
  readonly unmetCapabilities: readonly WorkerCapability[];
};

/**
 * The original installation-wide selection, kept for a Function that has no
 * staffing assignments at all: archetype first, then a Worker holding every
 * required capability.
 */
function selectUnstaffedRuntimeWorker(
  definition: BusinessFunctionDefinition,
  capabilities: readonly WorkerCapability[]
): RuntimeWorkerSelection | undefined {
  const archetypeMatch = listWorkers().find(
    (worker) =>
      (worker.kind === "ai" || worker.kind === "workflow") &&
      workerBelongsToEnterprise(worker.name, definition.enterpriseId) &&
      isWorkerAvailableForNewTask(worker) &&
      Boolean(
        worker.archetype &&
        definition.requiredArchetypes.includes(worker.archetype)
      )
  );

  const worker =
    archetypeMatch ??
    listWorkers().find(
      (candidate) =>
        (candidate.kind === "ai" || candidate.kind === "workflow") &&
        workerBelongsToEnterprise(candidate.name, definition.enterpriseId) &&
        isWorkerAvailableForNewTask(candidate) &&
        workerSupportsCapabilities(candidate, [...capabilities])
    );

  if (!worker) return undefined;

  const held = new Set(worker.capabilities ?? []);
  return {
    worker,
    unmetCapabilities: capabilities.filter(
      (capability) => !held.has(capability)
    ),
  };
}

/**
 * Selects the Worker a Runtime should give an Event-created Task to.
 *
 * This is the autonomous counterpart of `resolveStaffedAiWorker` on the /task
 * path, and it has to make the same allowance. A Function is usually staffed
 * by a TEAM whose archetypes only together cover its capabilities, so requiring
 * one Worker to hold the union returned nothing — and the Runtime then created
 * the Task anyway, with no Worker and the routing reason "is waiting for a
 * Worker with …". Nothing ever re-routes such a Task, so it sat at Queued
 * forever. Measured end to end: Article Creation finished, the completion rule
 * published, Content Editing evaluated the Event and created a Task needing
 * monitoring, review and writing, and that Task was still unassigned and
 * unrunnable after approval. The event chain worked and delivered a dead Task.
 *
 * So: prefer a Worker that covers everything, otherwise take the one that
 * covers the most and report the rest. Consequential capabilities still fail
 * closed — routing must never hand work to a Worker lacking the capability
 * that Governance and dispatch checks key on, which is the one case where
 * producing no Worker is the correct answer.
 *
 * Candidates are the Function's own staffed Workers when it has any. A Function
 * with no staffing assignments still falls back to the original installation-
 * wide search, so setups that route today keep routing; narrowing that is a
 * separate decision about which Workers a Runtime may claim, not something to
 * change as a side effect of fixing coverage.
 */
export function selectRuntimeWorkerWithCoverage(
  definition: BusinessFunctionDefinition,
  capabilities: readonly WorkerCapability[]
): RuntimeWorkerSelection | undefined {
  const required = [...capabilities];
  const staffed = listStaffingAssignments(definition.id)
    .filter((assignment) => assignment.role === "ai")
    .map((assignment) => getWorker(assignment.workerName))
    .filter(
      (worker): worker is Worker<any, any> =>
        worker !== undefined &&
        (worker.kind === "ai" || worker.kind === "workflow") &&
        isWorkerAvailableForNewTask(worker) && workerBelongsToEnterprise(worker.name, definition.enterpriseId)
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  if (staffed.length === 0) {
    return selectUnstaffedRuntimeWorker(definition, required);
  }

  const fullyCovering = staffed.find((worker) =>
    workerSupportsCapabilities(worker, required)
  );
  if (fullyCovering) {
    return { worker: fullyCovering, unmetCapabilities: [] };
  }

  // A Worker declaring the archetype the Function asks for is the next best
  // signal, ahead of counting capabilities.
  const archetypeMatch = staffed.find(
    (worker) =>
      Boolean(worker.archetype) &&
      definition.requiredArchetypes.includes(worker.archetype!)
  );

  const coverageOf = (candidate: Worker<any, any>): WorkerCapability[] => {
    const held = new Set(candidate.capabilities ?? []);
    return required.filter((capability) => held.has(capability));
  };

  const best = staffed.reduce<RuntimeWorkerSelection | undefined>(
    (chosen, candidate) => {
      const covered = coverageOf(candidate);
      const unmet = required.filter(
        (capability) => !covered.includes(capability)
      );
      return !chosen || covered.length > required.length - chosen.unmetCapabilities.length
        ? { worker: candidate, unmetCapabilities: unmet }
        : chosen;
    },
    undefined
  );

  const missingConsequential = required.filter(isConsequentialCapability);
  if (missingConsequential.length > 0) {
    // Only a Worker that actually holds every consequential capability may
    // take this; otherwise no Worker is the honest answer.
    const authorised = staffed.find((worker) =>
      workerSupportsCapabilities(worker, missingConsequential)
    );
    return authorised
      ? {
          worker: authorised,
          unmetCapabilities: required.filter(
            (capability) => !coverageOf(authorised).includes(capability)
          ),
        }
      : undefined;
  }

  if (archetypeMatch) {
    return {
      worker: archetypeMatch,
      unmetCapabilities: required.filter(
        (capability) => !coverageOf(archetypeMatch).includes(capability)
      ),
    };
  }

  return best;
}

/** Selects an available Worker by declared archetype, then capability. */
export function selectRuntimeWorker(
  definition: BusinessFunctionDefinition,
  capabilities: WorkerCapability[]
): Worker<any, any> | undefined {
  return selectRuntimeWorkerWithCoverage(definition, capabilities)?.worker;
}

/**
 * Selects an available AI Worker from the owning Job's staffing assignments.
 * Scheduled Tasks must use this route so unrelated Workers cannot claim them.
 */
export function selectStaffedRuntimeWorker(
  definition: BusinessFunctionDefinition,
  capabilities: WorkerCapability[]
): Worker<any, any> | undefined {
  return listStaffingAssignments(
    definition.id
  )
    .filter(
      (assignment) =>
        assignment.role === "ai"
    )
    .map(
      (assignment) =>
        getWorker(
          assignment.workerName
        )
    )
    .filter(
      (worker): worker is Worker<any, any> =>
        worker !== undefined &&
        (worker.kind === "ai" || worker.kind === "workflow") &&
        isWorkerAvailableForNewTask(worker) && workerBelongsToEnterprise(worker.name, definition.enterpriseId) &&
        workerSupportsCapabilities(
          worker,
          capabilities
        )
    )
    .sort(
      (left, right) =>
        left.name.localeCompare(
          right.name
        )
    )[0];
}
