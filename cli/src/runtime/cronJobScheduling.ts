import type {
  CronJob,
} from "./cronJob";

import {
  createScheduledJob,
  type ScheduledJob,
} from "./scheduledJob";

export type CronSchedulingResult = {
  scheduledJobs: ScheduledJob[];
};

/**
 * Creates scheduled jobs from due cron jobs.
 *
 * @param cronJobs Due cron jobs.
 * @param timestamp Current timestamp.
 * @returns Scheduled jobs.
 *
 * PURE: No side effects.
 */
export function createScheduledJobsFromCronJobs(
  cronJobs: CronJob[],
  timestamp: number
): CronSchedulingResult {
  return {
    scheduledJobs:
      cronJobs.map(
        (cronJob) =>
          createScheduledJob(
            `${cronJob.id}-${timestamp}`,
            cronJob.workflowId,
            cronJob.nextRunAt,
            timestamp
          )
      ),
  };
}