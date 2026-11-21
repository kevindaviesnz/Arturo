import {
  addDeadLetterJob,
  type DeadLetterQueue,
} from "./deadLetterQueue";

import {
  canRetryScheduledJob,
  retryScheduledJob,
  type RetryPolicy,
  type RetryableScheduledJob,
} from "./scheduledJobRetry";

export type ScheduledJobFailureResult = {
  retryJob?: RetryableScheduledJob;
  deadLetterQueue: DeadLetterQueue;
};

/**
 * Handles failed scheduled job.
 *
 * Retries when policy allows.
 * Otherwise sends job to dead-letter queue.
 *
 * @param job Failed scheduled job.
 * @param policy Retry policy.
 * @param queue Dead-letter queue.
 * @param reason Failure reason.
 * @param failedAt Failure timestamp.
 * @returns Failure handling result.
 *
 * PURE: No side effects.
 */
export function handleScheduledJobFailure(
  job: RetryableScheduledJob,
  policy: RetryPolicy,
  queue: DeadLetterQueue,
  reason: string,
  failedAt: number
): ScheduledJobFailureResult {
  if (
    canRetryScheduledJob(
      job,
      policy
    )
  ) {
    return {
      retryJob:
        retryScheduledJob(
          job,
          policy
        ),
      deadLetterQueue:
        queue,
    };
  }

  return {
    deadLetterQueue:
      addDeadLetterJob(
        queue,
        job,
        reason,
        failedAt
      ),
  };
}