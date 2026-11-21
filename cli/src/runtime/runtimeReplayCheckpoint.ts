import crypto from "node:crypto";

import {
  stableSerializeReplayState,
} from "./runtimeReplayVerification";

export type RuntimeReplayCheckpoint = {
  eventCount: number;
  stateHash: string;
  createdAt: number;
};

export type ReplayCheckpointVerification =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Creates deterministic hash for replay state.
 *
 * @param replayState Replayed runtime state.
 * @returns SHA256 hash of replay state.
 *
 * PURE: No side effects.
 */
export function hashReplayState(
  replayState: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(
      stableSerializeReplayState(
        replayState
      )
    )
    .digest("hex");
}

/**
 * Creates runtime replay checkpoint.
 *
 * @param replayState Replayed runtime state.
 * @param eventCount Number of replayed events.
 * @param createdAt Checkpoint creation timestamp.
 * @returns Runtime replay checkpoint.
 *
 * PURE: No side effects.
 */
export function createRuntimeReplayCheckpoint(
  replayState: unknown,
  eventCount: number,
  createdAt: number
): RuntimeReplayCheckpoint {
  return {
    eventCount,
    stateHash:
      hashReplayState(
        replayState
      ),
    createdAt,
  };
}

/**
 * Verifies replay state against checkpoint.
 *
 * @param replayState Replayed runtime state.
 * @param checkpoint Runtime replay checkpoint.
 * @returns Verification result.
 *
 * PURE: No side effects.
 */
export function verifyReplayCheckpoint(
  replayState: unknown,
  checkpoint: RuntimeReplayCheckpoint
): ReplayCheckpointVerification {
  const actualHash =
    hashReplayState(
      replayState
    );

  if (
    actualHash !==
    checkpoint.stateHash
  ) {
    return {
      valid: false,
      error:
        "Replay checkpoint verification failed",
    };
  }

  return {
    valid: true,
  };
}