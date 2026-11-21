import {
  createRuntimeReplayCheckpoint,
  verifyReplayCheckpoint,
  type ReplayCheckpointVerification,
  type RuntimeReplayCheckpoint,
} from "./runtimeReplayCheckpoint";

import {
  replayPersistedRuntimeEvents,
} from "./runtimeReplayStore";

import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  loadRuntimeReplayCheckpoint,
  saveRuntimeReplayCheckpoint,
} from "../storage/runtimeReplayCheckpointRepository";

/**
 * Creates and saves replay checkpoint from persisted runtime events.
 *
 * @param createdAt Checkpoint creation timestamp.
 * @returns Saved runtime replay checkpoint.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Writes replay checkpoint to disk.
 */
export function createAndSaveReplayCheckpoint(
  createdAt: number
): RuntimeReplayCheckpoint {
  const log =
    loadRuntimeEventLog();

  const replayedState =
    replayPersistedRuntimeEvents();

  return saveRuntimeReplayCheckpoint(
    createRuntimeReplayCheckpoint(
      replayedState,
      log.events.length,
      createdAt
    )
  );
}

/**
 * Loads persisted checkpoint and verifies it against current replay state.
 *
 * @returns Replay checkpoint verification result.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Reads persisted replay checkpoint.
 */
export function loadAndVerifyReplayCheckpoint():
  ReplayCheckpointVerification {
  const checkpoint =
    loadRuntimeReplayCheckpoint();

  if (!checkpoint) {
    return {
      valid: false,
      error:
        "Runtime replay checkpoint not found",
    };
  }

  return verifyReplayCheckpoint(
    replayPersistedRuntimeEvents(),
    checkpoint
  );
}