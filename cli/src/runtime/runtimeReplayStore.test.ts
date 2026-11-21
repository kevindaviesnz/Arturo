import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtimeEventLog";

import {
  clearRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  replayPersistedRuntimeEvents,
} from "./runtimeReplayStore";

/**
 * Creates persisted runtime event log fixture.
 *
 * @returns Runtime event log with job lifecycle events.
 *
 * PURE: No side effects.
 */
function createPersistedReplayFixture() {
  return appendRuntimeEvent(
    appendRuntimeEvent(
      appendRuntimeEvent(
        createRuntimeEventLog(),
        {
          id: "event-1",
          type: "job.queued",
          level: "info",
          message: "Job queued",
          timestamp: 1000,
          payload: {
            jobId: "job-1",
          },
        }
      ),
      {
        id: "event-2",
        type: "job.started",
        level: "info",
        message: "Job started",
        timestamp: 2000,
        payload: {
          jobId: "job-1",
        },
      }
    ),
    {
      id: "event-3",
      type: "job.completed",
      level: "success",
      message: "Job completed",
      timestamp: 3000,
      payload: {
        jobId: "job-1",
      },
    }
  );
}

afterEach(() => {
  clearRuntimeEventLog();
});

describe("runtimeReplayStore", () => {
  it("replays persisted runtime events", () => {
    saveRuntimeEventLog(
      createPersistedReplayFixture()
    );

    expect(
      replayPersistedRuntimeEvents()
    ).toEqual({
      eventCount: 3,
      jobs: {
        "job-1": {
          id: "job-1",
          status: "completed",
          lastEventSequence: 3,
        },
      },
    });
  });

  it("returns empty replay state when no events are persisted", () => {
    clearRuntimeEventLog();

    expect(
      replayPersistedRuntimeEvents()
    ).toEqual({
      eventCount: 0,
      jobs: {},
    });
  });
});