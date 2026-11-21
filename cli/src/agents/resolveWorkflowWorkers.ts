import { isWorkerAvailableForNewTask } from "../control/workers";
import type {
  Worker,
} from "../control/workers";

import type {
  AgentArchetype,
} from "./agentArchetype";

import type {
  WorkflowPlan,
  WorkflowStep,
} from "./workflowPlan";

import type {
  WorkflowExecutionPlan,
} from "./workflowExecution";

/**
 * Checks whether instruction text explicitly names a worker.
 *
 * @param instruction Step instruction.
 * @param worker Worker to check.
 * @returns True when the instruction contains the worker name or display name.
 *
 * PURE: No side effects.
 */
export function instructionMentionsWorker(
  instruction: string,
  worker: Worker<any, any>
): boolean {
  const normalizedInstruction =
    instruction.toLowerCase();

  const names =
    [
      worker.name,
      worker.displayName,
    ].filter(
      (name): name is string =>
        typeof name === "string" &&
        name.trim().length > 0
    );

  return names.some(
    (name) =>
      normalizedInstruction.includes(
        name.toLowerCase()
      )
  );
}

/**
 * Finds a registered worker explicitly named in a workflow step.
 *
 * @param step Workflow step.
 * @param workers Registered workers.
 * @returns Matching worker or undefined.
 *
 * PURE: No side effects.
 */
export function findExplicitWorkerForStep(
  step: WorkflowStep,
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  return workers.find(
    (worker) =>
      isWorkerAvailableForNewTask(worker) && instructionMentionsWorker(
        step.instruction,
        worker
      )
  );
}

/**
 * Checks whether a worker is the default system-created operator.
 *
 * @param worker Worker to inspect.
 * @returns True when the worker is the default operator.
 *
 * PURE: No side effects.
 */
export function isDefaultOperatorWorker(
  worker: Worker<any, any>
): boolean {
  return (
    worker.name === "operator" &&
    worker.kind === "human" &&
    worker.archetype === "operator"
  );
}

/**
 * Finds a human operator worker.
 *
 * User-created human operators are preferred over the default operator.
 *
 * @param workers Registered workers.
 * @returns Human operator worker or undefined.
 *
 * PURE: No side effects.
 */
export function findHumanOperatorWorker(
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  const humanOperators =
    workers.filter(
      (worker) =>
        isWorkerAvailableForNewTask(worker) && worker.kind === "human" &&
        worker.archetype === "operator"
    );

  return (
    humanOperators.find(
      (worker) =>
        !isDefaultOperatorWorker(
          worker
        )
    ) ??
    humanOperators[0]
  );
}

/**
 * Finds any registered operator worker.
 *
 * @param workers Registered workers.
 * @returns Operator worker or undefined.
 *
 * PURE: No side effects.
 */
export function findAnyOperatorWorker(
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  return workers.find(
    (worker) =>
      isWorkerAvailableForNewTask(worker) && worker.archetype === "operator"
  );
}

/**
 * Finds the best operator worker.
 *
 * Human operators are preferred because operator steps usually represent
 * real-world human work rather than AI-generated work.
 *
 * @param workers Registered workers.
 * @returns Best operator worker or undefined.
 *
 * PURE: No side effects.
 */
export function findBestOperatorWorker(
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  return (
    findHumanOperatorWorker(
      workers
    ) ??
    findAnyOperatorWorker(
      workers
    )
  );
}

/**
 * Finds the first worker matching a workflow step archetype.
 *
 * Operator steps are resolved to a registered operator worker instead of a
 * hardcoded system worker name.
 *
 * @param step Workflow step.
 * @param workers Registered workers.
 * @returns Matching worker or undefined.
 *
 * PURE: No side effects.
 */
export function findWorkerForArchetype(
  step: WorkflowStep,
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  if (
    step.archetype === "operator"
  ) {
    return findBestOperatorWorker(
      workers
    );
  }

  return workers.find(
    (candidate) =>
      isWorkerAvailableForNewTask(candidate) && candidate.archetype ===
      step.archetype
  );
}

/**
 * Finds the worker that should satisfy a workflow step.
 *
 * Operator steps must resolve to a human operator. This prevents copied
 * original-request text such as "Planner AI prepares..." from accidentally
 * routing a human task step back to an AI worker.
 *
 * @param step Workflow step.
 * @param workers Registered workers.
 * @returns Resolved worker or undefined.
 *
 * PURE: No side effects.
 */
export function findWorkerForStep(
  step: WorkflowStep,
  workers: Worker<any, any>[]
): Worker<any, any> | undefined {
  if (
    step.archetype === "operator"
  ) {
    return findBestOperatorWorker(
      workers
    );
  }

  return (
    findExplicitWorkerForStep(
      step,
      workers
    ) ??
    findWorkerForArchetype(
      step,
      workers
    )
  );
}

/**
 * Returns missing planner-selected archetypes.
 *
 * @param plan Planner-created workflow plan.
 * @param workers Registered workers.
 * @returns Archetypes without a registered worker.
 *
 * PURE: No side effects.
 */
export function findMissingWorkflowArchetypes(
  plan: WorkflowPlan,
  workers: Worker<any, any>[]
): AgentArchetype[] {
  return Array.from(
    new Set(
      plan.steps
        .filter(
          (step) =>
            !findWorkerForStep(
              step,
              workers
            )
        )
        .map(
          (step) =>
            step.archetype
        )
    )
  ) as AgentArchetype[];
}

/**
 * Formats missing worker setup guidance for an archetype.
 *
 * @param archetype Missing archetype.
 * @returns Suggested command.
 *
 * PURE: No side effects.
 */
export function formatMissingWorkerCommand(
  archetype: AgentArchetype
): string {
  if (
    archetype === "operator"
  ) {
    return `  /add-human-worker "<the person's name>" ${archetype}`;
  }

  return `  /add-ai-worker "<what this Worker is for>" ${archetype}`;
}

/**
 * Resolves one workflow step into a concrete worker.
 *
 * Operator steps always resolve through operator-worker selection so human
 * work cannot accidentally be assigned to an AI worker mentioned in the text.
 *
 * @param step Workflow step.
 * @param workers Registered workers.
 * @returns Resolved worker name and archetype.
 *
 * PURE: No side effects.
 */
export function resolveWorkflowStepWorker(
  step: WorkflowStep,
  workers: Worker<any, any>[]
): {
  readonly archetype: AgentArchetype;
  readonly workerName: string;
  readonly instruction: string;
} {
  const worker =
    findWorkerForStep(
      step,
      workers
    );

  if (!worker) {
    throw new Error(
      `No worker registered for archetype: ${step.archetype}`
    );
  }

  return {
    archetype:
      step.archetype,

    workerName:
      worker.name,

    instruction:
      step.instruction,
  };
}

/**
 * Resolves a planner workflow into concrete workers.
 *
 * @param plan Planner-created workflow plan.
 * @param workers Registered workers.
 * @returns Executable workflow plan.
 *
 * PURE: No side effects.
 */
export function resolveWorkflowWorkers(
  plan: WorkflowPlan,
  workers: Worker<any, any>[]
): WorkflowExecutionPlan {
  const missing =
    findMissingWorkflowArchetypes(
      plan,
      workers
    );

  if (missing.length > 0) {
    throw new Error(
      [
        "Planner created a workflow, but some required workers are missing.",
        "",
        "Missing archetypes:",
        ...missing.map(
          (archetype) =>
            `- ${archetype}`
        ),
        "",
        // Listing /add-ai-worker per archetype was the first thing an operator
        // saw, and following it produced Workers named after archetypes and
        // attached to no Function. /staff covers the Functions properly and
        // names Workers after the role they perform.
        "Run /staff to cover this Enterprise's Functions, which creates the",
        "Workers these steps need and assigns them.",
        "",
        "To add one Worker directly instead, name it after the role it performs:",
        ...missing.map(
          formatMissingWorkerCommand
        ),
      ].join("\n")
    );
  }

  return {
    objective:
      plan.objective,

    explanation:
      plan.explanation,

    steps:
      plan.steps.map(
        (step) =>
          resolveWorkflowStepWorker(
            step,
            workers
          )
      ),
  };
}