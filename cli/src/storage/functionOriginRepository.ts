import type { FunctionOrigin } from "../business/functionOrigin";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadFunctionOrigins(): FunctionOrigin[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM function_origins ORDER BY function_id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as FunctionOrigin);
}

/** SIDE EFFECT: Reads one row of the runtime SQLite database. */
export function loadFunctionOrigin(functionId: string): FunctionOrigin | undefined {
  const row = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM function_origins WHERE function_id = ?")
    .get(functionId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as FunctionOrigin) : undefined;
}

/**
 * A Function's id can be used again once that Function is gone, so a new
 * Function's origin replaces any left from an old one of the same id.
 *
 * SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database.
 */
export function saveFunctionOrigin(origin: FunctionOrigin): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO function_origins (function_id, record_json) VALUES (?, ?)")
    .run(origin.functionId, JSON.stringify(origin));
}

/** SIDE EFFECT: Deletes one Function's origin. */
export function deleteFunctionOrigin(functionId: string): void {
  runtimeDb.prepare("DELETE FROM function_origins WHERE function_id = ?").run(functionId);
}

/** SIDE EFFECT: Deletes every Function's origin. */
export function clearPersistedFunctionOrigins(): void {
  runtimeDb.prepare("DELETE FROM function_origins").run();
}
