import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

export type DeadLetterJob = {
  job: RetryableScheduledJob;
  reason: string;
  failedAt: number;
};

export type DeadLetterQueue = {
  jobs: DeadLetterJob[];
};

/**
 * Creates an empty dead-letter queue.
 *
 * @returns Empty dead-letter queue.
 *
 * PURE: No side effects.
 */
export function createDeadLetterQueue():
  DeadLetterQueue {
  return {
    jobs: [],
  };
}

/**
 * Adds a dead-letter job to the queue.
 *
 * @param queue Dead-letter queue.
 * @param job Failed scheduled job.
 * @param reason Failure reason.
 * @param failedAt Failure timestamp.
 * @returns Updated dead-letter queue.
 *
 * PURE: No side effects.
 */
export function addDeadLetterJob(
  queue: DeadLetterQueue,
  job: RetryableScheduledJob,
  reason: string,
  failedAt: number
): DeadLetterQueue {
  return {
    jobs: [
      ...queue.jobs,
      {
        job,
        reason,
        failedAt,
      },
    ],
  };
}

/**
 * Returns the number of dead-letter jobs.
 *
 * @param queue Dead-letter queue.
 * @returns Dead-letter job count.
 *
 * PURE: No side effects.
 */
export function getDeadLetterJobCount(
  queue: DeadLetterQueue
): number {
  return queue.jobs.length;
}

/**
 * Finds a dead-letter job by scheduled job id.
 *
 * @param queue Dead-letter queue.
 * @param jobId Scheduled job id.
 * @returns Dead-letter job or undefined.
 *
 * PURE: No side effects.
 */
export function findDeadLetterJob(
  queue: DeadLetterQueue,
  jobId: string
): DeadLetterJob | undefined {
  return queue.jobs.find(
    (entry) =>
      entry.job.id === jobId
  );
}