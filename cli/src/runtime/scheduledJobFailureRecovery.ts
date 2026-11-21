import {
  loadDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  loadScheduledJobs,
} from "../storage/scheduledJobRepository";

import type {
  DeadLetterQueue,
} from "./deadLetterQueue";

import type {
  ScheduledJob,
} from "./scheduledJob";

export type ScheduledJobFailureRecoverySummary = {
  retryJobCount: number;
  deadLetterJobCount: number;
};

/**
 * Creates scheduled job failure recovery summary.
 *
 * @param scheduledJobs Scheduled jobs.
 * @param deadLetterQueue Dead-letter queue.
 * @returns Failure recovery summary.
 *
 * PURE: No side effects.
 */
export function createScheduledJobFailureRecoverySummary(
  scheduledJobs: ScheduledJob[],
  deadLetterQueue: DeadLetterQueue
): ScheduledJobFailureRecoverySummary {
  return {
    retryJobCount:
      scheduledJobs.filter(
        (job) =>
          "retryCount" in job &&
          typeof job.retryCount === "number" &&
          job.retryCount > 0
      ).length,

    deadLetterJobCount:
      deadLetterQueue.jobs.length,
  };
}

/**
 * Recovers scheduled job failure state from persistence.
 *
 * @returns Failure recovery summary.
 *
 * SIDE EFFECT:
 * - Reads scheduled jobs from disk.
 * - Reads dead-letter queue from disk.
 */
export function recoverScheduledJobFailureState():
  ScheduledJobFailureRecoverySummary {
  return createScheduledJobFailureRecoverySummary(
    loadScheduledJobs(),
    loadDeadLetterQueue()
  );
}