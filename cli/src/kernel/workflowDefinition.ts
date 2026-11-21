/**
 * A single deterministic workflow step.
 */
export type WorkflowStepDefinition = {
  id: string;
  capability: string;
};

/**
 * A deterministic workflow definition.
 */
export type WorkflowDefinition = {
  id: string;
  name: string;
  steps: WorkflowStepDefinition[];
};

/**
 * Creates a deterministic workflow definition.
 *
 * @param id Stable workflow id.
 * @param name Human-readable workflow name.
 * @param steps Ordered workflow steps.
 * @returns Workflow definition.
 *
 * PURE: No side effects.
 */
export function createWorkflowDefinition(
  id: string,
  name: string,
  steps: WorkflowStepDefinition[]
): WorkflowDefinition {
  return {
    id,
    name,
    steps: [...steps],
  };
}

/**
 * Creates a workflow registry map indexed by workflow id.
 *
 * @param workflows Workflow definitions.
 * @returns Immutable workflow registry.
 *
 * PURE: No side effects.
 */
export function createWorkflowRegistry(
  workflows: WorkflowDefinition[]
): Record<string, WorkflowDefinition> {
  return workflows.reduce<
    Record<string, WorkflowDefinition>
  >(
    (accumulator, workflow) => ({
      ...accumulator,
      [workflow.id]: workflow,
    }),
    {}
  );
}

/**
 * Lists workflow definitions from a registry.
 *
 * @param registry Workflow registry.
 * @returns Workflow definitions.
 *
 * PURE: No side effects.
 */
export function listWorkflowDefinitions(
  registry: Record<
    string,
    WorkflowDefinition
  >
): WorkflowDefinition[] {
  return Object.values(registry);
}

/**
 * Gets a workflow definition by id.
 *
 * @param registry Workflow registry.
 * @param id Workflow id.
 * @returns Workflow definition or undefined.
 *
 * PURE: No side effects.
 */
export function getWorkflowDefinition(
  registry: Record<
    string,
    WorkflowDefinition
  >,
  id: string
): WorkflowDefinition | undefined {
  return registry[id];
}