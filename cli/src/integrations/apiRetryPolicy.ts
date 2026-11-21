export type ApiRetryPolicy = {
  maxAttempts: number;
  delayMs: number;
};

export type ApiRetryPolicyValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Creates API retry policy.
 *
 * @param maxAttempts Maximum attempts.
 * @param delayMs Delay between attempts.
 * @returns API retry policy.
 *
 * PURE: No side effects.
 */
export function createApiRetryPolicy(
  maxAttempts: number,
  delayMs: number
): ApiRetryPolicy {
  return {
    maxAttempts,
    delayMs,
  };
}

/**
 * Validates API retry policy.
 *
 * @param policy Retry policy.
 * @returns Validation result.
 *
 * PURE: No side effects.
 */
export function validateApiRetryPolicy(
  policy: ApiRetryPolicy
): ApiRetryPolicyValidationResult {
  if (policy.maxAttempts < 1) {
    return {
      ok: false,
      error:
        "Retry max attempts must be at least 1",
    };
  }

  if (policy.delayMs < 0) {
    return {
      ok: false,
      error:
        "Retry delay must not be negative",
    };
  }

  return {
    ok: true,
  };
}

/**
 * Determines whether retry should occur.
 *
 * @param attempt Current attempt number.
 * @param policy Retry policy.
 * @returns True when another attempt is allowed.
 *
 * PURE: No side effects.
 */
export function shouldRetryApiRequest(
  attempt: number,
  policy: ApiRetryPolicy
): boolean {
  return attempt < policy.maxAttempts;
}