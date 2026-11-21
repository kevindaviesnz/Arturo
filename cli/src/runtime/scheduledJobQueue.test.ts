import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  getRunnableScheduledJobs,
  queueRunnableScheduledJobs,
  queueScheduledJob,
} from "./scheduledJobQueue";

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

describe("scheduledJobQueue", () => {
  it("returns runnable scheduled jobs", () => {
    const jobs = [
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
      createScheduledJobFixture({
        id: "job-2",
        runAt: 3000,
      }),
    ];

    expect(
      getRunnableScheduledJobs(
        jobs,
        2000
      )
    ).toEqual([
      jobs[0],
    ]);
  });

  it("sorts runnable jobs deterministically", () => {
    const jobs = [
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
    ];

    expect(
      getRunnableScheduledJobs(
        jobs,
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

  it("ignores queued jobs", () => {
    const jobs = [
      createScheduledJobFixture({
        id: "job-1",
        status: "queued",
        runAt: 1000,
      }),
    ];

    expect(
      getRunnableScheduledJobs(
        jobs,
        2000
      )
    ).toEqual([]);
  });

  it("ignores future scheduled jobs", () => {
    const jobs = [
      createScheduledJobFixture({
        id: "job-1",
        runAt: 5000,
      }),
    ];

    expect(
      getRunnableScheduledJobs(
        jobs,
        2000
      )
    ).toEqual([]);
  });

  it("queues scheduled job", () => {
    const job =
      createScheduledJobFixture();

    expect(
      queueScheduledJob(
        job,
        2000
      )
    ).toEqual({
      ...job,
      status: "queued",
      queuedAt: 2000,
    });
  });

  it("queues runnable scheduled jobs", () => {
    const jobs = [
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
      createScheduledJobFixture({
        id: "job-2",
        runAt: 5000,
      }),
    ];

    expect(
      queueRunnableScheduledJobs(
        jobs,
        2000
      )
    ).toEqual([
      {
        ...jobs[0],
        status: "queued",
        queuedAt: 2000,
      },
      jobs[1],
    ]);
  });

  it("does not mutate original jobs", () => {
    const jobs = [
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
    ];

    queueRunnableScheduledJobs(
      jobs,
      2000
    );

    expect(
      jobs
    ).toEqual([
      createScheduledJobFixture({
        id: "job-1",
        runAt: 1000,
      }),
    ]);
  });
});