import type {
  ScheduledJob,
} from "./scheduledJob";

import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

export type RetryPolicy = {
  maxRetries: number;
  retryDelayMs: number;
};

export type RetryableScheduledJob =
  ScheduledJob & {
    retryCount: number;
  };

/**
 * Creates retryable scheduled job.
 *
 * @param job Scheduled job.
 * @returns Retryable scheduled job.
 *
 * PURE: No side effects.
 */
export function createRetryableScheduledJob(
  job: ScheduledJob
): RetryableScheduledJob {
  return {
    ...job,
    retryCount: 0,
  };
}

/**
 * Checks whether scheduled job can be retried.
 *
 * @param job Retryable scheduled job.
 * @param policy Retry policy.
 * @returns True when retry is allowed.
 *
 * PURE: No side effects.
 */
export function canRetryScheduledJob(
  job: RetryableScheduledJob,
  policy: RetryPolicy
): boolean {
  return job.retryCount < policy.maxRetries;
}

/**
 * Schedules retry for scheduled job.
 *
 * @param job Retryable scheduled job.
 * @param policy Retry policy.
 * @returns Updated retryable scheduled job.
 *
 * PURE: No side effects.
 */
export function scheduleScheduledJobRetry(
  job: RetryableScheduledJob,
  policy: RetryPolicy
): RetryableScheduledJob {
  return {
    ...job,
    retryCount:
      job.retryCount + 1,
    runAt:
      job.runAt + policy.retryDelayMs,
    status:
      "queued",
  };
}

/**
 * Retries scheduled job when policy allows.
 *
 * @param job Retryable scheduled job.
 * @param policy Retry policy.
 * @returns Retried scheduled job or undefined.
 *
 * PURE: No side effects.
 */
export function retryScheduledJob(
  job: RetryableScheduledJob,
  policy: RetryPolicy
): RetryableScheduledJob | undefined {
  if (
    !canRetryScheduledJob(
      job,
      policy
    )
  ) {
    return undefined;
  }

  return scheduleScheduledJobRetry(
    job,
    policy
  );
}

/**
 * Calculates retry timestamp.
 *
 * @param now Current timestamp.
 * @param delayMs Retry delay.
 * @returns Retry timestamp.
 *
 * PURE: No side effects.
 */
export function calculateRetryTime(
  now: number,
  delayMs: number
): number {
  return now + delayMs;
}

/**
 * Creates retry scheduled event.
 *
 * @param scheduledJobId Scheduled job id.
 * @param workflowId Workflow id.
 * @param retryAt Retry timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createRetryScheduledEvent(
  scheduledJobId: string,
  workflowId: string,
  retryAt: number
): RuntimeEventRecord {
  return {
    sequence: 0,
    id:
      `scheduled-job-retry-${scheduledJobId}-${retryAt}`,
    type:
      "scheduled-job.retry-scheduled",
    level:
      "warn",
    message:
      "Scheduled job retry scheduled",
    timestamp:
      retryAt,
    payload: {
      scheduledJobId,
      workflowId,
      retryAt,
    },
  };
}