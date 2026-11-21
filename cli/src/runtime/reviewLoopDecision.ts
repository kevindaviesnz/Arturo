export type ReviewLoopConfidence =
  | "low"
  | "medium"
  | "high";

export type ApprovedReviewLoopDecision = {
  readonly decision: "approved";
  readonly reason: string;
  readonly confidence: ReviewLoopConfidence;
};

export type RejectedReviewLoopDecision = {
  readonly decision: "rejected";
  readonly reason: string;
  readonly requiredRevisions: readonly string[];
  readonly confidence: ReviewLoopConfidence;
};

export type ReviewLoopDecision =
  | ApprovedReviewLoopDecision
  | RejectedReviewLoopDecision;

/**
 * Checks whether a value is a valid review-loop confidence.
 *
 * @param value Value to check.
 * @returns True when the value is a valid confidence.
 *
 * PURE: No side effects.
 */
export function isReviewLoopConfidence(
  value: unknown
): value is ReviewLoopConfidence {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high"
  );
}

/**
 * Checks whether a value is a string array.
 *
 * @param value Value to check.
 * @returns True when the value is an array of strings.
 *
 * PURE: No side effects.
 */
export function isStringArray(
  value: unknown
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string"
    )
  );
}

/**
 * Extracts the final likely JSON object from text.
 *
 * This is designed for model output that may echo the prompt before returning
 * the final JSON decision. The final JSON object is the one we want.
 * If the final JSON object is missing one closing brace, it repairs it.
 *
 * @param output Raw worker output.
 * @returns JSON object text or undefined.
 *
 * PURE: No side effects.
 */
export function extractFirstJsonObjectText(
  output: string
): string | undefined {
  const lastOpen =
    output.lastIndexOf("{");

  if (lastOpen < 0) {
    return undefined;
  }

  const afterLastOpen =
    output.slice(
      lastOpen
    );

  const lastClose =
    afterLastOpen.lastIndexOf("}");

  if (lastClose >= 0) {
    return afterLastOpen.slice(
      0,
      lastClose + 1
    );
  }

  return `${afterLastOpen.trim()}\n}`;
}
/**
 * Parses a JSON object from worker output.
 *
 * This accepts either pure JSON or noisy model output containing a JSON object.
 * If the model omits one final closing brace, the extracted JSON is repaired.
 *
 * @param output Raw worker output.
 * @returns Parsed JSON object or undefined.
 *
 * PURE: No side effects.
 */
export function parseJsonObject(
  output: string
): Record<string, unknown> | undefined {
  const jsonText =
    extractFirstJsonObjectText(
      output
    );

  if (!jsonText) {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(
        jsonText
      );

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Parses a review-loop decision from worker output.
 *
 * @param output Raw worker output.
 * @returns Parsed decision or undefined.
 *
 * PURE: No side effects.
 */
export function parseReviewLoopDecision(
  output: string
): ReviewLoopDecision | undefined {
  const parsed =
    parseJsonObject(
      output
    );

  if (!parsed) {
    return undefined;
  }

  if (
    parsed.decision === "approved" &&
    typeof parsed.reason === "string" &&
    isReviewLoopConfidence(
      parsed.confidence
    )
  ) {
    return {
      decision:
        "approved",
      reason:
        parsed.reason,
      confidence:
        parsed.confidence,
    };
  }

  if (
    parsed.decision === "rejected" &&
    typeof parsed.reason === "string" &&
    isStringArray(
      parsed.requiredRevisions
    ) &&
    isReviewLoopConfidence(
      parsed.confidence
    )
  ) {
    return {
      decision:
        "rejected",
      reason:
        parsed.reason,
      requiredRevisions:
        parsed.requiredRevisions,
      confidence:
        parsed.confidence,
    };
  }

  return undefined;
}