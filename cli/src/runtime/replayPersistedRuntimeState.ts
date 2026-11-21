import {
  loadKernelSnapshot,
} from "../kernel/kernelPersistence";

import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  replayRuntimeEvents,
} from "./runtimeReplay";

import {
  verifyReplayState,
  type ReplayVerificationResult,
} from "./runtimeReplayVerification";

export type VerifiedReplayResult = {
  replayedState: unknown;
  verification:
    ReplayVerificationResult;
};

/**
 * Replays persisted runtime state and verifies replay integrity.
 *
 * @returns Verified replay result.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Reads persisted kernel snapshot.
 */
export function replayPersistedRuntimeState():
  VerifiedReplayResult {
  const snapshot =
    loadKernelSnapshot();

  const runtimeLog =
    loadRuntimeEventLog();

  const replayedState =
    replayRuntimeEvents(
      runtimeLog.events
    );

  if (!snapshot) {
    return {
      replayedState,
      verification: {
        valid: false,
        error:
          "Kernel snapshot not found",
      },
    };
  }

  const verification =
    verifyReplayState(
      snapshot,
      replayedState
    );

  return {
    replayedState,
    verification,
  };
}