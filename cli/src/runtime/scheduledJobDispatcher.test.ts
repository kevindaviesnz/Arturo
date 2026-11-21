import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  getDispatchableScheduledJobs,
  sortScheduledJobsDeterministically,
} from "./scheduledJobDispatcher";

function createJob(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "job-1",
    task: "Run task",
    workflowId: "workflow-1",
    runAt: 100,
    createdAt: 50,
    status: "queued",
    ...overrides,
  };
}

describe("scheduledJobDispatcher", () => {
  it("sorts jobs deterministically", () => {
    expect(
      sortScheduledJobsDeterministically([
        createJob({
          id: "b",
          runAt: 200,
        }),
        createJob({
          id: "a",
          runAt: 100,
        }),
        createJob({
          id: "c",
          runAt: 100,
          createdAt: 25,
        }),
      ]).map(
        (job) => job.id
      )
    ).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("gets dispatchable scheduled jobs", () => {
    expect(
      getDispatchableScheduledJobs(
        [
          createJob({
            id: "job-1",
            runAt: 100,
          }),
          createJob({
            id: "job-2",
            runAt: 500,
          }),
        ],
        200
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "job-1",
    ]);
  });

  it("ignores non-queued jobs", () => {
    expect(
      getDispatchableScheduledJobs(
        [
          createJob({
            status: "completed",
          }),
        ],
        200
      )
    ).toEqual([]);
  });

  it("returns empty list for empty queue", () => {
    expect(
      getDispatchableScheduledJobs(
        [],
        100
      )
    ).toEqual([]);
  });
});