/**
 * Persistence for off-terminal sign-off and enrolment links. Only a hash
 * of the token is stored (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads one row by token hash. */
export function loadOffTerminalLinkRow(tokenSha256: string): string | undefined {
  const row = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_links WHERE token_sha256 = ?"
    )
    .get(tokenSha256) as { recordJson: string } | undefined;
  return row?.recordJson;
}

/** SIDE EFFECT: Lists every stored link record. */
export function loadOffTerminalLinkRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM off_terminal_links ORDER BY token_sha256")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Lists links for one Task. */
export function loadOffTerminalLinkRowsForJob(jobId: string): string[] {
  const rows = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_links WHERE job_id = ? ORDER BY token_sha256"
    )
    .all(jobId) as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Lists links for one person at a business. */
export function loadOffTerminalLinkRowsForPerson(enterpriseId: string, person: string): string[] {
  const rows = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_links WHERE enterprise_id = ? AND person = ? ORDER BY token_sha256"
    )
    .all(enterpriseId, person) as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one row. The raw token is never a column. */
export function saveOffTerminalLinkRow(
  tokenSha256: string,
  enterpriseId: string,
  jobId: string | undefined,
  person: string,
  recordJson: string
): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO off_terminal_links (token_sha256, enterprise_id, job_id, person, record_json) VALUES (?, ?, ?, ?, ?)"
    )
    .run(tokenSha256, enterpriseId, jobId ?? null, person, recordJson);
}

/** SIDE EFFECT: Lists links for one business. */
export function loadOffTerminalLinkRowsForEnterprise(enterpriseId: string): string[] {
  const rows = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_links WHERE enterprise_id = ? ORDER BY token_sha256"
    )
    .all(enterpriseId) as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Deletes every off-terminal link. */
export function clearPersistedOffTerminalLinks(): void {
  runtimeDb.prepare("DELETE FROM off_terminal_links").run();
}
