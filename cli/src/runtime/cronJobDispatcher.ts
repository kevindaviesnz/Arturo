import {
  advanceCronJob,
  type CronJob,
} from "./cronJob";

export type DueCronJobsResult = {
  dueJobs: CronJob[];
  updatedJobs: CronJob[];
};

/**
 * Extracts due cron jobs and advances them.
 *
 * @param jobs Cron jobs.
 * @param now Current timestamp.
 * @returns Due jobs and updated cron jobs.
 *
 * PURE: No side effects.
 */
export function extractDueCronJobs(
  jobs: CronJob[],
  now: number
): DueCronJobsResult {
  const dueJobs =
    jobs.filter(
      (job) =>
        job.nextRunAt <= now
    );

  const updatedJobs =
    jobs.map((job) =>
      job.nextRunAt <= now
        ? advanceCronJob(job)
        : job
    );

  return {
    dueJobs,
    updatedJobs,
  };
}