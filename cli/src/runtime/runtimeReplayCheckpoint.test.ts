import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRuntimeReplayCheckpoint,
  hashReplayState,
  verifyReplayCheckpoint,
} from "./runtimeReplayCheckpoint";

/**
 * Creates replay state fixture.
 *
 * @returns Replayed runtime state fixture.
 *
 * PURE: No side effects.
 */
function createReplayState() {
  return {
    eventCount: 2,
    jobs: {
      "job-1": {
        id: "job-1",
        status: "completed",
        lastEventSequence: 2,
      },
    },
  };
}

describe("runtimeReplayCheckpoint", () => {
  it("creates deterministic replay state hashes", () => {
    expect(
      hashReplayState(
        createReplayState()
      )
    ).toBe(
      hashReplayState(
        createReplayState()
      )
    );
  });

  it("treats equivalent object key ordering as identical", () => {
    expect(
      hashReplayState({
        b: 2,
        a: 1,
      })
    ).toBe(
      hashReplayState({
        a: 1,
        b: 2,
      })
    );
  });

  it("creates runtime replay checkpoint", () => {
    const checkpoint =
      createRuntimeReplayCheckpoint(
        createReplayState(),
        2,
        100
      );

    expect(checkpoint).toMatchObject({
      eventCount: 2,
      createdAt: 100,
    });

    expect(
      checkpoint.stateHash
    ).toBeDefined();
  });

  it("verifies valid replay checkpoint", () => {
    const replayState =
      createReplayState();

    const checkpoint =
      createRuntimeReplayCheckpoint(
        replayState,
        2,
        100
      );

    expect(
      verifyReplayCheckpoint(
        replayState,
        checkpoint
      )
    ).toEqual({
      valid: true,
    });
  });

  it("rejects tampered replay state", () => {
    const checkpoint =
      createRuntimeReplayCheckpoint(
        createReplayState(),
        2,
        100
      );

    expect(
      verifyReplayCheckpoint(
        {
          ...createReplayState(),
          jobs: {},
        },
        checkpoint
      )
    ).toEqual({
      valid: false,
      error:
        "Replay checkpoint verification failed",
    });
  });
});