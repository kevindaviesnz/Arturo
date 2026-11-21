import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createCronJob,
} from "../runtime/cronJob";

import {
  clearCronJobs,
  cronJobsExist,
  loadCronJobs,
  parseCronJobs,
  saveCronJobs,
  serializeCronJobs,
} from "./cronJobRepository";

/**
 * Creates cron job fixture.
 *
 * @returns Cron job fixture.
 *
 * PURE: No side effects.
 */
function createCronJobFixture() {
  return createCronJob(
    "cron-job-1",
    "workflow-1",
    "30 * * * *",
    new Date(
      2026,
      0,
      1,
      10,
      15,
      0
    ).getTime()
  );
}

/**
 * Clears cron job repository test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted cron jobs.
 */
function clearCronJobRepositoryTestState():
  void {
  clearCronJobs();
}

beforeEach(() => {
  clearCronJobRepositoryTestState();
});

afterEach(() => {
  clearCronJobRepositoryTestState();
});

describe("cronJobRepository", () => {
  it("serializes and parses cron jobs", () => {
    const jobs = [
      createCronJobFixture(),
    ];

    expect(
      parseCronJobs(
        serializeCronJobs(
          jobs
        )
      )
    ).toEqual(
      jobs
    );
  });

  it("parses empty content as empty jobs", () => {
    expect(
      parseCronJobs("")
    ).toEqual([]);
  });

  it("throws for non-array JSON", () => {
    expect(() =>
      parseCronJobs("{}")
    ).toThrow(
      "Cron jobs must be an array"
    );
  });

  it("loads empty list when file is missing", () => {
    expect(
      loadCronJobs()
    ).toEqual([]);
  });

  it("saves and loads cron jobs", () => {
    const jobs = [
      createCronJobFixture(),
    ];

    saveCronJobs(
      jobs
    );

    expect(
      loadCronJobs()
    ).toEqual(
      jobs
    );
  });

  it("checks whether cron jobs exist", () => {
    expect(
      cronJobsExist()
    ).toBe(false);

    saveCronJobs([
      createCronJobFixture(),
    ]);

    expect(
      cronJobsExist()
    ).toBe(true);
  });

  it("clears persisted cron jobs", () => {
    saveCronJobs([
      createCronJobFixture(),
    ]);

    clearCronJobs();

    expect(
      cronJobsExist()
    ).toBe(false);
  });
});