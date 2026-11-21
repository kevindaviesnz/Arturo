import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateRetryTime,
  createRetryScheduledEvent,
} from "./scheduledJobRetry";

describe("scheduledJobRetry", () => {
  it("calculates deterministic retry timestamp", () => {
    expect(
      calculateRetryTime(
        1000,
        5000
      )
    ).toBe(6000);
  });

  it("creates retry scheduled event", () => {
    const event =
      createRetryScheduledEvent(
        "scheduled-job-1",
        "workflow-1",
        6000
      );

    expect(event).toMatchObject({
      type:
        "scheduled-job.retry-scheduled",
      level: "warn",
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
        retryAt: 6000,
      },
    });
  });
});