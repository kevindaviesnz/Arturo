/**
 * Persistence for the real-person test gate (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { runtimeDb } from "./runtimeDatabase";

const ROW_ID = "gate";

/** SIDE EFFECT: Reads the single gate record, if any. */
export function loadRealPersonTestRow(): string | undefined {
  const row = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM real_person_test WHERE id = ?")
    .get(ROW_ID) as { recordJson: string } | undefined;
  return row?.recordJson;
}

/** SIDE EFFECT: Writes the single gate record. */
export function saveRealPersonTestRow(recordJson: string): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO real_person_test (id, record_json) VALUES (?, ?)")
    .run(ROW_ID, recordJson);
}

/** SIDE EFFECT: Deletes the gate record. */
export function clearPersistedRealPersonTest(): void {
  runtimeDb.prepare("DELETE FROM real_person_test").run();
}
