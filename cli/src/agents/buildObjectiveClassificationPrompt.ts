import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
/**
 * Purpose: Builds a prompt for classifying a user request into an Arturo objective.
 *
 * Params:
 * - request: Raw user request.
 *
 * Returns:
 * - Objective classification prompt.
 *
 * PURE: No side effects.
 */
export function buildObjectiveClassificationPrompt(
  request: string
): string {
  return renderEnterprisePrompt("Objective Classification", {
    REQUEST: request
  });
}