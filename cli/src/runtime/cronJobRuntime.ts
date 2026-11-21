import {
  loadCronJobs,
  saveCronJobs,
} from "../storage/cronJobRepository";

import {
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  extractDueCronJobs,
} from "./cronJobDispatcher";

import {
  createScheduledJobsFromCronJobs,
} from "./cronJobScheduling";

export type CronJobRuntimeTickReport = {
  checkedAt: number;
  dueCronJobCount: number;
  scheduledJobCount: number;
  persistedCronJobCount: number;
};

/**
 * Creates cron job runtime tick report.
 *
 * @param checkedAt Tick timestamp.
 * @param dueCronJobCount Due cron job count.
 * @param scheduledJobCount Created scheduled job count.
 * @param persistedCronJobCount Persisted cron job count.
 * @returns Cron job runtime tick report.
 *
 * PURE: No side effects.
 */
export function createCronJobRuntimeTickReport(
  checkedAt: number,
  dueCronJobCount: number,
  scheduledJobCount: number,
  persistedCronJobCount: number
): CronJobRuntimeTickReport {
  return {
    checkedAt,
    dueCronJobCount,
    scheduledJobCount,
    persistedCronJobCount,
  };
}

/**
 * Runs one persisted cron job runtime tick.
 *
 * @param now Current timestamp.
 * @returns Cron job runtime tick report.
 *
 * SIDE EFFECT:
 * - Reads persisted cron jobs.
 * - Writes advanced cron jobs.
 * - Reads persisted scheduled jobs.
 * - Writes generated scheduled jobs.
 */
export function runCronJobRuntimeTick(
  now: number
): CronJobRuntimeTickReport {
  const cronJobs =
    loadCronJobs();

  const dispatchResult =
    extractDueCronJobs(
      cronJobs,
      now
    );

  const schedulingResult =
    createScheduledJobsFromCronJobs(
      dispatchResult.dueJobs,
      now
    );

  saveCronJobs(
    dispatchResult.updatedJobs
  );

  saveScheduledJobs([
    ...loadScheduledJobs(),
    ...schedulingResult.scheduledJobs,
  ]);

  return createCronJobRuntimeTickReport(
    now,
    dispatchResult.dueJobs.length,
    schedulingResult.scheduledJobs.length,
    dispatchResult.updatedJobs.length
  );
}