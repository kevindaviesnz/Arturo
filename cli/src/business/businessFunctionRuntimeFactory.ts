import type {
  WorkflowStep,
} from "../agents/workflowPlan";

import type {
  WorkflowExecutionPlan,
} from "../agents/workflowExecution";

import {
  createBusinessFunctionRuntime,
  type BusinessFunctionRuntime,
} from "./businessFunctionRuntime";

/**
 * Purpose: Extracts a business function label from a workflow step instruction.
 *
 * Params:
 * - step: Workflow step.
 * - index: Zero-based fallback index.
 *
 * Returns:
 * - Business function label.
 *
 * PURE: No side effects.
 */
export function getBusinessFunctionLabelFromStep(
  step: WorkflowStep,
  index: number
): string {
  const [
    label,
  ] =
    step.instruction.split(
      ":"
    );

  const trimmed =
    label?.trim();

  return trimmed && trimmed.length > 0
    ? trimmed
    : `Workflow step ${index + 1}`;
}

/**
 * Purpose: Creates a stable business function id for a workflow run step.
 *
 * Params:
 * - workflowRunId: Workflow run id.
 * - index: Zero-based step index.
 *
 * Returns:
 * - Business function runtime id.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionRuntimeId(
  workflowRunId: string,
  index: number
): string {
  return `${workflowRunId}:function-${index + 1}`;
}

/**
 * Purpose: Converts workflow steps into draft runtime business functions.
 *
 * Params:
 * - workflowRunId: Workflow run id.
 * - plan: Workflow plan.
 * - ownerWorkers: Resolved worker names by step index.
 *
 * Returns:
 * - Runtime business functions.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionRuntimesFromWorkflowPlan(
  workflowRunId: string,
  plan: WorkflowExecutionPlan,
  ownerWorkers: readonly string[]
): readonly BusinessFunctionRuntime[] {
  return plan.steps.map(
    (step, index) =>
      createBusinessFunctionRuntime({
        id:
          createBusinessFunctionRuntimeId(
            workflowRunId,
            index
          ),
        label:
          getBusinessFunctionLabelFromStep(
            step,
            index
          ),
        objective:
          step.instruction,
        ownerWorker:
          ownerWorkers[index] ?? "unassigned",
      })
  );
}
