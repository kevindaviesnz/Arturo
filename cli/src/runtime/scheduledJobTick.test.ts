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
  loadScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  createScheduledJobTickReport,
  runScheduledJobTick,
} from "./scheduledJobTick";

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
 * Clears scheduled job tick test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 * - Clears persisted runtime event log.
 */
function clearScheduledJobTickTestState():
  void {
  clearScheduledJobs();
  clearRuntimeEventLog();
}

beforeEach(() => {
  clearScheduledJobTickTestState();
});

afterEach(() => {
  clearScheduledJobTickTestState();
});

describe("scheduledJobTick", () => {
  it("creates scheduled job tick report", () => {
    expect(
      createScheduledJobTickReport(
        200,
        [
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          },
        ],
        [
          createScheduledJobFixture({
            id: "future-job",
          }),
        ]
      )
    ).toEqual({
      checkedAt: 200,
      dispatchedCount: 1,
      dispatchedJobs: [
        {
          scheduledJobId:
            "scheduled-job-1",
          workflowId:
            "workflow-1",
        },
      ],
      remainingJobCount: 1,
    });
  });

  it("dispatches due queued jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 100,
      }),
      createScheduledJobFixture({
        id: "job-2",
        runAt: 500,
      }),
    ]);

    expect(
      runScheduledJobTick(
        200
      )
    ).toEqual({
      checkedAt: 200,
      dispatchedCount: 1,
      dispatchedJobs: [
        {
          scheduledJobId:
            "job-1",
          workflowId:
            "workflow-1",
        },
      ],
      remainingJobCount: 1,
    });
  });

  it("persists remaining jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 100,
      }),
      createScheduledJobFixture({
        id: "job-2",
        runAt: 500,
      }),
    ]);

    runScheduledJobTick(
      200
    );

    expect(
      loadScheduledJobs()
    ).toEqual([
      createScheduledJobFixture({
        id: "job-2",
        runAt: 500,
      }),
    ]);
  });

  it("emits dispatch events", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 100,
      }),
    ]);

    runScheduledJobTick(
      200
    );

    expect(
      loadRuntimeEventLog().events
    ).toEqual([
      {
        sequence: 1,
        id:
          "scheduled-job-dispatched-job-1",
        type:
          "scheduled-job.dispatched",
        level:
          "info",
        message:
          "Scheduled job dispatched: job-1",
        timestamp: 200,
        payload: {
          scheduledJobId:
            "job-1",
          workflowId:
            "workflow-1",
        },
      },
    ]);
  });

  it("does nothing when no jobs are due", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "future-job",
        runAt: 500,
      }),
    ]);

    expect(
      runScheduledJobTick(
        200
      )
    ).toEqual({
      checkedAt: 200,
      dispatchedCount: 0,
      dispatchedJobs: [],
      remainingJobCount: 1,
    });

    expect(
      loadRuntimeEventLog().events
    ).toEqual([]);
  });

  it("dispatches jobs deterministically", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-b",
        runAt: 100,
        createdAt: 50,
      }),
      createScheduledJobFixture({
        id: "job-a",
        runAt: 100,
        createdAt: 50,
      }),
      createScheduledJobFixture({
        id: "job-c",
        runAt: 50,
        createdAt: 50,
      }),
    ]);

    expect(
      runScheduledJobTick(
        200
      ).dispatchedJobs.map(
        (job) =>
          job.scheduledJobId
      )
    ).toEqual([
      "job-c",
      "job-a",
      "job-b",
    ]);
  });
});