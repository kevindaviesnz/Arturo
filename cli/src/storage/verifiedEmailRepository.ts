/**
 * Persistence for verified staff email addresses (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads one person's email record at a business. */
export function loadVerifiedEmailRow(enterpriseId: string, person: string): string | undefined {
  const row = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM verified_emails WHERE enterprise_id = ? AND person = ?"
    )
    .get(enterpriseId, person) as { recordJson: string } | undefined;
  return row?.recordJson;
}

/** SIDE EFFECT: Lists every email record. */
export function loadVerifiedEmailRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM verified_emails ORDER BY enterprise_id, person")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one email record. */
export function saveVerifiedEmailRow(enterpriseId: string, person: string, recordJson: string): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO verified_emails (enterprise_id, person, record_json) VALUES (?, ?, ?)"
    )
    .run(enterpriseId, person, recordJson);
}

/** SIDE EFFECT: Deletes every verified-email record. */
export function clearPersistedVerifiedEmails(): void {
  runtimeDb.prepare("DELETE FROM verified_emails").run();
}
