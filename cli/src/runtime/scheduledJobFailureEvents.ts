import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

/**
 * Creates scheduled job retry event.
 *
 * @param job Retryable scheduled job.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createScheduledJobRetryEvent(
  job: RetryableScheduledJob,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `scheduled-job-retry-${job.id}-${job.retryCount}`,
    type:
      "scheduled-job.retry-scheduled",
    level:
      "warn",
    message:
      `Scheduled job retry scheduled: ${job.id}`,
    timestamp,
    payload: {
      scheduledJobId:
        job.id,
      workflowId:
        job.workflowId,
      retryCount:
        job.retryCount,
      runAt:
        job.runAt,
    },
  };
}

/**
 * Creates scheduled job dead-lettered event.
 *
 * @param job Retryable scheduled job.
 * @param reason Failure reason.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createScheduledJobDeadLetteredEvent(
  job: RetryableScheduledJob,
  reason: string,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `scheduled-job-dead-lettered-${job.id}`,
    type:
      "scheduled-job.dead-lettered",
    level:
      "error",
    message:
      `Scheduled job dead-lettered: ${job.id}`,
    timestamp,
    payload: {
      scheduledJobId:
        job.id,
      workflowId:
        job.workflowId,
      retryCount:
        job.retryCount,
      reason,
    },
  };
}