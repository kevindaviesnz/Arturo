import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
/**
 * Builds the coordinator classification prompt.
 *
 * @param request User request.
 * @returns Prompt.
 *
 * PURE: No side effects.
 */
export function buildArchetypeClassificationPrompt(
  request: string
): string {
  return renderEnterprisePrompt("Worker Archetype Selection", {
    REQUEST: request
  });
}