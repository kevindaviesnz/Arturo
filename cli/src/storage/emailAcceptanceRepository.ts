import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadEmailAcceptanceRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM email_acceptances ORDER BY id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveEmailAcceptanceRow(
  id: string,
  enterpriseId: string,
  jobId: string,
  recordJson: string
): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO email_acceptances (id, enterprise_id, job_id, record_json) VALUES (?, ?, ?, ?)"
    )
    .run(id, enterpriseId, jobId, recordJson);
}

/** SIDE EFFECT: Deletes every emailed-acceptance note. */
export function clearPersistedEmailAcceptances(): void {
  runtimeDb.prepare("DELETE FROM email_acceptances").run();
}
