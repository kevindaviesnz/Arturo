import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import type {
  ObjectiveClassification,
} from "./objective";

/**
 * Purpose: Formats business-pattern-specific planner guidance.
 *
 * Params:
 * - objective: Optional objective classification.
 *
 * Returns:
 * - Business-pattern-specific planning rules.
 *
 * PURE: No side effects.
 */
export function formatBusinessPatternPlanningRules(
  objective?: ObjectiveClassification
): string {
  if (!objective?.businessPattern || objective.businessPattern === "Unknown") {
    return "";
  }

  return [
    `Business pattern context: ${objective.businessPattern}`,
    "",
    "Use the business pattern only as context. Infer the smallest relevant workflow from the user's stated objective.",
    "Do not add generic commercial, legal, research, safety, or operational steps unless the request or available evidence warrants them.",
    "Each selected instruction must name a concrete expected output.",
  ].join("\n");
}
/**
 * Purpose: Formats objective classification context for workflow planning.
 *
 * Params:
 * - objective: Optional objective classification.
 *
 * Returns:
 * - Planner context text.
 *
 * PURE: No side effects.
 */
export function formatObjectivePlanningContext(
  objective?: ObjectiveClassification
): string {
  if (!objective) {
    return "";
  }

  return [
    "Objective classification:",
    "",
    `- description: ${objective.description}`,
    `- type: ${objective.type}`,
    `- lifetime: ${objective.lifetime}`,
    `- business pattern: ${objective.businessPattern}`,
    `- supported: ${objective.supported ? "yes" : "no"}`,
    `- reason: ${objective.reason}`,
    ...(objective.intent
      ? [
          "",
          "Resolved intent:",
          "",
          `- normalized intent: ${objective.intent.normalizedIntent}`,
          `- intent type: ${objective.intent.intentType}`,
          `- business pattern id: ${objective.intent.businessPatternId}`,
          `- confidence: ${objective.intent.confidence}`,
          `- needs clarification: ${
            objective.intent.needsClarification ? "yes" : "no"
          }`,
        ]
      : []),
    "",
    "Use this classification to choose the appropriate workflow shape.",
    "Large create/operate objectives may require broader planning than simple content-generation tasks.",
  ].join("\n");
}

/**
 * Builds planner prompt.
 *
 * @param request User request.
 * @param objective Optional objective classification.
 * @returns Planner prompt.
 *
 * PURE: No side effects.
 */
export function buildWorkflowPlanPrompt(
  request: string,
  objective?: ObjectiveClassification
): string {
  return renderEnterprisePrompt("Workflow Planning", {
    OBJECTIVE_CONTEXT: formatObjectivePlanningContext(
  objective
),
    BUSINESS_PATTERN_GUIDANCE: formatBusinessPatternPlanningRules(
  objective
),
    REQUEST: request
  });
}
