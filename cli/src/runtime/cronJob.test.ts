import {
  describe,
  expect,
  it,
} from "vitest";

import {
  advanceCronJob,
  createCronJob,
} from "./cronJob";

describe("cronJob", () => {
  it("creates cron job", () => {
    const createdAt =
      new Date(
        2026,
        0,
        1,
        10,
        15,
        0
      ).getTime();

    const job =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        createdAt
      );

    expect(job).toMatchObject({
      id: "cron-job-1",
      workflowId: "workflow-1",
      expression: "30 * * * *",
      schedule: {
        type: "hourly",
        minute: 30,
      },
      createdAt,
    });

    expect(
      new Date(
        job.nextRunAt
      ).getMinutes()
    ).toBe(30);
  });

  it("advances cron job", () => {
    const createdAt =
      new Date(
        2026,
        0,
        1,
        10,
        15,
        0
      ).getTime();

    const job =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        createdAt
      );

    const advanced =
      advanceCronJob(
        job
      );

    expect(
      advanced.nextRunAt
    ).toBeGreaterThan(
      job.nextRunAt
    );

    expect(
      new Date(
        advanced.nextRunAt
      ).getMinutes()
    ).toBe(30);
  });

  it("preserves immutability when advancing", () => {
    const createdAt =
      new Date(
        2026,
        0,
        1,
        10,
        15,
        0
      ).getTime();

    const job =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        createdAt
      );

    advanceCronJob(
      job
    );

    expect(
      new Date(
        job.nextRunAt
      ).getHours()
    ).toBe(10);
  });
});