import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  dispatchScheduledJobs,
  type ScheduledJobExecutionRecord,
} from "./scheduledJobRuntime";

import {
  appendScheduledJobDispatchEvents,
} from "./scheduledJobDispatchStore";

export type ScheduledJobTickReport = {
  checkedAt: number;
  dispatchedCount: number;
  dispatchedJobs: ScheduledJobExecutionRecord[];
  remainingJobCount: number;
};

/**
 * Creates scheduled job tick report.
 *
 * @param checkedAt Tick timestamp.
 * @param dispatchedJobs Dispatched scheduled jobs.
 * @param remainingJobs Remaining scheduled jobs.
 * @returns Scheduled job tick report.
 *
 * PURE: No side effects.
 */
export function createScheduledJobTickReport(
  checkedAt: number,
  dispatchedJobs: ScheduledJobExecutionRecord[],
  remainingJobs: ScheduledJob[]
): ScheduledJobTickReport {
  return {
    checkedAt,
    dispatchedCount:
      dispatchedJobs.length,
    dispatchedJobs,
    remainingJobCount:
      remainingJobs.length,
  };
}

/**
 * Runs one persisted scheduled job tick.
 *
 * @param now Current timestamp.
 * @returns Scheduled job tick report.
 *
 * SIDE EFFECT:
 * - Reads scheduled jobs from disk.
 * - Persists remaining scheduled jobs.
 * - Reads runtime event log from disk.
 * - Persists scheduled job dispatch events.
 */
export function runScheduledJobTick(
  now: number
): ScheduledJobTickReport {
  const jobs =
    loadScheduledJobs();

  const dispatchResult =
    dispatchScheduledJobs(
      jobs,
      now
    );

  saveScheduledJobs(
    dispatchResult.remainingJobs
  );

  const runtimeEventLog =
    loadRuntimeEventLog();

  const updatedRuntimeEventLog =
    appendScheduledJobDispatchEvents(
      runtimeEventLog,
      dispatchResult.executedJobs,
      now
    );

  saveRuntimeEventLog(
    updatedRuntimeEventLog
  );

  return createScheduledJobTickReport(
    now,
    dispatchResult.executedJobs,
    dispatchResult.remainingJobs
  );
}