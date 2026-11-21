import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import {
  OUTPUT_BOUNDARIES,
} from "./outputBoundaries";

/**
 * Creates a labelled text section.
 *
 * @param title Section title.
 * @param content Section content.
 * @returns Formatted section.
 *
 * PURE: No side effects.
 */
export function createPromptSection(
  title: string,
  content: string
): string {
  return [
    `${title}:`,
    "",
    content.trim(),
  ].join("\n");
}

/**
 * Creates review-loop decision instructions for a decision worker.
 *
 * @param attempt Current review-loop attempt number.
 * @param reviewFocus Criteria the decision worker should use.
 * @returns JSON-only decision instructions.
 *
 * PURE: No side effects.
 */
export function createReviewLoopDecisionInstructions(
  attempt: number,
  reviewFocus = "the task requirements"
): string {
  return [
    "You are the review-loop decision worker.",
    "",
    "Your response must be JSON only.",
    "Do not include markdown.",
    "Do not include prose outside the JSON object.",
    "",
    "Important distinction:",
    "The JSON-only rule applies only to your review decision.",
    "Do not require the previous worker output to be JSON unless the original task explicitly required JSON.",
    "Judge the previous worker output against the review criteria below.",
    "",
    "Review criteria:",
    reviewFocus,
    "",
    "Approval schema:",
    JSON.stringify(
      {
        decision:
          "approved",
        reason:
          "short explanation",
        confidence:
          "low|medium|high",
      },
      null,
      2
    ),
    "",
    "Rejection schema:",
    JSON.stringify(
      {
        decision:
          "rejected",
        reason:
          "short explanation",
        requiredRevisions: [
          "revision 1",
          "revision 2",
        ],
        confidence:
          "low|medium|high",
      },
      null,
      2
    ),
    "",
    `Current attempt: ${attempt}`,
    "",
    "Decision rule:",
    attempt === 1
      ? "For attempt 1, reject unless the previous worker output clearly satisfies the review criteria."
      : "For attempt 2 or later, approve only if the required revisions have been clearly addressed and the previous worker output satisfies the review criteria. Otherwise reject again with specific required revisions.",
  ].join("\n");
}

/**
 * Creates the prompt passed
 * to the next worker.
 *
 * @param instruction Worker instruction.
 * @param previousOutput Previous worker output.
 * @param workflowContext Optional workflow context.
 * @param reviewLoopDecisionInstructions Optional JSON-only decision instructions.
 * @returns Worker prompt.
 *
 * PURE: No side effects.
 */
export function buildWorkflowStepPrompt(
  instruction: string,
  previousOutput: string,
  workflowContext = "",
  reviewLoopDecisionInstructions = ""
): string {
  return renderEnterprisePrompt("Workflow Step Execution", {
    INSTRUCTION: instruction,
    PREVIOUS_OUTPUT: previousOutput.trim() ? createPromptSection("Previous step output", previousOutput) : "",
    WORKFLOW_CONTEXT: workflowContext.trim() ? createPromptSection("Workflow context", workflowContext) : "",
    REVIEW_INSTRUCTIONS: reviewLoopDecisionInstructions.trim()
      ? createPromptSection("Review-loop decision instructions", reviewLoopDecisionInstructions) : "",
    OUTPUT_BOUNDARIES,
  });
}
