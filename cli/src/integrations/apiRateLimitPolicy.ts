export type ApiRateLimitPolicy = {
  maxRequests: number;
  windowMs: number;
};

export type ApiRateLimitPolicyValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Creates API rate limit policy.
 *
 * @param maxRequests Maximum requests allowed.
 * @param windowMs Time window in milliseconds.
 * @returns API rate limit policy.
 *
 * PURE: No side effects.
 */
export function createApiRateLimitPolicy(
  maxRequests: number,
  windowMs: number
): ApiRateLimitPolicy {
  return {
    maxRequests,
    windowMs,
  };
}

/**
 * Validates API rate limit policy.
 *
 * @param policy Rate limit policy.
 * @returns Validation result.
 *
 * PURE: No side effects.
 */
export function validateApiRateLimitPolicy(
  policy: ApiRateLimitPolicy
): ApiRateLimitPolicyValidationResult {
  if (
    policy.maxRequests < 1
  ) {
    return {
      ok: false,
      error:
        "Rate limit max requests must be at least 1",
    };
  }

  if (
    policy.windowMs <= 0
  ) {
    return {
      ok: false,
      error:
        "Rate limit window must be greater than zero",
    };
  }

  return {
    ok: true,
  };
}

/**
 * Determines whether request is allowed.
 *
 * @param timestamps Previous request timestamps.
 * @param now Current timestamp.
 * @param policy Rate limit policy.
 * @returns True when request is allowed.
 *
 * PURE: No side effects.
 */
export function isApiRequestAllowed(
  timestamps: readonly number[],
  now: number,
  policy: ApiRateLimitPolicy
): boolean {
  const windowStart =
    now - policy.windowMs;

  const requestsInWindow =
    timestamps.filter(
      (timestamp) =>
        timestamp > windowStart
    );

  return (
    requestsInWindow.length <
    policy.maxRequests
  );
}