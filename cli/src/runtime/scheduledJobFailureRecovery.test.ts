import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addDeadLetterJob,
  createDeadLetterQueue,
} from "./deadLetterQueue";

import {
  clearDeadLetterQueue,
  saveDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  clearScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  createScheduledJobFailureRecoverySummary,
  recoverScheduledJobFailureState,
} from "./scheduledJobFailureRecovery";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

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
    retryCount: 1,
    ...overrides,
  };
}

/**
 * Clears scheduled job failure recovery test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 * - Clears persisted dead-letter queue.
 */
function clearScheduledJobFailureRecoveryTestState():
  void {
  clearScheduledJobs();
  clearDeadLetterQueue();
}

beforeEach(() => {
  clearScheduledJobFailureRecoveryTestState();
});

afterEach(() => {
  clearScheduledJobFailureRecoveryTestState();
});

describe("scheduledJobFailureRecovery", () => {
  it("creates failure recovery summary", () => {
    expect(
      createScheduledJobFailureRecoverySummary(
        [
          createRetryableScheduledJobFixture({
            id: "retry-job-1",
            retryCount: 1,
          }),
          createRetryableScheduledJobFixture({
            id: "non-retry-job",
            retryCount: 0,
          }),
        ],
        addDeadLetterJob(
          createDeadLetterQueue(),
          createRetryableScheduledJobFixture({
            id: "dead-job-1",
          }),
          "Failed",
          1000
        )
      )
    ).toEqual({
      retryJobCount: 1,
      deadLetterJobCount: 1,
    });
  });

  it("recovers scheduled job failure state from persistence", () => {
    saveScheduledJobs([
      createRetryableScheduledJobFixture({
        id: "retry-job-1",
        retryCount: 1,
      }),
    ]);

    saveDeadLetterQueue(
      addDeadLetterJob(
        createDeadLetterQueue(),
        createRetryableScheduledJobFixture({
          id: "dead-job-1",
        }),
        "Failed",
        1000
      )
    );

    expect(
      recoverScheduledJobFailureState()
    ).toEqual({
      retryJobCount: 1,
      deadLetterJobCount: 1,
    });
  });

  it("returns zero counts when nothing is persisted", () => {
    expect(
      recoverScheduledJobFailureState()
    ).toEqual({
      retryJobCount: 0,
      deadLetterJobCount: 0,
    });
  });
});