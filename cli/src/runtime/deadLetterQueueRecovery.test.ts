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

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  clearDeadLetterQueue,
  saveDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  getRecoveredDeadLetterJobCount,
  recoverDeadLetterQueue,
} from "./deadLetterQueueRecovery";

/**
 * Creates retryable scheduled job fixture.
 *
 * @param id Scheduled job id.
 * @returns Retryable scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createRetryableScheduledJobFixture(
  id: string
): RetryableScheduledJob {
  return {
    id,
    workflowId: "workflow-1",
    task: "Example task",
    runAt: 100,
    createdAt: 50,
    status: "queued",
    retryCount: 0,
  };
}

/**
 * Creates dead-letter queue fixture.
 *
 * @returns Dead-letter queue fixture.
 *
 * PURE: No side effects.
 */
function createDeadLetterQueueFixture() {
  return addDeadLetterJob(
    createDeadLetterQueue(),
    createRetryableScheduledJobFixture(
      "job-1"
    ),
    "Maximum retries exceeded",
    1000
  );
}

/**
 * Clears dead-letter queue recovery test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted dead-letter queue.
 */
function clearDeadLetterQueueRecoveryTestState():
  void {
  clearDeadLetterQueue();
}

beforeEach(() => {
  clearDeadLetterQueueRecoveryTestState();
});

afterEach(() => {
  clearDeadLetterQueueRecoveryTestState();
});

describe("deadLetterQueueRecovery", () => {
  it("recovers persisted dead-letter queue", () => {
    const queue =
      createDeadLetterQueueFixture();

    saveDeadLetterQueue(
      queue
    );

    expect(
      recoverDeadLetterQueue()
    ).toEqual(
      queue
    );
  });

  it("recovers empty queue when none persisted", () => {
    expect(
      recoverDeadLetterQueue()
    ).toEqual(
      createDeadLetterQueue()
    );
  });

  it("gets recovered dead-letter job count", () => {
    expect(
      getRecoveredDeadLetterJobCount(
        createDeadLetterQueueFixture()
      )
    ).toBe(1);
  });
});