// src/repl/askWorkflow.ts

import {
  classifyObjective,
} from "../agents/classifyObjective";

import type {
  ObjectiveClassification,
} from "../agents/objective";

import {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  archetypeRegistry,
  getArchetypeCapabilities,
} from "../agents/archetypeRegistry";

import {
  createWorkflowPlan,
} from "../agents/createWorkflowPlan";

import {
  resolveWorkflowWorkers,
} from "../agents/resolveWorkflowWorkers";

import {
  addWorker,
  createHumanWorker,
  listWorkers,
} from "../control/workers";

import {
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  verboseLog,
} from "../logging/logger";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import type {
  WorkflowPlan,
} from "../agents/workflowPlan";

import {
  createBusinessFunctionRuntimesFromWorkflowPlan,
} from "../business/businessFunctionRuntimeFactory";

import {
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import { resolveConfiguredLlmModel } from "../config/llmConfig";

export type AskWorkflowOptions = {
  readonly autoWorkers: boolean;
  readonly requestArgs: readonly string[];
};

export type AutoCreatedWorker = {
  readonly name: string;
  readonly archetype: AgentArchetype;
  readonly kind: "ai" | "human";
};

export type AskWorkflowResult = {
  readonly request: string;
  readonly objective: ObjectiveClassification;
  readonly originalPlan: WorkflowPlan;
  readonly enforcedPlan: WorkflowPlan;
  readonly workflowRunId: string;
  readonly stepCount: number;
  readonly firstWorkerName: string | undefined;
  /** Retained for API compatibility; semantic planner rewrites are no longer applied. */
  readonly enforcementApplied: false;
  readonly autoWorkers: boolean;
  readonly autoCreatedWorkers: readonly AutoCreatedWorker[];
};

/**
 * Purpose: Converts ask command arguments into a request string.
 *
 * Params:
 * - args: Ask command arguments.
 *
 * Returns:
 * - Trimmed request string.
 *
 * PURE: No side effects.
 */
export function formatAskRequest(
  args: readonly string[]
): string {
  return args
    .join(" ")
    .trim();
}

/**
 * Purpose: Parses /ask workflow options from command arguments.
 *
 * Params:
 * - args: Raw /ask command arguments.
 *
 * Returns:
 * - Parsed ask options and remaining request arguments.
 *
 * PURE: No side effects.
 */
export function parseAskWorkflowOptions(
  args: readonly string[]
): AskWorkflowOptions {
  return {
    autoWorkers: args.includes(
      "--auto-workers"
    ),
    requestArgs: args.filter(
      (arg) => arg !== "--auto-workers"
    ),
  };
}

/**
 * Purpose: Builds a deterministic auto-worker name from an archetype.
 *
 * Params:
 * - archetype: Worker archetype.
 *
 * Returns:
 * - Auto-created worker name.
 *
 * PURE: No side effects.
 */
export function createAutoWorkerName(
  archetype: AgentArchetype
): string {
  return `auto-${archetype}`;
}

/**
 * Purpose: Checks whether a worker for an archetype already exists.
 *
 * Params:
 * - archetype: Required worker archetype.
 *
 * Returns:
 * - True when a worker already exists for that archetype.
 *
 * SIDE EFFECT:
 * - Reads registered workers.
 */
export function hasWorkerForArchetype(
  archetype: AgentArchetype
): boolean {
  return listWorkers().some(
    (worker) => worker.archetype === archetype
  );
}

/**
 * Purpose: Creates a missing worker for a required workflow archetype.
 *
 * Params:
 * - archetype: Required worker archetype.
 *
 * Returns:
 * - Description of the created worker.
 *
 * SIDE EFFECT:
 * - Registers a worker.
 */
export function createWorkerForArchetype(
  archetype: AgentArchetype
): AutoCreatedWorker {
  const name =
    createAutoWorkerName(
      archetype
    );

  if (archetype === "operator") {
    addWorker(
      createHumanWorker(
        name,
        archetype
      )
    );

    return {
      name,
      archetype,
      kind: "human",
    };
  }

  addWorker({
    name,
    kind: "ai",
    archetype,
    model: resolveConfiguredLlmModel(),
    trust: false,
    capabilities: [
      ...getArchetypeCapabilities(
        archetype
      ),
    ],
    run: function* (
      ctx: any
    ) {
      return ctx;
    },
  });

  return {
    name,
    archetype,
    kind: "ai",
  };
}

/**
 * Purpose: Creates missing workers required by a workflow plan.
 *
 * Params:
 * - plan: Workflow plan whose step archetypes should be available.
 * - enabled: Whether auto-worker creation is enabled.
 *
 * Returns:
 * - List of workers created during this call.
 *
 * SIDE EFFECT:
 * - Reads registered workers.
 * - Registers missing workers when enabled.
 */
export function ensureWorkflowWorkersAvailable(
  plan: WorkflowPlan,
  enabled: boolean
): readonly AutoCreatedWorker[] {
  if (!enabled) {
    return [];
  }

  const requiredArchetypes =
    Array.from(
      new Set(
        plan.steps.map(
          (step) => step.archetype as AgentArchetype
        )
      )
    );

  return requiredArchetypes.flatMap(
    (archetype) => {
      if (
        !archetypeRegistry[
          archetype
        ] ||
        hasWorkerForArchetype(
          archetype
        )
      ) {
        return [];
      }

      return [
        createWorkerForArchetype(
          archetype
        ),
      ];
    }
  );
}

/**
 * Purpose: Creates a deterministic business-function workflow plan when available.
 *
 * Params:
 * - request: Original user request.
 * - objective: Classified objective.
 *
 * Returns:
 * - Business-function workflow plan or undefined.
 *
 * PURE: No side effects.
 */
/**
 * Purpose: Creates and stores draft runtime business functions for a workflow run.
 *
 * Params:
 * - workflowRunId: Created workflow run id.
 * - plan: Resolved workflow plan with assigned workers.
 *
 * Returns:
 * - Number of stored business functions.
 *
 * SIDE EFFECT:
 * - Mutates the runtime business function store.
 */
export function storeBusinessFunctionsForWorkflowRun(
  workflowRunId: string,
  plan: ReturnType<typeof resolveWorkflowWorkers>
): number {
  const businessFunctions =
    createBusinessFunctionRuntimesFromWorkflowPlan(
      workflowRunId,
      plan,
      plan.steps.map(
        (step) =>
          step.workerName ?? "unassigned"
      )
    );

  businessFunctions.forEach(
    saveBusinessFunction
  );

  return businessFunctions.length;
}

/**
 * Purpose: Plans an Arturo workflow from an ask request without starting execution.
 *
 * Params:
 * - args: Ask command arguments.
 *
 * Returns:
 * - Structured workflow planning result.
 *
 * SIDE EFFECT:
 * - Parses /ask options.
 * - Calls the objective classifier.
 * - Calls the workflow planner.
 * - Reads registered workers.
 * - Optionally registers missing workers.
 * - Creates a draft workflow run.
 * - Stores draft runtime tasks.
 * - Broadcasts runtime event.
 * - Writes verbose logs when enabled.
 */
export async function planAskWorkflow(
  args: readonly string[]
): Promise<AskWorkflowResult> {
  const options =
    parseAskWorkflowOptions(
      args
    );

  const request =
    formatAskRequest(
      options.requestArgs
    );

  if (!request) {
    throw new Error(
      'Usage: /ask "<request>"'
    );
  }

  const objective =
    await classifyObjective(
      request
    );

  if (!objective.supported) {
    // A blank reason rendered as a bare "Reason" label with nothing after it,
    // and the message offered no way forward — leaving a new operator with a
    // flat rejection and no next step.
    const reason =
      objective.reason?.trim() ||
      "Arturo could not tell what outcome this request is asking for.";

    throw new Error(
      [
        "Arturo cannot help with this request yet.",
        "",
        `Reason: ${reason}`,
        "",
        "Try one of these:",
        "  Describe the outcome you want in one sentence, including what you",
        '  would have at the end — /ask "draft a checklist for quoting a bathroom job"',
        "",
        "  Or set the business up first, so Arturo knows what it is working on:",
        "  /enterprise create --advise",
      ].join("\n")
    );
  }

  const originalPlan =
    await createWorkflowPlan(
      request,
      objective
    );

  const enforcedPlan = originalPlan;

  const autoCreatedWorkers =
    ensureWorkflowWorkersAvailable(
      enforcedPlan,
      options.autoWorkers
    );

  verboseLog(
    JSON.stringify(
      enforcedPlan,
      null,
      2
    )
  );

  const resolvedPlan =
    resolveWorkflowWorkers(
      enforcedPlan,
      listWorkers()
    );

  const draftRun =
    createWorkflowRun(
      resolvedPlan.objective,
      resolvedPlan.explanation,
      "draft",
      resolvedPlan
    );

  storeBusinessFunctionsForWorkflowRun(
    draftRun.id,
    resolvedPlan
  );

  broadcastEvent(
    "workflow.created",
    "success",
    `Workflow drafted: ${draftRun.id}`
  );

  return {
    request,
    objective,
    originalPlan,
    enforcedPlan,
    workflowRunId: draftRun.id,
    stepCount: resolvedPlan.steps.length,
    firstWorkerName: resolvedPlan.steps[0]?.workerName,
    enforcementApplied: false,
    autoWorkers: options.autoWorkers,
    autoCreatedWorkers,
  };
}
