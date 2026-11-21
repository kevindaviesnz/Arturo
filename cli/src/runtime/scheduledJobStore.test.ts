import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearScheduledJobs,
  completeScheduledJobById,
  failScheduledJobById,
  getScheduledJob,
  listDueScheduledJobs,
  listScheduledJobs,
  scheduleJob,
  cancelScheduledJobById,
} from "./scheduledJobStore";

beforeEach(() => {
  clearScheduledJobs();
});

describe("scheduledJobStore", () => {
  it("schedules job", () => {
    expect(
      scheduleJob(
        "job-1",
        "Run task",
        200,
        100
      )
    ).toMatchObject({
      id: "job-1",
      status: "scheduled",
    });

    expect(
      listScheduledJobs()
    ).toHaveLength(1);
  });

  it("gets scheduled job by id", () => {
    scheduleJob(
      "job-1",
      "Run task",
      200,
      100
    );

    expect(
      getScheduledJob(
        "job-1"
      )
    ).toMatchObject({
      id: "job-1",
    });
  });

  it("lists due scheduled jobs", () => {
    scheduleJob(
      "due",
      "Run due",
      100,
      1
    );

    scheduleJob(
      "future",
      "Run later",
      300,
      1
    );

    expect(
      listDueScheduledJobs(
        100
      ).map(
        (job) => job.id
      )
    ).toEqual([
      "due",
    ]);
  });

  it("completes scheduled job by id", () => {
    scheduleJob(
      "job-1",
      "Run task",
      200,
      100
    );

    expect(
      completeScheduledJobById(
        "job-1",
        250
      )
    ).toMatchObject({
      status: "completed",
      completedAt: 250,
    });
  });

  it("cancels scheduled job by id", () => {
    scheduleJob(
      "job-1",
      "Run task",
      200,
      100
    );

    expect(
      cancelScheduledJobById(
        "job-1",
        150
      )
    ).toMatchObject({
      status: "cancelled",
      cancelledAt: 150,
    });
  });

  it("fails scheduled job by id", () => {
    scheduleJob(
      "job-1",
      "Run task",
      200,
      100
    );

    expect(
      failScheduledJobById(
        "job-1",
        "Boom",
        250
      )
    ).toMatchObject({
      status: "failed",
      error: "Boom",
      failedAt: 250,
    });
  });

  it("returns undefined for missing job updates", () => {
    expect(
      completeScheduledJobById(
        "missing",
        1
      )
    ).toBeUndefined();

    expect(
      cancelScheduledJobById(
        "missing",
        1
      )
    ).toBeUndefined();

    expect(
      failScheduledJobById(
        "missing",
        "Boom",
        1
      )
    ).toBeUndefined();
  });
});