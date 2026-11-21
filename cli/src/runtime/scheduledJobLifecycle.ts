import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  createRetryableScheduledJob,
  type RetryableScheduledJob,
} from "./scheduledJobRetry";

/**
 * Converts scheduled job to retryable scheduled job.
 *
 * Preserves existing retryCount when present.
 *
 * @param job Scheduled job.
 * @returns Retryable scheduled job.
 *
 * PURE: No side effects.
 */
export function toRetryableScheduledJob(
  job: ScheduledJob | RetryableScheduledJob
): RetryableScheduledJob {
  if (
    "retryCount" in job &&
    typeof job.retryCount === "number"
  ) {
    return job;
  }

  return createRetryableScheduledJob(
    job
  );
}

/**
 * Removes scheduled job by id.
 *
 * @param jobs Scheduled jobs.
 * @param jobId Scheduled job id.
 * @returns Scheduled jobs without matching job.
 *
 * PURE: No side effects.
 */
export function removeScheduledJobById(
  jobs: ScheduledJob[],
  jobId: string
): ScheduledJob[] {
  return jobs.filter(
    (job) => job.id !== jobId
  );
}

/**
 * Replaces or appends scheduled job.
 *
 * @param jobs Scheduled jobs.
 * @param replacement Replacement scheduled job.
 * @returns Updated scheduled jobs.
 *
 * PURE: No side effects.
 */
export function upsertScheduledJob(
  jobs: ScheduledJob[],
  replacement: ScheduledJob
): ScheduledJob[] {
  const exists =
    jobs.some(
      (job) => job.id === replacement.id
    );

  if (!exists) {
    return [
      ...jobs,
      replacement,
    ];
  }

  return jobs.map(
    (job) =>
      job.id === replacement.id
        ? replacement
        : job
  );
}