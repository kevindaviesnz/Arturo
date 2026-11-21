import {
  describe,
  expect,
  it,
} from "vitest";

import {
  cancelScheduledJob,
  completeScheduledJob,
  createScheduledJob,
  failScheduledJob,
  isScheduledJobDue,
} from "./scheduledJob";

describe("scheduledJob", () => {
  it("creates scheduled job", () => {
    expect(
      createScheduledJob(
        "job-1",
        "Run task",
        200,
        100
      )
    ).toEqual({
      id: "job-1",
      task: "Run task",
      runAt: 200,
      status: "scheduled",
      createdAt: 100,
    });
  });

  it("detects due scheduled job", () => {
    expect(
      isScheduledJobDue(
        createScheduledJob(
          "job-1",
          "Run task",
          200,
          100
        ),
        200
      )
    ).toBe(true);
  });

  it("does not treat future job as due", () => {
    expect(
      isScheduledJobDue(
        createScheduledJob(
          "job-1",
          "Run task",
          200,
          100
        ),
        199
      )
    ).toBe(false);
  });

  it("does not treat cancelled job as due", () => {
    expect(
      isScheduledJobDue(
        cancelScheduledJob(
          createScheduledJob(
            "job-1",
            "Run task",
            200,
            100
          ),
          150
        ),
        300
      )
    ).toBe(false);
  });

  it("marks scheduled job completed", () => {
    expect(
      completeScheduledJob(
        createScheduledJob(
          "job-1",
          "Run task",
          200,
          100
        ),
        250
      )
    ).toMatchObject({
      status: "completed",
      completedAt: 250,
    });
  });

  it("marks scheduled job cancelled", () => {
    expect(
      cancelScheduledJob(
        createScheduledJob(
          "job-1",
          "Run task",
          200,
          100
        ),
        150
      )
    ).toMatchObject({
      status: "cancelled",
      cancelledAt: 150,
    });
  });

  it("marks scheduled job failed", () => {
    expect(
      failScheduledJob(
        createScheduledJob(
          "job-1",
          "Run task",
          200,
          100
        ),
        "Boom",
        250
      )
    ).toMatchObject({
      status: "failed",
      error: "Boom",
      failedAt: 250,
    });
  });
});