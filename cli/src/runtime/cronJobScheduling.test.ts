import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCronJob,
} from "./cronJob";

import {
  createScheduledJobsFromCronJobs,
} from "./cronJobScheduling";

describe("cronJobScheduling", () => {
  it("creates scheduled jobs from cron jobs", () => {
    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        new Date(
          2026,
          0,
          1,
          10,
          0,
          0
        ).getTime()
      );

    const result =
      createScheduledJobsFromCronJobs(
        [cronJob],
        1000
      );

    expect(
      result.scheduledJobs
    ).toHaveLength(1);

    expect(
      result.scheduledJobs[0]
    ).toEqual({
      id: "cron-job-1-1000",
      task: "workflow-1",
      runAt:
        cronJob.nextRunAt,
      status: "scheduled",
      createdAt: 1000,
    });
  });

  it("returns empty list for no cron jobs", () => {
    expect(
      createScheduledJobsFromCronJobs(
        [],
        1000
      )
    ).toEqual({
      scheduledJobs: [],
    });
  });
});