import fs from "fs";
import path from "path";
import { writePrivateFileAtomic } from "./atomicFile";

import type {
  ScheduledJob,
} from "../runtime/scheduledJob";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const SCHEDULED_JOBS_PATH =
  path.join(
    DATA_DIR,
    "scheduled-jobs.json"
  );

/**
 * Ensures scheduled job data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates directory on disk when missing.
 */
export function ensureScheduledJobDataDir():
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
 * Serializes scheduled jobs.
 *
 * @param jobs Scheduled jobs.
 * @returns Serialized scheduled jobs.
 *
 * PURE: No side effects.
 */
export function serializeScheduledJobs(
  jobs: ScheduledJob[]
): string {
  return JSON.stringify(
    jobs,
    null,
    2
  );
}

/**
 * Parses scheduled jobs.
 *
 * @param value Serialized scheduled jobs.
 * @returns Parsed scheduled jobs.
 *
 * PURE: No side effects.
 */
export function parseScheduledJobs(
  value: string
): ScheduledJob[] {
  const trimmed =
    value.trim();

  if (
    trimmed.length === 0
  ) {
    return [];
  }

  return JSON.parse(
    trimmed
  ) as ScheduledJob[];
}

/**
 * Saves scheduled jobs to disk.
 *
 * @param jobs Scheduled jobs.
 * @returns Saved scheduled jobs.
 *
 * SIDE EFFECT:
 * - Writes scheduled jobs to disk.
 */
export function saveScheduledJobs(
  jobs: ScheduledJob[]
): ScheduledJob[] {
  ensureScheduledJobDataDir();

  writePrivateFileAtomic(
    SCHEDULED_JOBS_PATH,
    serializeScheduledJobs(jobs)
  );

  return jobs;
}

/**
 * Loads scheduled jobs from disk.
 *
 * @returns Persisted scheduled jobs.
 *
 * SIDE EFFECT:
 * - Reads scheduled jobs from disk.
 */
export function loadScheduledJobs():
  ScheduledJob[] {
  if (
    !fs.existsSync(
      SCHEDULED_JOBS_PATH
    )
  ) {
    return [];
  }

  return parseScheduledJobs(
    fs.readFileSync(
      SCHEDULED_JOBS_PATH,
      "utf8"
    )
  );
}

/**
 * Clears persisted scheduled jobs.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Deletes scheduled job file when present.
 */
export function clearScheduledJobs():
  void {
  if (
    fs.existsSync(
      SCHEDULED_JOBS_PATH
    )
  ) {
    fs.unlinkSync(
      SCHEDULED_JOBS_PATH
    );
  }
}
