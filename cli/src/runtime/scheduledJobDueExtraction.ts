import type {
  ScheduledJob,
} from "./scheduledJob";

export type ScheduledJobExtractionResult =
  {
    dueJobs: ScheduledJob[];
    futureJobs: ScheduledJob[];
  };

/**
 * Splits scheduled jobs into due and future jobs.
 *
 * @param jobs Scheduled jobs.
 * @param now Current timestamp.
 * @returns Due/future job partition.
 *
 * PURE: No side effects.
 */
export function extractDueScheduledJobs(
  jobs: ScheduledJob[],
  now: number
): ScheduledJobExtractionResult {
  return jobs.reduce(
    reduceScheduledJobDueExtraction(
      now
    ),
    {
      dueJobs: [],
      futureJobs: [],
    }
  );
}

/**
 * Creates scheduled job extraction reducer.
 *
 * @param now Current timestamp.
 * @returns Reducer function.
 *
 * PURE: No side effects.
 */
export function reduceScheduledJobDueExtraction(
  now: number
) {
  return function reduceScheduledJob(
    result: ScheduledJobExtractionResult,
    job: ScheduledJob
  ): ScheduledJobExtractionResult {
    if (job.runAt <= now) {
      return {
        ...result,
        dueJobs: [
          ...result.dueJobs,
          job,
        ],
      };
    }

    return {
      ...result,
      futureJobs: [
        ...result.futureJobs,
        job,
      ],
    };
  };
}