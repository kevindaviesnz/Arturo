import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import type {
  ScheduledJobExecutionRecord,
} from "./scheduledJobRuntime";

/**
 * Creates scheduled job dispatched event.
 *
 * @param execution Scheduled job execution record.
 * @param sequence Runtime event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createScheduledJobDispatchedEvent(
  execution: ScheduledJobExecutionRecord,
  sequence: number,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `scheduled-job-dispatched-${execution.scheduledJobId}`,
    type:
      "scheduled-job.dispatched",
    level:
      "info",
    message:
      `Scheduled job dispatched: ${execution.scheduledJobId}`,
    timestamp,
    payload: {
      scheduledJobId:
        execution.scheduledJobId,
      workflowId:
        execution.workflowId,
    },
  };
}

/**
 * Creates scheduled job dispatched events.
 *
 * @param executions Scheduled job execution records.
 * @param startingSequence First event sequence.
 * @param timestamp Runtime event timestamp.
 * @returns Runtime event records.
 *
 * PURE: No side effects.
 */
export function createScheduledJobDispatchedEvents(
  executions: ScheduledJobExecutionRecord[],
  startingSequence: number,
  timestamp: number
): RuntimeEventRecord[] {
  return executions.map(
    (execution, index) =>
      createScheduledJobDispatchedEvent(
        execution,
        startingSequence + index,
        timestamp
      )
  );
}