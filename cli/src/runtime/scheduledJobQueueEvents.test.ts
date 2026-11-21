import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  createScheduledJobQueuedEvent,
  createScheduledJobQueuedEvents,
} from "./scheduledJobQueueEvents";

/**
 * Creates scheduled job fixture.
 *
 * @param overrides Partial scheduled job overrides.
 * @returns Scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createScheduledJobFixture(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "scheduled-job-1",
    workflowId: "workflow-1",
    task: "Example task",
    runAt: 1000,
    status: "scheduled",
    createdAt: 500,
    ...overrides,
  };
}

describe("scheduledJobQueueEvents", () => {
  it("creates scheduled job queued event", () => {
    expect(
      createScheduledJobQueuedEvent(
        createScheduledJobFixture(),
        1,
        2000
      )
    ).toEqual({
      sequence: 1,
      id:
        "scheduled-job-queued-scheduled-job-1",
      type:
        "scheduled-job.queued",
      level:
        "info",
      message:
        "Scheduled job queued: scheduled-job-1",
      timestamp: 2000,
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
      },
    });
  });

  it("creates scheduled job queued events with deterministic sequences", () => {
    expect(
      createScheduledJobQueuedEvents(
        [
          createScheduledJobFixture({
            id: "job-a",
          }),
          createScheduledJobFixture({
            id: "job-b",
          }),
        ],
        10,
        2000
      ).map(
        (event) => event.sequence
      )
    ).toEqual([
      10,
      11,
    ]);
  });
});