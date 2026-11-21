import {
  loadCronJobs,
} from "../storage/cronJobRepository";

import type {
  CronJob,
} from "./cronJob";

/**
 * Recovers persisted cron jobs.
 *
 * @returns Persisted cron jobs.
 *
 * SIDE EFFECT:
 * - Reads persisted cron jobs.
 */
export function recoverCronJobs():
  CronJob[] {
  return loadCronJobs();
}