import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import {
  applyRuntimeEventToReplayState,
  createEmptyReplayedRuntimeState,
  getReplayJobId,
  getReplayJobStatus,
  replayRuntimeEvents,
} from "./runtimeReplay";

import {
  replayValidatedRuntimeEvents,
  validateReplayMetadata,
  validateReplayEventSequence,
} from "./runtimeReplay";

/**
 * Creates runtime event fixture.
 *
 * @param sequence Event sequence.
 * @param type Event type.
 * @param jobId Job id.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
function createEvent(
  sequence: number,
  type: string,
  jobId?: string
): RuntimeEventRecord {
  return {
    sequence,
    id: `event-${sequence}`,
    type,
    level: "info",
    message: type,
    timestamp: sequence,
    payload:
      jobId === undefined
        ? undefined
        : {
            jobId,
          },
  };
}

describe("runtimeReplay", () => {
  it("creates empty replayed runtime state", () => {
    expect(
      createEmptyReplayedRuntimeState()
    ).toEqual({
      jobs: {},
      eventCount: 0,
    });
  });

  it("extracts job id from event payload", () => {
    expect(
      getReplayJobId(
        createEvent(
          1,
          "job.queued",
          "job-1"
        )
      )
    ).toBe("job-1");
  });

  it("returns undefined when event has no job id", () => {
    expect(
      getReplayJobId(
        createEvent(
          1,
          "runtime.started"
        )
      )
    ).toBeUndefined();
  });

  it("maps job event types to replay statuses", () => {
    expect(
      getReplayJobStatus(
        "job.queued"
      )
    ).toBe("queued");

    expect(
      getReplayJobStatus(
        "job.started"
      )
    ).toBe("running");

    expect(
      getReplayJobStatus(
        "job.completed"
      )
    ).toBe("completed");

    expect(
      getReplayJobStatus(
        "job.failed"
      )
    ).toBe("failed");
  });

  it("ignores unknown event types while counting them", () => {
    const state =
      applyRuntimeEventToReplayState(
        createEmptyReplayedRuntimeState(),
        createEvent(
          1,
          "runtime.heartbeat"
        )
      );

    expect(state).toEqual({
      jobs: {},
      eventCount: 1,
    });
  });

  it("applies job event to replay state immutably", () => {
    const original =
      createEmptyReplayedRuntimeState();

    const updated =
      applyRuntimeEventToReplayState(
        original,
        createEvent(
          1,
          "job.queued",
          "job-1"
        )
      );

    expect(original.jobs).toEqual({});

    expect(updated.jobs).toEqual({
      "job-1": {
        id: "job-1",
        status: "queued",
        lastEventSequence: 1,
      },
    });
  });

  it("replays job lifecycle events", () => {
    const state =
      replayRuntimeEvents([
        createEvent(
          1,
          "job.queued",
          "job-1"
        ),
        createEvent(
          2,
          "job.started",
          "job-1"
        ),
        createEvent(
          3,
          "job.completed",
          "job-1"
        ),
      ]);

    expect(state).toEqual({
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

  it("validates contiguous event sequence numbers", () => {
  expect(
    validateReplayEventSequence([
      createEvent(
        1,
        "job.queued",
        "job-1"
      ),
      createEvent(
        2,
        "job.started",
        "job-1"
      ),
    ])
  ).toEqual({
    valid: true,
  });
});

it("rejects non-contiguous event sequence numbers", () => {
  expect(
    validateReplayEventSequence([
      createEvent(
        1,
        "job.queued",
        "job-1"
      ),
      createEvent(
        3,
        "job.started",
        "job-1"
      ),
    ])
  ).toEqual({
    valid: false,
    error:
      "Invalid runtime event sequence at event event-3: expected 2, received 3",
  });
});

it("replays only valid event sequences", () => {
  expect(
    replayValidatedRuntimeEvents([
      createEvent(
        1,
        "job.queued",
        "job-1"
      ),
      createEvent(
        2,
        "job.completed",
        "job-1"
      ),
    ])
  ).toMatchObject({
    eventCount: 2,
    jobs: {
      "job-1": {
        status: "completed",
      },
    },
  });
});

it("throws when replay event sequence is invalid", () => {
  expect(() =>
    replayValidatedRuntimeEvents([
      createEvent(
        1,
        "job.queued",
        "job-1"
      ),
      createEvent(
        3,
        "job.completed",
        "job-1"
      ),
    ])
  ).toThrow(
    "Invalid runtime event sequence at event event-3: expected 2, received 3"
  );
});
  
  it("validates replay metadata integrity", () => {
  expect(
    validateReplayMetadata([
      createEvent(
        1,
        "job.queued",
        "job-1"
      ),
      createEvent(
        2,
        "job.started",
        "job-1"
      ),
    ])
  ).toEqual({
    valid: true,
  });
});

it("rejects duplicate runtime event ids", () => {
  expect(
    validateReplayMetadata([
      {
        ...createEvent(
          1,
          "job.queued",
          "job-1"
        ),
        id: "duplicate",
      },
      {
        ...createEvent(
          2,
          "job.started",
          "job-1"
        ),
        id: "duplicate",
      },
    ])
  ).toEqual({
    valid: false,
    error:
      "Duplicate runtime event id detected: duplicate",
  });
});

it("rejects non-monotonic timestamps", () => {
  expect(
    validateReplayMetadata([
      {
        ...createEvent(
          1,
          "job.queued",
          "job-1"
        ),
        timestamp: 10,
      },
      {
        ...createEvent(
          2,
          "job.started",
          "job-1"
        ),
        timestamp: 5,
      },
    ])
  ).toEqual({
    valid: false,
    error:
      "Non-monotonic runtime event timestamp detected at event event-2",
  });
});
  
});