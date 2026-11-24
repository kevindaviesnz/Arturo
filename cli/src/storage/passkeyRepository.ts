/**
 * Persistence for off-terminal passkey credentials. The public-key hash is
 * stored with the credential so it can be checked against the authority log
 * (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads one credential by id. */
export function loadPasskeyRow(credentialId: string): string | undefined {
  const row = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_passkeys WHERE credential_id = ?"
    )
    .get(credentialId) as { recordJson: string } | undefined;
  return row?.recordJson;
}

/** SIDE EFFECT: Lists credentials for one person at a business. */
export function loadPasskeyRowsForPerson(enterpriseId: string, person: string): string[] {
  const rows = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_passkeys WHERE enterprise_id = ? AND person = ? ORDER BY credential_id"
    )
    .all(enterpriseId, person) as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Lists every stored credential. */
export function loadPasskeyRows(): string[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM off_terminal_passkeys ORDER BY credential_id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => row.recordJson);
}

/** SIDE EFFECT: Inserts or replaces one credential. */
export function savePasskeyRow(
  credentialId: string,
  enterpriseId: string,
  person: string,
  recordJson: string
): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO off_terminal_passkeys (credential_id, enterprise_id, person, record_json) VALUES (?, ?, ?, ?)"
    )
    .run(credentialId, enterpriseId, person, recordJson);
}

/** SIDE EFFECT: Deletes one credential. */
export function deletePasskeyRow(credentialId: string): void {
  runtimeDb.prepare("DELETE FROM off_terminal_passkeys WHERE credential_id = ?").run(credentialId);
}

/** SIDE EFFECT: Deletes every stored credential. */
export function clearPersistedPasskeys(): void {
  runtimeDb.prepare("DELETE FROM off_terminal_passkeys").run();
}
