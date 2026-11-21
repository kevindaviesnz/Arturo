import type {
  WorkflowPlan,
} from "../agents/workflowPlan";

export type WorkflowMode =
  | "worker"
  | "capability"
  | "planned";

export type WorkerWorkflow = {
  readonly name: string;
  readonly steps: readonly string[];
  readonly mode: "worker";
};

export type CapabilityWorkflow = {
  readonly name: string;
  readonly steps: readonly string[];
  readonly mode: "capability";
};

export type PlannedWorkflow = {
  readonly name: string;
  readonly mode: "planned";
  readonly objective: string;
  readonly explanation?: string;
  readonly steps: WorkflowPlan["steps"];
};

export type Workflow =
  | WorkerWorkflow
  | CapabilityWorkflow
  | PlannedWorkflow;

const workflows: Record<
  string,
  Workflow
> = {};

/**
 * Creates or replaces a worker-based workflow definition.
 *
 * @param name Workflow name.
 * @param steps Ordered worker step names.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory workflow registry.
 */
export function createWorkflow(
  name: string,
  steps: readonly string[]
): void {
  workflows[name] = {
    name,
    steps: [
      ...steps,
    ],
    mode: "worker",
  };
}

/**
 * Creates or replaces a capability-based workflow definition.
 *
 * @param name Workflow name.
 * @param capabilities Ordered capability step names.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory workflow registry.
 */
export function createCapabilityWorkflow(
  name: string,
  capabilities: readonly string[]
): void {
  workflows[name] = {
    name,
    steps: [
      ...capabilities,
    ],
    mode: "capability",
  };
}

/**
 * Creates or replaces an AI-planned workflow definition.
 *
 * @param name Workflow name.
 * @param plan Generated workflow plan.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory workflow registry.
 */
export function createPlannedWorkflow(
  name: string,
  plan: WorkflowPlan
): void {
  workflows[name] = {
    name,
    mode: "planned",
    objective: plan.objective,
    explanation: plan.explanation,
    steps: [
      ...plan.steps,
    ],
  };
}

/**
 * Looks up a workflow by name.
 *
 * @param name Workflow name.
 * @returns Workflow definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads from the in-memory workflow registry.
 */
export function getWorkflow(
  name: string
): Workflow | undefined {
  return workflows[name];
}

/**
 * Lists all workflow definitions.
 *
 * @returns Array of workflow definitions.
 *
 * SIDE EFFECT:
 * - Reads from the in-memory workflow registry.
 */
export function listWorkflows():
  Workflow[] {
  return Object.values(
    workflows
  );
}

/**
 * Clears all workflow definitions.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory workflow registry.
 */
export function clearWorkflows():
  void {
  for (const key of Object.keys(
    workflows
  )) {
    delete workflows[key];
  }
}