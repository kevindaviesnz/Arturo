import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  replayValidatedRuntimeEvents,
  type ReplayedRuntimeState,
} from "./runtimeReplay";

/**
 * Replays persisted runtime events into reconstructed runtime state.
 *
 * Runtime event sequence integrity is validated before replay
 * to ensure deterministic reconstruction and corruption detection.
 *
 * @returns Reconstructed runtime state.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log from disk.
 * - Throws if persisted event sequence integrity is invalid.
 */
export function replayPersistedRuntimeEvents():
  ReplayedRuntimeState {
  const log =
    loadRuntimeEventLog();

  return replayValidatedRuntimeEvents(
    log.events
  );
}