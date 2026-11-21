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
} from "../runtime/deadLetterQueue";

import type {
  RetryableScheduledJob,
} from "../runtime/scheduledJobRetry";

import {
  clearDeadLetterQueue,
  deadLetterQueueExists,
  loadDeadLetterQueue,
  parseDeadLetterQueue,
  saveDeadLetterQueue,
  serializeDeadLetterQueue,
} from "./deadLetterQueueRepository";

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
 * Clears dead-letter queue repository test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted dead-letter queue.
 */
function clearDeadLetterQueueRepositoryTestState():
  void {
  clearDeadLetterQueue();
}

beforeEach(() => {
  clearDeadLetterQueueRepositoryTestState();
});

afterEach(() => {
  clearDeadLetterQueueRepositoryTestState();
});

describe("deadLetterQueueRepository", () => {
  it("serializes and parses dead-letter queue", () => {
    const queue =
      createDeadLetterQueueFixture();

    expect(
      parseDeadLetterQueue(
        serializeDeadLetterQueue(
          queue
        )
      )
    ).toEqual(
      queue
    );
  });

  it("parses empty content as empty queue", () => {
    expect(
      parseDeadLetterQueue(
        ""
      )
    ).toEqual(
      createDeadLetterQueue()
    );
  });

  it("loads empty queue when file is missing", () => {
    expect(
      loadDeadLetterQueue()
    ).toEqual(
      createDeadLetterQueue()
    );
  });

  it("saves and loads dead-letter queue", () => {
    const queue =
      createDeadLetterQueueFixture();

    saveDeadLetterQueue(
      queue
    );

    expect(
      loadDeadLetterQueue()
    ).toEqual(
      queue
    );
  });

  it("checks whether dead-letter queue exists", () => {
    expect(
      deadLetterQueueExists()
    ).toBe(false);

    saveDeadLetterQueue(
      createDeadLetterQueueFixture()
    );

    expect(
      deadLetterQueueExists()
    ).toBe(true);
  });

  it("clears persisted dead-letter queue", () => {
    saveDeadLetterQueue(
      createDeadLetterQueueFixture()
    );

    clearDeadLetterQueue();

    expect(
      deadLetterQueueExists()
    ).toBe(false);
  });

  it("does not mutate saved queue", () => {
    const queue =
      createDeadLetterQueueFixture();

    saveDeadLetterQueue(
      queue
    );

    expect(
      queue
    ).toEqual(
      createDeadLetterQueueFixture()
    );
  });
});