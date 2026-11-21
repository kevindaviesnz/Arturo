import fs from "fs";
import path from "path";
import { writePrivateFileAtomic } from "./atomicFile";

import type {
  CronJob,
} from "../runtime/cronJob";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const CRON_JOBS_PATH =
  path.join(
    DATA_DIR,
    "cron-jobs.json"
  );

/**
 * Ensures cron job data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates data directory on disk when missing.
 */
export function ensureCronJobDataDir():
  void {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true,
      mode: 0o700,
    }
  );
}

/**
 * Serializes cron jobs.
 *
 * @param jobs Cron jobs.
 * @returns Serialized cron jobs.
 *
 * PURE: No side effects.
 */
export function serializeCronJobs(
  jobs: CronJob[]
): string {
  return JSON.stringify(
    jobs,
    null,
    2
  );
}

/**
 * Parses cron jobs.
 *
 * @param value Serialized cron jobs.
 * @returns Cron jobs.
 *
 * PURE: No side effects.
 */
export function parseCronJobs(
  value: string
): CronJob[] {
  if (
    value.trim().length === 0
  ) {
    return [];
  }

  const parsed =
    JSON.parse(
      value
    );

  if (
    !Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      "Cron jobs must be an array"
    );
  }

  return parsed as CronJob[];
}

/**
 * Checks whether persisted cron jobs exist.
 *
 * @returns True when cron jobs file exists.
 *
 * SIDE EFFECT:
 * - Reads filesystem metadata.
 */
export function cronJobsExist():
  boolean {
  return fs.existsSync(
    CRON_JOBS_PATH
  );
}

/**
 * Saves cron jobs to disk.
 *
 * @param jobs Cron jobs.
 * @returns Cron jobs.
 *
 * SIDE EFFECT:
 * - Writes cron jobs to disk.
 */
export function saveCronJobs(
  jobs: CronJob[]
): CronJob[] {
  ensureCronJobDataDir();

  writePrivateFileAtomic(
    CRON_JOBS_PATH,
    serializeCronJobs(jobs)
  );

  return jobs;
}

/**
 * Loads cron jobs from disk.
 *
 * @returns Persisted cron jobs, or empty list when missing.
 *
 * SIDE EFFECT:
 * - Reads cron jobs from disk.
 */
export function loadCronJobs():
  CronJob[] {
  if (
    !cronJobsExist()
  ) {
    return [];
  }

  return parseCronJobs(
    fs.readFileSync(
      CRON_JOBS_PATH,
      "utf8"
    )
  );
}

/**
 * Clears persisted cron jobs.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Deletes cron jobs file when present.
 */
export function clearCronJobs():
  void {
  if (
    cronJobsExist()
  ) {
    fs.unlinkSync(
      CRON_JOBS_PATH
    );
  }
}
