import type {
  AgentArchetype,
} from "./agentArchetype";

import {
  archetypeRegistry,
} from "./archetypeRegistry";

import type {
  WorkflowPlan,
  WorkflowStep,
} from "./workflowPlan";

/**
 * Checks whether a value is a valid archetype.
 *
 * @param value Unknown value.
 * @returns True when value is a valid archetype.
 *
 * PURE: No side effects.
 */
export function isWorkflowArchetype(
  value: unknown
): value is AgentArchetype {
  return (
    typeof value === "string" &&
    value in archetypeRegistry
  );
}

/**
 * Checks whether instruction text contains
 * a final publication or release action.
 *
 * @param instruction Step instruction.
 * @returns True when instruction implies final publication/release.
 *
 * PURE: No side effects.
 */
export function instructionRequiresPublicationControl(
  instruction: string
): boolean {
  const normalized =
    instruction.toLowerCase();

  const planningSafePattern =
    /\b(plan|planning|strategy|draft|create|prepare|research|review|analyze|analyse|outline)\b.{0,40}\b(launch|release|publication|go\s*live)\b|\b(launch|release|publication|go\s*live)\b.{0,40}\b(plan|planning|strategy|draft|outline|research|review)\b/i;

  if (
    planningSafePattern.test(
      normalized
    )
  ) {
    return false;
  }

  return /\b(publish|publishing|publication|release|launch|go\s*live|sign\s*off|final\s*approval|approve\s*final|approve.*publication)\b/i.test(
    normalized
  );
}

/**
 * Checks whether a workflow step violates publication policy.
 *
 * @param step Workflow step.
 * @returns True when the step violates publication policy.
 *
 * PURE: No side effects.
 */
export function violatesPublicationPolicy(
  step: WorkflowStep
): boolean {
  return (
    step.archetype !== "operator" &&
    instructionRequiresPublicationControl(
      step.instruction
    )
  );
}

/**
 * Validates workflow policy rules.
 *
 * @param plan Workflow plan.
 * @returns void
 *
 * PURE: No side effects.
 */
export function validateWorkflowPolicies(
  plan: WorkflowPlan
): void {
  const invalidStep =
    plan.steps.find(
      violatesPublicationPolicy
    );

  if (invalidStep) {
    throw new Error(
      [
        "Invalid workflow policy.",
        "",
        "Only the operator archetype may publish, release, launch, sign off, or approve final output.",
        "",
        `Invalid archetype: ${invalidStep.archetype}`,
        `Invalid instruction: ${invalidStep.instruction}`,
      ].join("\n")
    );
  }
}

/**
 * Checks whether a value is a valid workflow step.
 *
 * @param value Unknown value.
 * @returns True when value is a valid workflow step.
 *
 * PURE: No side effects.
 */
export function isWorkflowStep(
  value: unknown
): value is WorkflowStep {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Partial<WorkflowStep>;

  return (
    isWorkflowArchetype(
      candidate.archetype
    ) &&
    typeof candidate.instruction === "string" &&
    candidate.instruction.trim().length > 0
  );
}

/**
 * Formats an invalid workflow step for diagnostic output.
 *
 * @param index Zero-based step index.
 * @param step Invalid step value.
 * @returns Human-readable validation error.
 *
 * PURE: No side effects.
 */
export function formatInvalidWorkflowStepError(
  index: number,
  step: unknown
): string {
  return [
    `Invalid workflow step at index ${index}`,
    "",
    "Step:",
    JSON.stringify(
      step,
      null,
      2
    ),
  ].join("\n");
}

/**
 * Parses optional planner explanation.
 *
 * @param value Unknown explanation value.
 * @returns Explanation or undefined.
 *
 * PURE: No side effects.
 */
export function parsePlannerExplanation(
  value: unknown
): string | undefined {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return undefined;
  }

  return value.trim();
}

/**
 * Parses and validates raw workflow plan JSON.
 *
 * @param raw Raw JSON text.
 * @returns Valid workflow plan.
 *
 * PURE: No side effects.
 */
export function parseWorkflowPlan(
  raw: string
): WorkflowPlan {
  const parsed =
    JSON.parse(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null
  ) {
    throw new Error(
      "Invalid workflow plan"
    );
  }

  if (
    typeof parsed.objective !== "string" ||
    parsed.objective.trim().length === 0
  ) {
    throw new Error(
      "Invalid workflow objective"
    );
  }

  if (
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0
  ) {
    throw new Error(
      "Invalid workflow steps"
    );
  }

  for (
    let index = 0;
    index < parsed.steps.length;
    index += 1
  ) {
    const step =
      parsed.steps[index];

    if (
      !isWorkflowStep(
        step
      )
    ) {
      throw new Error(
        formatInvalidWorkflowStepError(
          index,
          step
        )
      );
    }
  }

  const plan: WorkflowPlan = {
    objective:
      parsed.objective.trim(),

    explanation:
      parsePlannerExplanation(
        parsed.explanation
      ),

    steps:
      parsed.steps.map(
        (step: WorkflowStep) => ({
          archetype:
            step.archetype,

          instruction:
            step.instruction.trim(),
        })
      ),
  };

  validateWorkflowPolicies(
    plan
  );

  return plan;
}