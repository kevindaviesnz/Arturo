import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadHandBackRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM hand_backs ORDER BY id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveHandBackRow(
  id: string,
  enterpriseId: string,
  jobId: string,
  recordJson: string
): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO hand_backs (id, enterprise_id, job_id, record_json) VALUES (?, ?, ?, ?)"
    )
    .run(id, enterpriseId, jobId, recordJson);
}

/** SIDE EFFECT: Deletes every hand-back record. */
export function clearPersistedHandBacks(): void {
  runtimeDb.prepare("DELETE FROM hand_backs").run();
}
