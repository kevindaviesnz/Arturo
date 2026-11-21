import type {
  ScheduledJob,
} from "./scheduledJob";

/**
 * Sorts scheduled jobs deterministically.
 *
 * @param jobs Scheduled jobs.
 * @returns Sorted scheduled jobs.
 *
 * PURE: No side effects.
 */
export function sortScheduledJobsDeterministically(
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
 * Gets queued scheduled jobs ready for dispatch.
 *
 * @param jobs Scheduled jobs.
 * @param now Current timestamp.
 * @returns Runnable queued scheduled jobs.
 *
 * PURE: No side effects.
 */
export function getDispatchableScheduledJobs(
  jobs: ScheduledJob[],
  now: number
): ScheduledJob[] {
  return sortScheduledJobsDeterministically(
    jobs.filter(
      (job) =>
        job.status === "queued" &&
        job.runAt <= now
    )
  );
}