import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  clearScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  isRecoverableScheduledJob,
  recoverFutureScheduledJobs,
  recoverRunnableScheduledJobs,
  recoverScheduledJobs,
  sortScheduledJobs,
} from "./scheduledJobRecovery";

/**
 * Creates scheduled job fixture.
 *
 * @param overrides Optional scheduled job overrides.
 * @returns Scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createScheduledJobFixture(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "job-1",
    task: "Run task",
    runAt: 200,
    status: "scheduled",
    createdAt: 100,
    ...overrides,
  };
}

/**
 * Clears scheduled job recovery test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 */
function clearScheduledJobRecoveryTestState():
  void {
  clearScheduledJobs();
}

beforeEach(() => {
  clearScheduledJobRecoveryTestState();
});

afterEach(() => {
  clearScheduledJobRecoveryTestState();
});

describe("scheduledJobRecovery", () => {
  it("sorts scheduled jobs deterministically", () => {
    expect(
      sortScheduledJobs([
        createScheduledJobFixture({
          id: "c",
          runAt: 200,
          createdAt: 100,
        }),
        createScheduledJobFixture({
          id: "a",
          runAt: 100,
          createdAt: 100,
        }),
        createScheduledJobFixture({
          id: "b",
          runAt: 200,
          createdAt: 50,
        }),
      ]).map(
        (job) => job.id
      )
    ).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("detects recoverable scheduled job", () => {
    expect(
      isRecoverableScheduledJob(
        createScheduledJobFixture()
      )
    ).toBe(true);
  });

  it("rejects invalid scheduled job", () => {
    expect(
      isRecoverableScheduledJob({
        ...createScheduledJobFixture(),
        id: "",
      })
    ).toBe(false);
  });

  it("recovers persisted scheduled jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-2",
        runAt: 300,
      }),
      createScheduledJobFixture({
        id: "job-1",
        runAt: 100,
      }),
    ]);

    expect(
      recoverScheduledJobs().map(
        (job) => job.id
      )
    ).toEqual([
      "job-1",
      "job-2",
    ]);
  });

  it("recovers runnable scheduled jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "due",
        runAt: 100,
      }),
      createScheduledJobFixture({
        id: "future",
        runAt: 300,
      }),
    ]);

    expect(
      recoverRunnableScheduledJobs(
        100
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "due",
    ]);
  });

  it("recovers future scheduled jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "due",
        runAt: 100,
      }),
      createScheduledJobFixture({
        id: "future",
        runAt: 300,
      }),
    ]);

    expect(
      recoverFutureScheduledJobs(
        100
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "future",
    ]);
  });
});