import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "../runtime/scheduledJob";

import {
  clearScheduledJobs,
  loadScheduledJobs,
  parseScheduledJobs,
  saveScheduledJobs,
  serializeScheduledJobs,
} from "./scheduledJobRepository";

/**
 * Creates scheduled job fixture.
 *
 * @param id Scheduled job id.
 * @returns Scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createScheduledJobFixture(
  id = "job-1"
): ScheduledJob {
  return {
    id,
    task: "Run task",
    runAt: 200,
    status: "scheduled",
    createdAt: 100,
  };
}

/**
 * Clears scheduled job repository test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted scheduled jobs.
 */
function clearScheduledJobRepositoryTestState():
  void {
  clearScheduledJobs();
}

beforeEach(() => {
  clearScheduledJobRepositoryTestState();
});

afterEach(() => {
  clearScheduledJobRepositoryTestState();
});

describe("scheduledJobRepository", () => {
  it("serializes and parses scheduled jobs", () => {
    const jobs = [
      createScheduledJobFixture(),
    ];

    expect(
      parseScheduledJobs(
        serializeScheduledJobs(
          jobs
        )
      )
    ).toEqual(
      jobs
    );
  });

  it("parses empty content as empty jobs", () => {
    expect(
      parseScheduledJobs(
        ""
      )
    ).toEqual([]);
  });

  it("loads empty list when file is missing", () => {
    expect(
      loadScheduledJobs()
    ).toEqual([]);
  });

  it("saves and loads scheduled jobs", () => {
    const jobs = [
      createScheduledJobFixture(),
    ];

    saveScheduledJobs(
      jobs
    );

    expect(
      loadScheduledJobs()
    ).toEqual(
      jobs
    );
  });

  it("clears scheduled jobs", () => {
    saveScheduledJobs([
      createScheduledJobFixture(),
    ]);

    clearScheduledJobs();

    expect(
      loadScheduledJobs()
    ).toEqual([]);
  });

  it("throws for invalid JSON", () => {
    expect(() =>
      parseScheduledJobs(
        "{"
      )
    ).toThrow();
  });
});