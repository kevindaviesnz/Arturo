import type {
  WorkerGenerator,
} from "./process";

import type {
  WorkflowDefinition,
} from "./workflowDefinition";

/**
 * Runs a deterministic workflow definition as a kernel generator.
 *
 * Each step yields a capability call. The output from one step becomes
 * the input to the next step.
 *
 * @param workflow Workflow definition to execute.
 * @param initialInput Initial workflow input.
 * @returns Final workflow result.
 *
 * PURE: No side effects until interpreted by the kernel scheduler.
 */
export function* runWorkflowDefinition(
  workflow: WorkflowDefinition,
  initialInput: any
): WorkerGenerator<any, any> {
  let current =
    initialInput;

  for (const step of workflow.steps) {
    current =
      yield {
        type: "call",
        capability:
          step.capability,
        input:
          current,
      };
  }

  return current;
}