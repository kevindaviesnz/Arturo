import type { ResultSetAside } from "../runtime/resultSetAside";
import { runtimeDb } from "./runtimeDatabase";

/**
 * SIDE EFFECT: Reads the runtime SQLite database.
 */
export function loadResultSetAside(jobId: string): ResultSetAside | undefined {
  const row = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM result_set_asides WHERE job_id = ?")
    .get(jobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as ResultSetAside) : undefined;
}

/**
 * SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database.
 */
export function saveResultSetAside(setAside: ResultSetAside): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO result_set_asides (job_id, record_json) VALUES (?, ?)")
    .run(setAside.jobId, JSON.stringify(setAside));
}

/**
 * SIDE EFFECT: Deletes every stored set-aside.
 */
export function clearPersistedResultSetAsides(): void {
  runtimeDb.prepare("DELETE FROM result_set_asides").run();
}
