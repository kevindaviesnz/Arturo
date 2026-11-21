import {
  type ScheduledJob,
} from "./scheduledJob";

/**
 * Returns runnable scheduled jobs.
 *
 * @param jobs Scheduled jobs.
 * @param now Current timestamp.
 * @returns Runnable scheduled jobs.
 *
 * PURE: No side effects.
 */
export function getRunnableScheduledJobs(
  jobs: ScheduledJob[],
  now: number
): ScheduledJob[] {
  return [
    ...jobs,
  ]
    .filter(
      (job) =>
        job.status === "scheduled" &&
        job.runAt <= now
    )
    .sort(
      (left, right) =>
        left.runAt - right.runAt ||
        left.id.localeCompare(
          right.id
        )
    );
}

/**
 * Marks scheduled job as queued.
 *
 * @param job Scheduled job.
 * @param queuedAt Queue timestamp.
 * @returns Queued scheduled job.
 *
 * PURE: No side effects.
 */
export function queueScheduledJob(
  job: ScheduledJob,
  queuedAt: number
): ScheduledJob {
  return {
    ...job,
    status: "queued",
    queuedAt,
  };
}

/**
 * Marks runnable scheduled jobs as queued.
 *
 * @param jobs Scheduled jobs.
 * @param now Current timestamp.
 * @returns Updated scheduled jobs.
 *
 * PURE: No side effects.
 */
export function queueRunnableScheduledJobs(
  jobs: ScheduledJob[],
  now: number
): ScheduledJob[] {
  const runnableIds =
    new Set(
      getRunnableScheduledJobs(
        jobs,
        now
      ).map(
        (job) => job.id
      )
    );

  return jobs.map(
    (job) =>
      runnableIds.has(
        job.id
      )
        ? queueScheduledJob(
            job,
            now
          )
        : job
  );
}