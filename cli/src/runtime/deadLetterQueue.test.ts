import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  addDeadLetterJob,
  createDeadLetterQueue,
  findDeadLetterJob,
  getDeadLetterJobCount,
} from "./deadLetterQueue";

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

describe("deadLetterQueue", () => {
  it("creates empty queue", () => {
    expect(
      createDeadLetterQueue()
    ).toEqual({
      jobs: [],
    });
  });

  it("adds dead-letter job", () => {
    const queue =
      addDeadLetterJob(
        createDeadLetterQueue(),
        createRetryableScheduledJobFixture(
          "job-1"
        ),
        "Maximum retries exceeded",
        1000
      );

    expect(
      getDeadLetterJobCount(
        queue
      )
    ).toBe(1);

    expect(
      queue.jobs[0]
    ).toMatchObject({
      reason:
        "Maximum retries exceeded",
      failedAt: 1000,
      job: {
        id: "job-1",
      },
    });
  });

  it("preserves immutability", () => {
    const original =
      createDeadLetterQueue();

    const updated =
      addDeadLetterJob(
        original,
        createRetryableScheduledJobFixture(
          "job-1"
        ),
        "Failure",
        1000
      );

    expect(original).toEqual({
      jobs: [],
    });

    expect(
      updated.jobs.length
    ).toBe(1);
  });

  it("finds dead-letter job", () => {
    const queue =
      addDeadLetterJob(
        createDeadLetterQueue(),
        createRetryableScheduledJobFixture(
          "job-1"
        ),
        "Failure",
        1000
      );

    expect(
      findDeadLetterJob(
        queue,
        "job-1"
      )
    ).toMatchObject({
      reason: "Failure",
      failedAt: 1000,
      job: {
        id: "job-1",
      },
    });
  });

  it("returns undefined for unknown job", () => {
    expect(
      findDeadLetterJob(
        createDeadLetterQueue(),
        "missing-job"
      )
    ).toBeUndefined();
  });

  it("preserves deterministic ordering", () => {
    const queue =
      addDeadLetterJob(
        addDeadLetterJob(
          addDeadLetterJob(
            createDeadLetterQueue(),
            createRetryableScheduledJobFixture(
              "job-1"
            ),
            "Failure 1",
            1000
          ),
          createRetryableScheduledJobFixture(
            "job-2"
          ),
          "Failure 2",
          1001
        ),
        createRetryableScheduledJobFixture(
          "job-3"
        ),
        "Failure 3",
        1002
      );

    expect(
      queue.jobs.map(
        (entry) =>
          entry.job.id
      )
    ).toEqual([
      "job-1",
      "job-2",
      "job-3",
    ]);
  });
});