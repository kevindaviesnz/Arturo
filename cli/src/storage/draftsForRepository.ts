import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadDraftsForRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM drafts_for ORDER BY ai_worker")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveDraftsForRow(id: string, enterpriseId: string, aiWorker: string, recordJson: string): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO drafts_for (id, enterprise_id, ai_worker, record_json) VALUES (?, ?, ?, ?)")
    .run(id, enterpriseId, aiWorker, recordJson);
}

/** SIDE EFFECT: Deletes one row. */
export function deleteDraftsForRow(id: string): void {
  runtimeDb.prepare("DELETE FROM drafts_for WHERE id = ?").run(id);
}

/** SIDE EFFECT: Deletes every drafts-for record. */
export function clearPersistedDraftsFor(): void {
  runtimeDb.prepare("DELETE FROM drafts_for").run();
}
