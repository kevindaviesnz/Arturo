import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  reconstructHistoricalRuntimeState,
  type HistoricalRuntimeState,
} from "./runtimeHistoricalReconstruction";

/**
 * Replays persisted runtime events into historical runtime state.
 *
 * @returns Historical runtime state reconstructed from persisted events.
 *
 * SIDE EFFECT: Reads persisted runtime event log from disk.
 */
export function replayHistoricalRuntimeState():
  HistoricalRuntimeState {
  const log =
    loadRuntimeEventLog();

  return reconstructHistoricalRuntimeState(
    log.events
  );
}