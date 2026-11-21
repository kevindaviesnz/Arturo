import type { WorkChange } from "../work/workStore";
import { runtimeDb } from "./runtimeDatabase";

/** Every entry, oldest first. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWorkChanges(): WorkChange[] {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM work_changes ORDER BY seq").all() as Array<{ recordJson: string }>)
    .map((row) => JSON.parse(row.recordJson) as WorkChange);
}

/** SIDE EFFECT: Appends one entry. Entries are never changed or removed, except by /reset. */
export function appendWorkChange(change: WorkChange): void {
  runtimeDb.prepare("INSERT INTO work_changes (enterprise_id, work_id, at, record_json) VALUES (?, ?, ?, ?)")
    .run(change.enterpriseId, change.workId ?? null, change.at, JSON.stringify(change));
}

/** SIDE EFFECT: Deletes the whole log (tests and /reset). */
export function clearPersistedWorkChanges(): void {
  runtimeDb.prepare("DELETE FROM work_changes").run();
}
