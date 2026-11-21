import {
  cancelScheduledJob,
  completeScheduledJob,
  createScheduledJob,
  failScheduledJob,
  isScheduledJobDue,
  type ScheduledJob,
} from "./scheduledJob";

let scheduledJobs:
  ScheduledJob[] = [];

/**
 * Lists scheduled jobs.
 *
 * @returns Scheduled jobs.
 *
 * PURE: No side effects.
 */
export function listScheduledJobs():
  ScheduledJob[] {
  return [
    ...scheduledJobs,
  ];
}

/**
 * Clears scheduled job store.
 *
 * @returns void
 *
 * SIDE EFFECT: Clears in-memory scheduled jobs.
 */
export function clearScheduledJobs():
  void {
  scheduledJobs = [];
}

/**
 * Adds scheduled job to store.
 *
 * @param job Scheduled job.
 * @returns Scheduled job.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function addScheduledJob(
  job: ScheduledJob
): ScheduledJob {
  scheduledJobs = [
    ...scheduledJobs,
    job,
  ];

  return job;
}

/**
 * Schedules a job.
 *
 * @param id Scheduled job id.
 * @param task Task text.
 * @param runAt Due timestamp.
 * @param createdAt Creation timestamp.
 * @returns Scheduled job.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function scheduleJob(
  id: string,
  task: string,
  runAt: number,
  createdAt: number
): ScheduledJob {
  return addScheduledJob(
    createScheduledJob(
      id,
      task,
      runAt,
      createdAt
    )
  );
}

/**
 * Finds scheduled job by id.
 *
 * @param id Scheduled job id.
 * @returns Scheduled job or undefined.
 *
 * PURE: No side effects.
 */
export function getScheduledJob(
  id: string
): ScheduledJob | undefined {
  return scheduledJobs.find(
    (job) => job.id === id
  );
}

/**
 * Lists due scheduled jobs.
 *
 * @param now Current timestamp.
 * @returns Due scheduled jobs.
 *
 * PURE: No side effects.
 */
export function listDueScheduledJobs(
  now: number
): ScheduledJob[] {
  return scheduledJobs.filter(
    (job) =>
      isScheduledJobDue(
        job,
        now
      )
  );
}

/**
 * Updates scheduled job in store.
 *
 * @param updatedJob Updated scheduled job.
 * @returns Updated scheduled job.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function updateScheduledJob(
  updatedJob: ScheduledJob
): ScheduledJob {
  scheduledJobs =
    scheduledJobs.map(
      (job) =>
        job.id === updatedJob.id
          ? updatedJob
          : job
    );

  return updatedJob;
}

/**
 * Completes scheduled job by id.
 *
 * @param id Scheduled job id.
 * @param completedAt Completion timestamp.
 * @returns Completed scheduled job or undefined.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function completeScheduledJobById(
  id: string,
  completedAt: number
): ScheduledJob | undefined {
  const job =
    getScheduledJob(id);

  return job
    ? updateScheduledJob(
        completeScheduledJob(
          job,
          completedAt
        )
      )
    : undefined;
}

/**
 * Cancels scheduled job by id.
 *
 * @param id Scheduled job id.
 * @param cancelledAt Cancellation timestamp.
 * @returns Cancelled scheduled job or undefined.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function cancelScheduledJobById(
  id: string,
  cancelledAt: number
): ScheduledJob | undefined {
  const job =
    getScheduledJob(id);

  return job
    ? updateScheduledJob(
        cancelScheduledJob(
          job,
          cancelledAt
        )
      )
    : undefined;
}

/**
 * Fails scheduled job by id.
 *
 * @param id Scheduled job id.
 * @param error Failure message.
 * @param failedAt Failure timestamp.
 * @returns Failed scheduled job or undefined.
 *
 * SIDE EFFECT: Updates in-memory scheduled jobs.
 */
export function failScheduledJobById(
  id: string,
  error: string,
  failedAt: number
): ScheduledJob | undefined {
  const job =
    getScheduledJob(id);

  return job
    ? updateScheduledJob(
        failScheduledJob(
          job,
          error,
          failedAt
        )
      )
    : undefined;
}