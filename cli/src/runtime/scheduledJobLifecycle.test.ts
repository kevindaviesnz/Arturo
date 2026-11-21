import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  removeScheduledJobById,
  toRetryableScheduledJob,
  upsertScheduledJob,
} from "./scheduledJobLifecycle";

/**
 * Creates scheduled job fixture.
 *
 * @param overrides Partial scheduled job overrides.
 * @returns Scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createScheduledJobFixture(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "scheduled-job-1",
    task: "Run task",
    workflowId: "workflow-1",
    runAt: 100,
    createdAt: 50,
    status: "queued",
    ...overrides,
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
    ...createScheduledJobFixture(),
    retryCount: 2,
    ...overrides,
  };
}

describe("scheduledJobLifecycle", () => {
  it("converts scheduled job to retryable scheduled job", () => {
    expect(
      toRetryableScheduledJob(
        createScheduledJobFixture()
      )
    ).toEqual({
      ...createScheduledJobFixture(),
      retryCount: 0,
    });
  });

  it("preserves existing retry count", () => {
    expect(
      toRetryableScheduledJob(
        createRetryableScheduledJobFixture({
          retryCount: 2,
        })
      )
    ).toMatchObject({
      retryCount: 2,
    });
  });

  it("removes scheduled job by id", () => {
    expect(
      removeScheduledJobById(
        [
          createScheduledJobFixture({
            id: "job-1",
          }),
          createScheduledJobFixture({
            id: "job-2",
          }),
        ],
        "job-1"
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "job-2",
    ]);
  });

  it("upserts new scheduled job", () => {
    expect(
      upsertScheduledJob(
        [],
        createScheduledJobFixture({
          id: "job-1",
        })
      )
    ).toEqual([
      createScheduledJobFixture({
        id: "job-1",
      }),
    ]);
  });

  it("replaces existing scheduled job", () => {
    expect(
      upsertScheduledJob(
        [
          createScheduledJobFixture({
            id: "job-1",
            runAt: 100,
          }),
        ],
        createScheduledJobFixture({
          id: "job-1",
          runAt: 500,
        })
      )
    ).toEqual([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 500,
      }),
    ]);
  });
});