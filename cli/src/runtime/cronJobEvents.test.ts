import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCronJob,
} from "./cronJob";

import {
  createCronJobAdvancedEvent,
  createCronJobScheduledEvent,
} from "./cronJobEvents";

describe("cronJobEvents", () => {
  it("creates cron job scheduled event", () => {
    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        1000
      );

    expect(
      createCronJobScheduledEvent(
        cronJob,
        1,
        2000
      )
    ).toMatchObject({
      sequence: 1,
      id:
        "cron-job-scheduled-cron-job-1-2000",
      type:
        "cron-job.scheduled",
      level:
        "info",
      message:
        "Cron job scheduled: cron-job-1",
      timestamp: 2000,
      payload: {
        cronJobId:
          "cron-job-1",
        workflowId:
          "workflow-1",
        expression:
          "30 * * * *",
      },
    });
  });

  it("creates cron job advanced event", () => {
    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        1000
      );

    expect(
      createCronJobAdvancedEvent(
        cronJob,
        2,
        3000
      )
    ).toMatchObject({
      sequence: 2,
      id:
        "cron-job-advanced-cron-job-1-3000",
      type:
        "cron-job.advanced",
      level:
        "info",
      message:
        "Cron job advanced: cron-job-1",
      timestamp: 3000,
      payload: {
        cronJobId:
          "cron-job-1",
        workflowId:
          "workflow-1",
        expression:
          "30 * * * *",
      },
    });
  });
});