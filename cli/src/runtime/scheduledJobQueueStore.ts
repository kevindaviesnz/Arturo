import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  getRunnableScheduledJobs,
  queueRunnableScheduledJobs,
} from "./scheduledJobQueue";

import {
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  appendRuntimeEvent,
} from "./runtimeEventLog";

import {
  createScheduledJobQueuedEvents,
} from "./scheduledJobQueueEvents";

/**
 * Queues due scheduled jobs from persisted storage.
 *
 * @param now Current timestamp.
 * @returns Queued scheduled jobs.
 *
 * SIDE EFFECT:
 * - Reads scheduled jobs from disk.
 * - Persists queued scheduled jobs.
 * - Reads runtime event log from disk.
 * - Persists runtime event log updates.
 */
export function queueDueScheduledJobs(
  now: number
): ScheduledJob[] {
  const jobs =
    loadScheduledJobs();

  const runnableJobs =
    getRunnableScheduledJobs(
      jobs,
      now
    );

  const updatedJobs =
    queueRunnableScheduledJobs(
      jobs,
      now
    );

  saveScheduledJobs(
    updatedJobs
  );

  const queuedJobs =
    runnableJobs.map(
      (job) => ({
        ...job,
        status: "queued" as const,
        queuedAt: now,
      })
    );

  const runtimeEventLog =
    loadRuntimeEventLog();

  const queuedEvents =
    createScheduledJobQueuedEvents(
      queuedJobs,
      runtimeEventLog.events.length + 1,
      now
    );

  const updatedRuntimeEventLog =
    queuedEvents.reduce(
      (
        log,
        event
      ) =>
        appendRuntimeEvent(
          log,
          event
        ),
      runtimeEventLog
    );

  saveRuntimeEventLog(
    updatedRuntimeEventLog
  );

  return queuedJobs;
}