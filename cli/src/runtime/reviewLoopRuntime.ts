import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import type {
  Job,
  ReviewLoopJobMetadata,
} from "./jobQueue";

import type {
  RejectedReviewLoopDecision,
  ReviewLoopDecision,
} from "./reviewLoopDecision";

/**
 * Returns whether a review-loop decision rejects the current output.
 *
 * @param decision Parsed review-loop decision.
 * @returns True when the decision is rejected.
 *
 * PURE: No side effects.
 */
export function isRejectedReviewLoopDecision(
  decision: ReviewLoopDecision | undefined
): decision is RejectedReviewLoopDecision {
  return decision?.decision === "rejected";
}

/**
 * Returns whether a review-loop decision approves the current output.
 *
 * @param decision Parsed review-loop decision.
 * @returns True when the decision is approved.
 *
 * PURE: No side effects.
 */
export function isApprovedReviewLoopDecision(
  decision: ReviewLoopDecision | undefined
): boolean {
  return decision?.decision === "approved";
}

/**
 * Returns whether a rejected review loop may continue.
 *
 * @param metadata Review-loop metadata.
 * @returns True when another revision attempt is allowed.
 *
 * PURE: No side effects.
 */
export function canContinueReviewLoop(
  metadata: ReviewLoopJobMetadata
): boolean {
  return metadata.attempt < metadata.maxAttempts;
}

/**
 * Creates review-loop metadata for the next revision attempt.
 *
 * @param metadata Current review-loop metadata.
 * @returns Metadata for the next attempt.
 *
 * PURE: No side effects.
 */
export function createNextReviewLoopMetadata(
  metadata: ReviewLoopJobMetadata
): ReviewLoopJobMetadata {
  return {
    ...metadata,
    attempt:
      metadata.attempt + 1,
  };
}

/**
 * Formats required revisions as bullet points.
 *
 * @param revisions Required revision strings.
 * @returns Human-readable bullet list.
 *
 * PURE: No side effects.
 */
export function formatRequiredRevisions(
  revisions: readonly string[]
): string {
  return revisions
    .map(
      (revision) =>
        `- ${revision}`
    )
    .join("\n");
}

/**
 * Gets the best available completed job output.
 *
 * @param job Completed job.
 * @returns Output text.
 *
 * PURE: No side effects.
 */
export function getCompletedJobOutput(
  job: Job
): string {
  return (
    job.output ??
    job.rawOutput ??
    ""
  );
}

/**
 * Extracts the final output block from noisy worker output.
 *
 * @param output Raw or formatted worker output.
 * @returns Final output block.
 *
 * PURE: No side effects.
 */
export function extractFinalReviewLoopOutputBlock(
  output: string
): string {
  const marker =
    "Output:";

  const index =
    output.lastIndexOf(
      marker
    );

  if (index < 0) {
    return output.trim();
  }

  return output
    .slice(
      index + marker.length
    )
    .trim();
}

/**
 * Builds the prompt for a review-loop revision job.
 *
 * @param originalObjective Original workflow objective.
 * @param rejectedJob Job containing the rejected draft output.
 * @param decision Rejection decision.
 * @returns Revision prompt.
 *
 * PURE: No side effects.
 */
export function buildReviewLoopRevisionPrompt(
  originalObjective: string,
  rejectedJob: Job,
  decision: RejectedReviewLoopDecision
): string {
  const previousOutput =
    extractFinalReviewLoopOutputBlock(
      getCompletedJobOutput(
        rejectedJob
      )
    );

return renderEnterprisePrompt("Review Rejection Revision", {
    ORIGINAL_OBJECTIVE: originalObjective,
    PREVIOUS_OUTPUT: previousOutput,
    REJECTION_REASON: decision.reason,
    REQUIRED_REVISIONS: formatRequiredRevisions(
      decision.requiredRevisions
    )
  });
}

/**
 * Builds routing metadata for the next review-loop revision job.
 *
 * @param metadata Current review-loop metadata.
 * @returns Routing metadata for the next revision job.
 *
 * PURE: No side effects.
 */
export function buildReviewLoopRevisionRouting(
  metadata: ReviewLoopJobMetadata
): {
  readonly reviewLoop: ReviewLoopJobMetadata;
} {
  return {
    reviewLoop:
      createNextReviewLoopMetadata(
        metadata
      ),
  };
}