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
  queueDueScheduledJobs,
} from "./scheduledJobQueueStore";

import {

  clearRuntimeEventLog,

  loadRuntimeEventLog,

} from "../storage/runtimeEventRepository";


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
    workflowId: "workflow-1",
    task: "Example task",
    runAt: 1000,
    status: "scheduled",
    createdAt: 500,
    ...overrides,
  };
}

/**
 * Clears scheduled job queue store test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 */
function clearScheduledJobQueueStoreTestState():
  void {
  clearScheduledJobs();
  clearRuntimeEventLog();
}

beforeEach(() => {
  clearScheduledJobQueueStoreTestState();
});

afterEach(() => {
  clearScheduledJobQueueStoreTestState();
});

describe("scheduledJobQueueStore", () => {
  it("queues due scheduled jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
      createScheduledJobFixture({
        id: "job-2",
        runAt: 5000,
      }),
    ]);

    expect(
      queueDueScheduledJobs(
        2000
      )
    ).toEqual([
{
  id: "job-1",
  workflowId: "workflow-1",
  task: "Example task",
  runAt: 1000,
  status: "queued",
  queuedAt: 2000,
  createdAt: 500,
}
    ]);
  });

  it("persists queued jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
    ]);

    queueDueScheduledJobs(
      2000
    );

    expect(
      loadScheduledJobs()
    ).toEqual([
      {
        id: "job-1",
        workflowId:
          "workflow-1",
        task: "Example task",
        runAt: 1000,
        status: "queued",
        queuedAt: 2000,
        createdAt: 500,
      },
    ]);
  });

  it("returns empty list when no jobs are due", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 5000,
      }),
    ]);

    expect(
      queueDueScheduledJobs(
        2000
      )
    ).toEqual([]);
  });

  it("does not requeue queued jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
        status: "queued",
        queuedAt: 1500,
      }),
    ]);

    expect(
      queueDueScheduledJobs(
        2000
      )
    ).toEqual([]);
  });

  it("queues jobs deterministically", () => {
    saveScheduledJobs([
      createScheduledJobFixture({
        id: "job-c",
        runAt: 1000,
      }),
      createScheduledJobFixture({
        id: "job-a",
        runAt: 1000,
      }),
      createScheduledJobFixture({
        id: "job-b",
        runAt: 500,
      }),
    ]);

    expect(
      queueDueScheduledJobs(
        2000
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "job-b",
      "job-a",
      "job-c",
    ]);
  });

  it("emits scheduled job queued events", () => {
  saveScheduledJobs([
    createScheduledJobFixture({
      id: "job-1",
      runAt: 1000,
    }),
  ]);

  queueDueScheduledJobs(
    2000
  );

  expect(
    loadRuntimeEventLog().events
  ).toEqual([
    {
      sequence: 1,
      id:
        "scheduled-job-queued-job-1",
      type:
        "scheduled-job.queued",
      level:
        "info",
      message:
        "Scheduled job queued: job-1",
      timestamp: 2000,
      payload: {
        scheduledJobId:
          "job-1",
        workflowId:
          "workflow-1",
      },
    },
  ]);
  });
  
});