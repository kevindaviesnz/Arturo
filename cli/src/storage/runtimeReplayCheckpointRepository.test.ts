import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createRuntimeReplayCheckpoint,
} from "../runtime/runtimeReplayCheckpoint";

import {
  clearRuntimeReplayCheckpoint,
  loadRuntimeReplayCheckpoint,
  parseRuntimeReplayCheckpoint,
  saveRuntimeReplayCheckpoint,
  serializeRuntimeReplayCheckpoint,
} from "./runtimeReplayCheckpointRepository";

/**
 * Creates runtime replay checkpoint fixture.
 *
 * @returns Runtime replay checkpoint fixture.
 *
 * PURE: No side effects.
 */
function createCheckpointFixture() {
  return createRuntimeReplayCheckpoint(
    {
      eventCount: 1,
      jobs: {},
    },
    1,
    100
  );
}

afterEach(() => {
  clearRuntimeReplayCheckpoint();
});

describe("runtimeReplayCheckpointRepository", () => {
  it("serializes and parses replay checkpoint", () => {
    const checkpoint =
      createCheckpointFixture();

    expect(
      parseRuntimeReplayCheckpoint(
        serializeRuntimeReplayCheckpoint(
          checkpoint
        )
      )
    ).toEqual(checkpoint);
  });

  it("returns undefined when no checkpoint exists", () => {
    clearRuntimeReplayCheckpoint();

    expect(
      loadRuntimeReplayCheckpoint()
    ).toBeUndefined();
  });

  it("saves and loads replay checkpoint", () => {
    const checkpoint =
      createCheckpointFixture();

    saveRuntimeReplayCheckpoint(
      checkpoint
    );

    expect(
      loadRuntimeReplayCheckpoint()
    ).toEqual(checkpoint);
  });

  it("clears replay checkpoint", () => {
    saveRuntimeReplayCheckpoint(
      createCheckpointFixture()
    );

    clearRuntimeReplayCheckpoint();

    expect(
      loadRuntimeReplayCheckpoint()
    ).toBeUndefined();
  });
});