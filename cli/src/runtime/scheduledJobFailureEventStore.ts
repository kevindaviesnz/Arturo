import {
  appendRuntimeEvent,
  type RuntimeEventLog,
} from "./runtimeEventLog";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  createScheduledJobDeadLetteredEvent,
  createScheduledJobRetryEvent,
} from "./scheduledJobFailureEvents";

/**
 * Appends scheduled job retry event to runtime log.
 *
 * @param log Runtime event log.
 * @param job Retryable scheduled job.
 * @param timestamp Event timestamp.
 * @returns Updated runtime event log.
 *
 * PURE: No side effects.
 */
export function appendScheduledJobRetryEvent(
  log: RuntimeEventLog,
  job: RetryableScheduledJob,
  timestamp: number
): RuntimeEventLog {
  return appendRuntimeEvent(
    log,
    createScheduledJobRetryEvent(
      job,
      log.events.length + 1,
      timestamp
    )
  );
}

/**
 * Appends scheduled job dead-lettered event to runtime log.
 *
 * @param log Runtime event log.
 * @param job Retryable scheduled job.
 * @param reason Failure reason.
 * @param timestamp Event timestamp.
 * @returns Updated runtime event log.
 *
 * PURE: No side effects.
 */
export function appendScheduledJobDeadLetteredEvent(
  log: RuntimeEventLog,
  job: RetryableScheduledJob,
  reason: string,
  timestamp: number
): RuntimeEventLog {
  return appendRuntimeEvent(
    log,
    createScheduledJobDeadLetteredEvent(
      job,
      reason,
      log.events.length + 1,
      timestamp
    )
  );
}