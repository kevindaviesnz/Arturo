import {
  appendRuntimeEvent,
} from "./runtimeEventLog";

import type {
  RuntimeEventLog,
} from "./runtimeEventLog";

import type {
  ScheduledJobExecutionRecord,
} from "./scheduledJobRuntime";

import {
  createScheduledJobDispatchedEvents,
} from "./scheduledJobDispatchEvents";

/**
 * Appends scheduled job dispatch events
 * to runtime event log.
 *
 * @param log Runtime event log.
 * @param executions Scheduled executions.
 * @param timestamp Event timestamp.
 * @returns Updated runtime event log.
 *
 * PURE: No side effects.
 */
export function appendScheduledJobDispatchEvents(
  log: RuntimeEventLog,
  executions: ScheduledJobExecutionRecord[],
  timestamp: number
): RuntimeEventLog {
  if (executions.length === 0) {
    return log;
  }

  const startingSequence =
    log.events.length + 1;

  const events =
    createScheduledJobDispatchedEvents(
      executions,
      startingSequence,
      timestamp
    );

  return events.reduce(
    (
      currentLog,
      event
    ) =>
      appendRuntimeEvent(
        currentLog,
        event
      ),
    log
  );
}