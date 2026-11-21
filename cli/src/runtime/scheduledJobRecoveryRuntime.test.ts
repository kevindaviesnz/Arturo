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
  isRecoverableQueuedScheduledJob,
  recoverScheduledJobQueue,
} from "./scheduledJobRecoveryRuntime";

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
 * Clears scheduled job recovery runtime test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 */
function clearScheduledJobRecoveryRuntimeTestState():
  void {
  clearScheduledJobs();
}

beforeEach(() => {
  clearScheduledJobRecoveryRuntimeTestState();
});

afterEach(() => {
  clearScheduledJobRecoveryRuntimeTestState();
});

describe("scheduledJobRecoveryRuntime", () => {
  it("detects recoverable queued jobs", () => {
    expect(
      isRecoverableQueuedScheduledJob(
        createScheduledJobFixture()
      )
    ).toBe(true);
  });

  it("rejects non-queued jobs", () => {
    expect(
      isRecoverableQueuedScheduledJob(
        createScheduledJobFixture({
          status: "completed",
        })
      )
    ).toBe(false);
  });

  it("recovers queued jobs into runtime queue", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "scheduled-job-1",
      }),
    ]);

    expect(
      recoverScheduledJobQueue()
    ).toEqual([
      createScheduledJobFixture({
        id: "scheduled-job-1",
      }),
    ]);
  });

  it("ignores non-queued jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "scheduled-job-1",
        status: "completed",
      }),
    ]);

    expect(
      recoverScheduledJobQueue()
    ).toEqual([]);
  });

  it("returns empty queue when no jobs exist", () => {
    expect(
      recoverScheduledJobQueue()
    ).toEqual([]);
  });

  it("recovers queued jobs deterministically", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-b",
        runAt: 200,
      }),
      createScheduledJobFixture({
        id: "job-a",
        runAt: 100,
      }),
    ]);

    expect(
      recoverScheduledJobQueue().map(
        (job) => job.id
      )
    ).toEqual([
      "job-a",
      "job-b",
    ]);
  });
});