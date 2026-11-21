import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import type {
  CronJob,
} from "./cronJob";

/**
 * Creates cron job scheduled event.
 *
 * @param cronJob Cron job.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createCronJobScheduledEvent(
  cronJob: CronJob,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `cron-job-scheduled-${cronJob.id}-${timestamp}`,
    type:
      "cron-job.scheduled",
    level:
      "info",
    message:
      `Cron job scheduled: ${cronJob.id}`,
    timestamp,
    payload: {
      cronJobId:
        cronJob.id,
      workflowId:
        cronJob.workflowId,
      expression:
        cronJob.expression,
      nextRunAt:
        cronJob.nextRunAt,
    },
  };
}

/**
 * Creates cron job advanced event.
 *
 * @param cronJob Cron job.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createCronJobAdvancedEvent(
  cronJob: CronJob,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `cron-job-advanced-${cronJob.id}-${timestamp}`,
    type:
      "cron-job.advanced",
    level:
      "info",
    message:
      `Cron job advanced: ${cronJob.id}`,
    timestamp,
    payload: {
      cronJobId:
        cronJob.id,
      workflowId:
        cronJob.workflowId,
      expression:
        cronJob.expression,
      nextRunAt:
        cronJob.nextRunAt,
    },
  };
}