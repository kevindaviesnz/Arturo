import type {
  ApiRetryPolicy,
} from "./apiRetryPolicy";

import {
  validateApiRetryPolicy,
} from "./apiRetryPolicy";

/**
 * Sleeps for the specified duration.
 *
 * @param delayMs Delay in milliseconds.
 * @returns Promise that resolves after delay.
 *
 * SIDE EFFECT:
 * Uses timer.
 */
export async function sleepForRetry(
  delayMs: number,
  signal?: AbortSignal
): Promise<void> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Executes an operation with retry policy.
 *
 * @param operation Operation to execute.
 * @param policy Retry policy.
 * @returns Operation result.
 *
 * SIDE EFFECT:
 * May invoke operation multiple times.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  policy: ApiRetryPolicy,
  signal?: AbortSignal
): Promise<T> {
  const validation =
    validateApiRetryPolicy(
      policy
    );

  if (!validation.ok) {
    throw new Error(
      validation.error
    );
  }

  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= policy.maxAttempts;
    attempt += 1
  ) {
    signal?.throwIfAborted();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      signal?.throwIfAborted();

      if (
        attempt < policy.maxAttempts
      ) {
        await sleepForRetry(
          policy.delayMs,
          signal
        );
      }
    }
  }

  throw lastError;
}