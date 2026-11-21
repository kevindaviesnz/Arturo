import type {
  WorkflowPlan,
  WorkflowStep,
} from "../agents/workflowPlan";

import type {
  BusinessFunction,
  BusinessFunctionPlan,
} from "./businessFunction";

/**
 * Purpose: Builds a concrete workflow instruction for a business function.
 *
 * Params:
 * - businessFunction: Business function to execute.
 * - request: Original user request.
 *
 * Returns:
 * - Workflow step instruction.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionInstruction(
  businessFunction: BusinessFunction,
  request: string
): string {
  return [
    `${businessFunction.label}: ${businessFunction.description}`,
    "",
    `Original business objective: ${request}`,
    "",
    "Produce a concrete business output for this function. Avoid vague summaries.",
  ].join("\n");
}

/**
 * Purpose: Converts business functions into workflow steps.
 *
 * Params:
 * - plan: Business function plan.
 * - request: Original user request.
 *
 * Returns:
 * - Workflow steps using each function's default archetype.
 *
 * PURE: No side effects.
 */
export function createWorkflowStepsFromBusinessFunctions(
  plan: BusinessFunctionPlan,
  request: string
): readonly WorkflowStep[] {
  return plan.functions.map(
    (businessFunction) => ({
      archetype:
        businessFunction.defaultArchetype,
      instruction:
        createBusinessFunctionInstruction(
          businessFunction,
          request
        ),
    })
  );
}

/**
 * Purpose: Creates a workflow plan from a business function plan.
 *
 * Params:
 * - plan: Business function plan.
 * - request: Original user request.
 *
 * Returns:
 * - Workflow plan representing business functions.
 *
 * PURE: No side effects.
 */
export function createWorkflowPlanFromBusinessFunctions(
  plan: BusinessFunctionPlan,
  request: string
): WorkflowPlan {
  return {
    objective:
      request,
    explanation:
      `Created a business-function workflow for ${plan.businessPatternId}.`,
    steps:
      [
        ...createWorkflowStepsFromBusinessFunctions(
          plan,
          request
        ),
      ],
  };
}