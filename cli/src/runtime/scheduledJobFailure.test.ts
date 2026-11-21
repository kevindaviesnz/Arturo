import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createDeadLetterQueue,
} from "./deadLetterQueue";

import type {
  RetryPolicy,
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  handleScheduledJobFailure,
} from "./scheduledJobFailure";

/**
 * Creates retry policy fixture.
 *
 * @returns Retry policy fixture.
 *
 * PURE: No side effects.
 */
function createRetryPolicyFixture():
  RetryPolicy {
  return {
    maxRetries: 3,
    retryDelayMs: 1000,
  };
}

/**
 * Creates retryable scheduled job fixture.
 *
 * @param overrides Partial scheduled job overrides.
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
    runAt: 100,
    createdAt: 50,
    status: "queued",
    retryCount: 0,
    ...overrides,
  };
}

describe("scheduledJobFailure", () => {
  it("schedules retry when retry is allowed", () => {
    expect(
      handleScheduledJobFailure(
        createRetryableScheduledJobFixture({
          retryCount: 0,
        }),
        createRetryPolicyFixture(),
        createDeadLetterQueue(),
        "Temporary failure",
        500
      )
    ).toMatchObject({
      retryJob: {
        retryCount: 1,
        runAt: 1100,
      },
      deadLetterQueue: {
        jobs: [],
      },
    });
  });

  it("dead-letters job when retry limit is reached", () => {
    const result =
      handleScheduledJobFailure(
        createRetryableScheduledJobFixture({
          retryCount: 3,
        }),
        createRetryPolicyFixture(),
        createDeadLetterQueue(),
        "Permanent failure",
        500
      );

    expect(
      result.retryJob
    ).toBeUndefined();

    expect(
      result.deadLetterQueue.jobs
    ).toHaveLength(1);

    expect(
      result.deadLetterQueue.jobs[0]
    ).toMatchObject({
      reason:
        "Permanent failure",
      failedAt: 500,
      job: {
        id:
          "scheduled-job-1",
        retryCount: 3,
      },
    });
  });

  it("preserves dead-letter queue immutability", () => {
    const queue =
      createDeadLetterQueue();

    handleScheduledJobFailure(
      createRetryableScheduledJobFixture({
        retryCount: 3,
      }),
      createRetryPolicyFixture(),
      queue,
      "Permanent failure",
      500
    );

    expect(queue).toEqual({
      jobs: [],
    });
  });
});