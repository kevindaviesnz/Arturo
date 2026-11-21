import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import {
  generateWithOllama,
} from "../llm/ollamaClient";

import type {
  WorkflowPlan,
} from "./workflowPlan";

import {
  buildWorkflowPlanPrompt,
} from "./buildWorkflowPlanPrompt";

import {
  parseWorkflowPlan,
} from "./workflowPlanValidation";

import type {
  ObjectiveClassification,
} from "./objective";
import { resolveConfiguredLlmModel } from "../config/llmConfig";

/** Removes an optional Markdown fence around a model JSON response. */
function stripMarkdownFences(
  text: string
): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Builds a repair request without deciding the workflow's semantic content. */
function buildWorkflowPlanRepairPrompt(
  raw: string,
  error: unknown,
  request: string
): string {
  return renderEnterprisePrompt("Workflow Plan Repair", {
    VALIDATION_ERROR: error instanceof Error ? error.message : String(error),
    REQUEST: request,
    INVALID_RESPONSE: raw
  });
}

/** Rejects a structurally valid but non-executable operator-only plan. */
function validateExecutablePlan(
  plan: WorkflowPlan
): WorkflowPlan {
  if (
    plan.steps.length === 1 &&
    plan.steps[0]?.archetype === "operator"
  ) {
    throw new Error(
      "Invalid planner output: operator-only workflow cannot execute autonomous work."
    );
  }

  return plan;
}

/** Creates a model-planned workflow and applies structural validation only. */
export async function createWorkflowPlan(
  request: string,
  objective?: ObjectiveClassification
): Promise<WorkflowPlan> {
  const result = await generateWithOllama({
    model: resolveConfiguredLlmModel(),
    prompt: buildWorkflowPlanPrompt(
      request,
      objective
    ),
  });

  const raw = stripMarkdownFences(
    result.response
  );

  try {
    return validateExecutablePlan(
      parseWorkflowPlan(raw)
    );
  } catch (error) {
    const repaired = await generateWithOllama({
      model: resolveConfiguredLlmModel(),
      prompt: buildWorkflowPlanRepairPrompt(
        raw,
        error,
        request
      ),
    });

    return validateExecutablePlan(
      parseWorkflowPlan(
        stripMarkdownFences(
          repaired.response
        )
      )
    );
  }
}
