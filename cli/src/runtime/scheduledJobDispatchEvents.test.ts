import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createScheduledJobDispatchedEvent,
  createScheduledJobDispatchedEvents,
} from "./scheduledJobDispatchEvents";

describe("scheduledJobDispatchEvents", () => {
  it("creates scheduled job dispatched event", () => {
    expect(
      createScheduledJobDispatchedEvent(
        {
          scheduledJobId:
            "scheduled-job-1",
          workflowId:
            "workflow-1",
        },
        10,
        2000
      )
    ).toEqual({
      sequence: 10,
      id:
        "scheduled-job-dispatched-scheduled-job-1",
      type:
        "scheduled-job.dispatched",
      level:
        "info",
      message:
        "Scheduled job dispatched: scheduled-job-1",
      timestamp: 2000,
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
      },
    });
  });

  it("creates dispatched events with deterministic sequences", () => {
    expect(
      createScheduledJobDispatchedEvents(
        [
          {
            scheduledJobId:
              "job-a",
            workflowId:
              "workflow-a",
          },
          {
            scheduledJobId:
              "job-b",
            workflowId:
              "workflow-b",
          },
        ],
        20,
        3000
      ).map(
        (event) => event.sequence
      )
    ).toEqual([
      20,
      21,
    ]);
  });
});