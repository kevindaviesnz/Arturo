import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  loadScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  sortScheduledJobsDeterministically,
} from "./scheduledJobDispatcher";

/**
 * Recovers queued scheduled jobs from persisted storage.
 *
 * @returns Queued scheduled jobs.
 *
 * SIDE EFFECT:
 * - Reads scheduled jobs from disk.
 */
export function recoverScheduledJobQueue():
  ScheduledJob[] {
  return sortScheduledJobsDeterministically(
    loadScheduledJobs().filter(
      isRecoverableQueuedScheduledJob
    )
  );
}

/**
 * Checks whether a scheduled job should be recovered into the runtime queue.
 *
 * @param job Scheduled job.
 * @returns True when job is queued.
 *
 * PURE: No side effects.
 */
export function isRecoverableQueuedScheduledJob(
  job: ScheduledJob
): boolean {
  return job.status === "queued";
}