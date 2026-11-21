import type { FunctionChecks } from "../business/functionChecks";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadFunctionChecks(): FunctionChecks[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM function_checks ORDER BY function_id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as FunctionChecks);
}

/** SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database. */
export function saveFunctionChecks(checks: FunctionChecks): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO function_checks (function_id, record_json) VALUES (?, ?)")
    .run(checks.functionId, JSON.stringify(checks));
}

/** SIDE EFFECT: Deletes one Function's checks. */
export function deleteFunctionChecks(functionId: string): void {
  runtimeDb.prepare("DELETE FROM function_checks WHERE function_id = ?").run(functionId);
}

/** SIDE EFFECT: Deletes every Function's checks. */
export function clearPersistedFunctionChecks(): void {
  runtimeDb.prepare("DELETE FROM function_checks").run();
}
