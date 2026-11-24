/**
 * Persistence for whether off-terminal sign-off is on at a business.
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads one business's path setting. */
export function loadOffTerminalPathRow(enterpriseId: string): string | undefined {
  const row = runtimeDb
    .prepare(
      "SELECT record_json AS recordJson FROM off_terminal_path WHERE enterprise_id = ?"
    )
    .get(enterpriseId) as { recordJson: string } | undefined;
  return row?.recordJson;
}

/** SIDE EFFECT: Inserts or replaces one path setting. */
export function saveOffTerminalPathRow(enterpriseId: string, recordJson: string): void {
  runtimeDb
    .prepare(
      "INSERT OR REPLACE INTO off_terminal_path (enterprise_id, record_json) VALUES (?, ?)"
    )
    .run(enterpriseId, recordJson);
}

/** SIDE EFFECT: Deletes every off-terminal path setting. */
export function clearPersistedOffTerminalPath(): void {
  runtimeDb.prepare("DELETE FROM off_terminal_path").run();
}
