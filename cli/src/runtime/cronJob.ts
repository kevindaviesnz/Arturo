import {
  parseCronSchedule,
  type CronSchedule,
} from "./cronSchedule";

import {
  getNextCronExecutionTime,
} from "./cronScheduleNextRun";

export type CronJob = {
  id: string;
  workflowId: string;
  expression: string;
  schedule: CronSchedule;
  nextRunAt: number;
  createdAt: number;
};

/**
 * Creates cron job.
 *
 * @param id Cron job id.
 * @param workflowId Workflow id.
 * @param expression Cron expression.
 * @param createdAt Creation timestamp.
 * @returns Cron job.
 *
 * PURE: No side effects.
 */
export function createCronJob(
  id: string,
  workflowId: string,
  expression: string,
  createdAt: number
): CronJob {
  const schedule =
    parseCronSchedule(
      expression
    );

  return {
    id,
    workflowId,
    expression,
    schedule,
    nextRunAt:
      getNextCronExecutionTime(
        schedule,
        createdAt
      ),
    createdAt,
  };
}

/**
 * Advances cron job to next run.
 *
 * @param job Cron job.
 * @returns Advanced cron job.
 *
 * PURE: No side effects.
 */
export function advanceCronJob(
  job: CronJob
): CronJob {
  return {
    ...job,
    nextRunAt:
      getNextCronExecutionTime(
        job.schedule,
        job.nextRunAt
      ),
  };
}