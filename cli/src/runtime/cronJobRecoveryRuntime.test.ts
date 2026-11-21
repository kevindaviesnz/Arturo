import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCronJobs,
  saveCronJobs,
} from "../storage/cronJobRepository";

import {
  createCronJob,
} from "./cronJob";

import {
  recoverCronJobs,
} from "./cronJobRecoveryRuntime";

/**
 * Clears cron recovery test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted cron jobs.
 */
function clearCronRecoveryTestState():
  void {
  clearCronJobs();
}

beforeEach(() => {
  clearCronRecoveryTestState();
});

afterEach(() => {
  clearCronRecoveryTestState();
});

describe("cronJobRecoveryRuntime", () => {
  it("recovers persisted cron jobs", () => {
    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "30 * * * *",
        1000
      );

    saveCronJobs([
      cronJob,
    ]);

    expect(
      recoverCronJobs()
    ).toEqual([
      cronJob,
    ]);
  });

  it("returns empty list when no cron jobs exist", () => {
    expect(
      recoverCronJobs()
    ).toEqual([]);
  });
});