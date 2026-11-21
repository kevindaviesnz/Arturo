import {
  loadScheduledJobs,
} from "../storage/scheduledJobRepository";

import type {
  ScheduledJob,
} from "./scheduledJob";

/**
 * Sorts scheduled jobs deterministically.
 *
 * @param jobs Scheduled jobs.
 * @returns Deterministically sorted jobs.
 *
 * PURE: No side effects.
 */
export function sortScheduledJobs(
  jobs: ScheduledJob[]
): ScheduledJob[] {
  return [
    ...jobs,
  ].sort(
    (left, right) =>
      left.runAt - right.runAt ||
      left.createdAt - right.createdAt ||
      left.id.localeCompare(
        right.id
      )
  );
}

/**
 * Returns true when scheduled job can be recovered.
 *
 * @param job Scheduled job.
 * @returns True when job is structurally recoverable.
 *
 * PURE: No side effects.
 */
export function isRecoverableScheduledJob(
  job: ScheduledJob
): boolean {
  return (
    typeof job.id === "string" &&
    job.id.length > 0 &&
    typeof job.task === "string" &&
    job.task.length > 0 &&
    typeof job.runAt === "number" &&
    Number.isFinite(job.runAt) &&
    typeof job.createdAt === "number" &&
    Number.isFinite(job.createdAt)
  );
}

/**
 * Recovers all persisted scheduled jobs.
 *
 * @returns Recoverable scheduled jobs.
 *
 * SIDE EFFECT:
 * - Reads persisted scheduled jobs from disk.
 */
export function recoverScheduledJobs():
  ScheduledJob[] {
  return sortScheduledJobs(
    loadScheduledJobs().filter(
      isRecoverableScheduledJob
    )
  );
}

/**
 * Recovers runnable scheduled jobs.
 *
 * @param now Current timestamp.
 * @returns Recoverable jobs due at or before now.
 *
 * SIDE EFFECT:
 * - Reads persisted scheduled jobs from disk.
 */
export function recoverRunnableScheduledJobs(
  now: number
): ScheduledJob[] {
  return recoverScheduledJobs().filter(
    (job) =>
      job.status === "scheduled" &&
      job.runAt <= now
  );
}

/**
 * Recovers future scheduled jobs.
 *
 * @param now Current timestamp.
 * @returns Recoverable jobs due after now.
 *
 * SIDE EFFECT:
 * - Reads persisted scheduled jobs from disk.
 */
export function recoverFutureScheduledJobs(
  now: number
): ScheduledJob[] {
  return recoverScheduledJobs().filter(
    (job) =>
      job.status === "scheduled" &&
      job.runAt > now
  );
}