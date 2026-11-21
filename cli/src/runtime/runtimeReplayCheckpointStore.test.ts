import {
  afterEach,
  beforeEach,
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
  clearRuntimeReplayCheckpoint,
  loadRuntimeReplayCheckpoint,
} from "../storage/runtimeReplayCheckpointRepository";

import {
  createAndSaveReplayCheckpoint,
  loadAndVerifyReplayCheckpoint,
} from "./runtimeReplayCheckpointStore";

/**
 * Creates runtime event log fixture.
 *
 * @returns Runtime event log with one job event.
 *
 * PURE: No side effects.
 */
function createRuntimeLogFixture() {
  return appendRuntimeEvent(
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
  );
}

/**
 * Clears replay checkpoint store test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted runtime event log.
 * - Clears persisted replay checkpoint.
 */
function clearReplayCheckpointStoreTestState():
  void {
  clearRuntimeEventLog();
  clearRuntimeReplayCheckpoint();
}

beforeEach(() => {
  clearReplayCheckpointStoreTestState();
});

afterEach(() => {
  clearReplayCheckpointStoreTestState();
});

describe("runtimeReplayCheckpointStore", () => {
  it("creates and saves replay checkpoint", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    const checkpoint =
      createAndSaveReplayCheckpoint(
        100
      );

    expect(checkpoint).toMatchObject({
      eventCount: 1,
      createdAt: 100,
    });

    expect(
      loadRuntimeReplayCheckpoint()
    ).toEqual(checkpoint);
  });

  it("verifies saved replay checkpoint", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    createAndSaveReplayCheckpoint(
      100
    );

    expect(
      loadAndVerifyReplayCheckpoint()
    ).toEqual({
      valid: true,
    });
  });

  it("returns failure when checkpoint is missing", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    clearRuntimeReplayCheckpoint();

    expect(
      loadAndVerifyReplayCheckpoint()
    ).toEqual({
      valid: false,
      error:
        "Runtime replay checkpoint not found",
    });
  });

  it("rejects checkpoint when runtime events diverge", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    createAndSaveReplayCheckpoint(
      100
    );

    saveRuntimeEventLog(
      appendRuntimeEvent(
        createRuntimeLogFixture(),
        {
          id: "event-2",
          type: "job.completed",
          level: "success",
          message: "Job completed",
          timestamp: 2000,
          payload: {
            jobId: "job-1",
          },
        }
      )
    );

    expect(
      loadAndVerifyReplayCheckpoint()
    ).toEqual({
      valid: false,
      error:
        "Replay checkpoint verification failed",
    });
  });
});