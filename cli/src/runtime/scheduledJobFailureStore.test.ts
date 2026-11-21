import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearDeadLetterQueue,
  loadDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  clearScheduledJobs,
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  persistScheduledJobFailure,
} from "./scheduledJobFailureStore";

import type {
  RetryPolicy,
  RetryableScheduledJob,
} from "./scheduledJobRetry";

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
    runAt: 100,
    createdAt: 50,
    status: "queued",
    retryCount: 0,
    ...overrides,
  };
}

/**
 * Clears scheduled job failure store test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 * - Clears persisted dead-letter queue.
 * - Clears persisted runtime event log.
 */
function clearScheduledJobFailureStoreTestState():
  void {
  clearScheduledJobs();
  clearDeadLetterQueue();
  clearRuntimeEventLog();
}

beforeEach(() => {
  clearScheduledJobFailureStoreTestState();
});

afterEach(() => {
  clearScheduledJobFailureStoreTestState();
});

describe("scheduledJobFailureStore", () => {
  it("persists retry job and retry event", () => {
    saveScheduledJobs([
      createRetryableScheduledJobFixture({
        retryCount: 0,
      }),
    ]);

    expect(
      persistScheduledJobFailure(
        createRetryableScheduledJobFixture({
          retryCount: 0,
        }),
        createRetryPolicyFixture(),
        "Temporary failure",
        500
      )
    ).toEqual({
      retryScheduled: true,
      deadLettered: false,
    });

    expect(
      loadScheduledJobs()
    ).toMatchObject([
      {
        id: "scheduled-job-1",
        retryCount: 1,
        runAt: 1100,
      },
    ]);

    expect(
      loadRuntimeEventLog().events[0]
    ).toMatchObject({
      type:
        "scheduled-job.retry-scheduled",
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        retryCount: 1,
      },
    });
  });

  it("replaces existing job on retry", () => {
    saveScheduledJobs([
      createRetryableScheduledJobFixture({
        id: "scheduled-job-1",
        retryCount: 0,
      }),
    ]);

    persistScheduledJobFailure(
      createRetryableScheduledJobFixture({
        id: "scheduled-job-1",
        retryCount: 0,
      }),
      createRetryPolicyFixture(),
      "Temporary failure",
      500
    );

    expect(
      loadScheduledJobs()
    ).toHaveLength(1);
  });

  it("persists dead-letter queue and dead-letter event", () => {
    saveScheduledJobs([
      createRetryableScheduledJobFixture({
        retryCount: 3,
      }),
    ]);

    expect(
      persistScheduledJobFailure(
        createRetryableScheduledJobFixture({
          retryCount: 3,
        }),
        createRetryPolicyFixture(),
        "Permanent failure",
        500
      )
    ).toEqual({
      retryScheduled: false,
      deadLettered: true,
    });

    expect(
      loadScheduledJobs()
    ).toEqual([]);

    expect(
      loadDeadLetterQueue().jobs
    ).toHaveLength(1);

    expect(
      loadRuntimeEventLog().events[0]
    ).toMatchObject({
      type:
        "scheduled-job.dead-lettered",
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        reason:
          "Permanent failure",
      },
    });
  });
});