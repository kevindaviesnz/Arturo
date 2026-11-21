import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCronJobs,
  loadCronJobs,
  saveCronJobs,
} from "../storage/cronJobRepository";

import {
  clearScheduledJobs,
  loadScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  createCronJob,
} from "./cronJob";

import {
  createCronJobRuntimeTickReport,
  runCronJobRuntimeTick,
} from "./cronJobRuntime";

/**
 * Clears cron job runtime test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted cron jobs.
 * - Clears persisted scheduled jobs.
 */
function clearCronJobRuntimeTestState():
  void {
  clearCronJobs();
  clearScheduledJobs();
}

beforeEach(() => {
  clearCronJobRuntimeTestState();
});

afterEach(() => {
  clearCronJobRuntimeTestState();
});

describe("cronJobRuntime", () => {
  it("creates cron job runtime tick report", () => {
    expect(
      createCronJobRuntimeTickReport(
        1000,
        1,
        1,
        2
      )
    ).toEqual({
      checkedAt: 1000,
      dueCronJobCount: 1,
      scheduledJobCount: 1,
      persistedCronJobCount: 2,
    });
  });

  it("creates scheduled jobs from due cron jobs", () => {
    const createdAt =
      new Date(
        2026,
        0,
        1,
        10,
        0,
        0
      ).getTime();

    const now =
      new Date(
        2026,
        0,
        1,
        10,
        45,
        0
      ).getTime();

    saveCronJobs([
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        createdAt
      ),
    ]);

    expect(
      runCronJobRuntimeTick(
        now
      )
    ).toMatchObject({
      checkedAt: now,
      dueCronJobCount: 1,
      scheduledJobCount: 1,
      persistedCronJobCount: 1,
    });

    expect(
      loadScheduledJobs()
    ).toHaveLength(1);
  });

  it("advances due cron jobs", () => {
    const createdAt =
      new Date(
        2026,
        0,
        1,
        10,
        0,
        0
      ).getTime();

    const now =
      new Date(
        2026,
        0,
        1,
        10,
        45,
        0
      ).getTime();

    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        createdAt
      );

    saveCronJobs([
      cronJob,
    ]);

    runCronJobRuntimeTick(
      now
    );

    expect(
      loadCronJobs()[0].nextRunAt
    ).toBeGreaterThan(
      cronJob.nextRunAt
    );
  });

  it("does nothing when no cron jobs are due", () => {
    const now =
      new Date(
        2026,
        0,
        1,
        10,
        0,
        0
      ).getTime();

    saveCronJobs([
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        now
      ),
    ]);

    expect(
      runCronJobRuntimeTick(
        now
      )
    ).toMatchObject({
      dueCronJobCount: 0,
      scheduledJobCount: 0,
      persistedCronJobCount: 1,
    });

    expect(
      loadScheduledJobs()
    ).toEqual([]);
  });
});