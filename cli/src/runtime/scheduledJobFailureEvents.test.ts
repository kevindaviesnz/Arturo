import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  createScheduledJobDeadLetteredEvent,
  createScheduledJobRetryEvent,
} from "./scheduledJobFailureEvents";

/**
 * Creates retryable scheduled job fixture.
 *
 * @param overrides Partial retryable scheduled job overrides.
 * @returns Retryable scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createRetryableScheduledJobFixture(
  overrides:
    Partial<RetryableScheduledJob> = {}
): RetryableScheduledJob {
  return {
    id: "scheduled-job-1",
    workflowId: "workflow-1",
    task: "Example task",
    runAt: 1000,
    createdAt: 500,
    status: "queued",
    retryCount: 1,
    ...overrides,
  };
}

describe("scheduledJobFailureEvents", () => {
  it("creates scheduled job retry event", () => {
    expect(
      createScheduledJobRetryEvent(
        createRetryableScheduledJobFixture(),
        10,
        2000
      )
    ).toEqual({
      sequence: 10,
      id:
        "scheduled-job-retry-scheduled-job-1-1",
      type:
        "scheduled-job.retry-scheduled",
      level:
        "warn",
      message:
        "Scheduled job retry scheduled: scheduled-job-1",
      timestamp: 2000,
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
        retryCount: 1,
        runAt: 1000,
      },
    });
  });

  it("creates scheduled job dead-lettered event", () => {
    expect(
      createScheduledJobDeadLetteredEvent(
        createRetryableScheduledJobFixture({
          retryCount: 3,
        }),
        "Maximum retries exceeded",
        11,
        3000
      )
    ).toEqual({
      sequence: 11,
      id:
        "scheduled-job-dead-lettered-scheduled-job-1",
      type:
        "scheduled-job.dead-lettered",
      level:
        "error",
      message:
        "Scheduled job dead-lettered: scheduled-job-1",
      timestamp: 3000,
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
        retryCount: 3,
        reason:
          "Maximum retries exceeded",
      },
    });
  });
});