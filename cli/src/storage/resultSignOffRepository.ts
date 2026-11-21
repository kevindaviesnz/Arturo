import type { ResultSignOff } from "../runtime/resultSignOff";
import { runtimeDb } from "./runtimeDatabase";

/**
 * SIDE EFFECT: Reads the runtime SQLite database.
 */
export function loadResultSignOff(jobId: string): ResultSignOff | undefined {
  const row = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM result_sign_offs WHERE job_id = ?")
    .get(jobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as ResultSignOff) : undefined;
}

/**
 * SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database.
 */
export function saveResultSignOff(signOff: ResultSignOff): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO result_sign_offs (job_id, record_json) VALUES (?, ?)")
    .run(signOff.jobId, JSON.stringify(signOff));
}

/**
 * SIDE EFFECT: Deletes every stored sign-off.
 */
export function clearPersistedResultSignOffs(): void {
  runtimeDb.prepare("DELETE FROM result_sign_offs").run();
}
