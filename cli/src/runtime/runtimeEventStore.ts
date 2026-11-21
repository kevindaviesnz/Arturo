import {
  appendRuntimeEvent,
  listRuntimeEvents,
  type RuntimeEventInput,
  type RuntimeEventLog,
  type RuntimeEventRecord,
} from "./runtimeEventLog";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

let runtimeEventLog:
  RuntimeEventLog =
  loadRuntimeEventLog();

/**
 * Appends a runtime event to the shared runtime event store.
 *
 * @param input Runtime event input.
 * @returns Appended runtime event record.
 *
 * SIDE EFFECT:
 * - Mutates module-level runtime event log state.
 * - Persists runtime event log to disk.
 */
export function appendRuntimeEventToStore(
  input: RuntimeEventInput
): RuntimeEventRecord {
  const updated =
    appendRuntimeEvent(
      runtimeEventLog,
      input
    );

  runtimeEventLog =
    saveRuntimeEventLog(
      updated
    );

  return updated.events[
    updated.events.length - 1
  ];
}

/**
 * Lists runtime events from the shared runtime event store.
 *
 * @returns Runtime event records.
 *
 * SIDE EFFECT: Reads module-level runtime event log state.
 */
export function listRuntimeEventStore():
  RuntimeEventRecord[] {
  return listRuntimeEvents(
    runtimeEventLog
  );
}

/**
 * Gets current runtime event log state.
 *
 * @returns Runtime event log.
 *
 * SIDE EFFECT: Reads module-level runtime event log state.
 */
export function getRuntimeEventStore():
  RuntimeEventLog {
  return {
    nextSequence:
      runtimeEventLog.nextSequence,
    events: [
      ...runtimeEventLog.events,
    ],
  };
}

/**
 * Clears shared runtime event store and persisted event log.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates module-level runtime event log state.
 * - Deletes persisted runtime event log.
 */
export function clearRuntimeEventStore():
  void {
  clearRuntimeEventLog();

  runtimeEventLog = {
    nextSequence: 1,
    events: [],
  };
}