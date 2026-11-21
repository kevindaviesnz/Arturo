export type ScheduledJobStatus =
  | "scheduled"
  | "queued"
  | "cancelled"
  | "completed"
  | "failed";

export type ScheduledJob = {
  id: string;
  workflowId?: string;
  task: string;
  runAt: number;
  status: ScheduledJobStatus;
  createdAt: number;
  completedAt?: number;
  cancelledAt?: number;
  failedAt?: number;
  error?: string;
  queuedAt?: number;
};

/**
 * Creates scheduled job record.
 *
 * @param id Scheduled job id.
 * @param task Task text.
 * @param runAt Due timestamp.
 * @param createdAt Creation timestamp.
 * @returns Scheduled job.
 *
 * PURE: No side effects.
 */
export function createScheduledJob(
  id: string,
  task: string,
  runAt: number,
  createdAt: number
): ScheduledJob {
  return {
    id,
    task,
    runAt,
    status: "scheduled",
    createdAt,
  };
}

/**
 * Returns true when scheduled job is due.
 *
 * @param job Scheduled job.
 * @param now Current timestamp.
 * @returns True when job is scheduled and due.
 *
 * PURE: No side effects.
 */
export function isScheduledJobDue(
  job: ScheduledJob,
  now: number
): boolean {
  return (
    job.status === "scheduled" &&
    job.runAt <= now
  );
}

/**
 * Marks scheduled job as completed.
 *
 * @param job Scheduled job.
 * @param completedAt Completion timestamp.
 * @returns Completed scheduled job.
 *
 * PURE: No side effects.
 */
export function completeScheduledJob(
  job: ScheduledJob,
  completedAt: number
): ScheduledJob {
  return {
    ...job,
    status: "completed",
    completedAt,
  };
}

/**
 * Marks scheduled job as cancelled.
 *
 * @param job Scheduled job.
 * @param cancelledAt Cancellation timestamp.
 * @returns Cancelled scheduled job.
 *
 * PURE: No side effects.
 */
export function cancelScheduledJob(
  job: ScheduledJob,
  cancelledAt: number
): ScheduledJob {
  return {
    ...job,
    status: "cancelled",
    cancelledAt,
  };
}

/**
 * Marks scheduled job as failed.
 *
 * @param job Scheduled job.
 * @param error Failure message.
 * @param failedAt Failure timestamp.
 * @returns Failed scheduled job.
 *
 * PURE: No side effects.
 */
export function failScheduledJob(
  job: ScheduledJob,
  error: string,
  failedAt: number
): ScheduledJob {
  return {
    ...job,
    status: "failed",
    error,
    failedAt,
  };
}