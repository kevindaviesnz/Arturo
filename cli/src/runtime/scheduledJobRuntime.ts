import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  getDispatchableScheduledJobs,
} from "./scheduledJobDispatcher";

export type ScheduledJobExecutionRecord =
  {
    scheduledJobId: string;
    workflowId?: string;
  };

export type ScheduledJobDispatchResult =
  {
    remainingJobs: ScheduledJob[];
    executedJobs:
      ScheduledJobExecutionRecord[];
  };

/**
 * Dispatches runnable scheduled jobs.
 *
 * @param jobs Scheduled jobs.
 * @param now Current timestamp.
 * @returns Dispatch result.
 *
 * PURE: No side effects.
 */
export function dispatchScheduledJobs(
  jobs: ScheduledJob[],
  now: number
): ScheduledJobDispatchResult {
  const runnableJobs =
    getDispatchableScheduledJobs(
      jobs,
      now
    );

  const runnableIds =
    new Set(
      runnableJobs.map(
        (job) => job.id
      )
    );

  return {
    remainingJobs:
      jobs.filter(
        (job) =>
          !runnableIds.has(
            job.id
          )
      ),

    executedJobs:
      runnableJobs.map(
        (job) => ({
          scheduledJobId:
            job.id,
          workflowId:
            job.workflowId,
        })
      ),
  };
}