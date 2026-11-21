import {
  loadDeadLetterQueue,
  saveDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  handleScheduledJobFailure,
} from "./scheduledJobFailure";

import {
  appendScheduledJobDeadLetteredEvent,
  appendScheduledJobRetryEvent,
} from "./scheduledJobFailureEventStore";

import {
  removeScheduledJobById,
  upsertScheduledJob,
} from "./scheduledJobLifecycle";

import type {
  RetryPolicy,
  RetryableScheduledJob,
} from "./scheduledJobRetry";

export type ScheduledJobFailureStoreResult = {
  retryScheduled: boolean;
  deadLettered: boolean;
};

/**
 * Persists scheduled job failure handling result.
 *
 * @param job Failed scheduled job.
 * @param policy Retry policy.
 * @param reason Failure reason.
 * @param failedAt Failure timestamp.
 * @returns Failure persistence result.
 *
 * SIDE EFFECT:
 * - Reads and writes scheduled jobs.
 * - Reads and writes dead-letter queue.
 * - Reads and writes runtime event log.
 */
export function persistScheduledJobFailure(
  job: RetryableScheduledJob,
  policy: RetryPolicy,
  reason: string,
  failedAt: number
): ScheduledJobFailureStoreResult {
  const scheduledJobs =
    loadScheduledJobs();

  const deadLetterQueue =
    loadDeadLetterQueue();

  const result =
    handleScheduledJobFailure(
      job,
      policy,
      deadLetterQueue,
      reason,
      failedAt
    );

  const runtimeEventLog =
    loadRuntimeEventLog();

  if (result.retryJob) {
    saveScheduledJobs(
      upsertScheduledJob(
        scheduledJobs,
        result.retryJob
      )
    );

    saveRuntimeEventLog(
      appendScheduledJobRetryEvent(
        runtimeEventLog,
        result.retryJob,
        failedAt
      )
    );

    return {
      retryScheduled: true,
      deadLettered: false,
    };
  }

  saveScheduledJobs(
    removeScheduledJobById(
      scheduledJobs,
      job.id
    )
  );

  saveDeadLetterQueue(
    result.deadLetterQueue
  );

  saveRuntimeEventLog(
    appendScheduledJobDeadLetteredEvent(
      runtimeEventLog,
      job,
      reason,
      failedAt
    )
  );

  return {
    retryScheduled: false,
    deadLettered: true,
  };
}