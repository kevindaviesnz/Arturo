import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import type {
  ScheduledJob,
} from "./scheduledJob";

/**
 * Creates scheduled job queued runtime event.
 *
 * @param job Queued scheduled job.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Scheduled job queued runtime event.
 *
 * PURE: No side effects.
 */
export function createScheduledJobQueuedEvent(
  job: ScheduledJob,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `scheduled-job-queued-${job.id}`,
    type:
      "scheduled-job.queued",
    level:
      "info",
    message:
      `Scheduled job queued: ${job.id}`,
    timestamp,
    payload: {
      scheduledJobId:
        job.id,
      workflowId:
        job.workflowId,
    },
  };
}

/**
 * Creates scheduled job queued events.
 *
 * @param jobs Queued scheduled jobs.
 * @param startingSequence First runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Scheduled job queued runtime events.
 *
 * PURE: No side effects.
 */
export function createScheduledJobQueuedEvents(
  jobs: ScheduledJob[],
  startingSequence: number,
  timestamp: number
): RuntimeEventRecord[] {
  return jobs.map(
    (job, index) =>
      createScheduledJobQueuedEvent(
        job,
        startingSequence + index,
        timestamp
      )
  );
}