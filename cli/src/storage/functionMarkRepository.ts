import { runtimeDb } from "./runtimeDatabase";

/** The stored text of one Function's mark. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadFunctionMarkRow(functionId: string): string | undefined {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM function_marks WHERE function_id = ?").get(functionId) as { recordJson: string } | undefined)?.recordJson;
}

/** SIDE EFFECT: Inserts or replaces one Function's mark. */
export function saveFunctionMarkRow(functionId: string, recordJson: string): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO function_marks (function_id, record_json) VALUES (?, ?)").run(functionId, recordJson);
}

/** SIDE EFFECT: Deletes one Function's mark. */
export function deleteFunctionMarkRow(functionId: string): void {
  runtimeDb.prepare("DELETE FROM function_marks WHERE function_id = ?").run(functionId);
}

/** SIDE EFFECT: Deletes every Function mark (tests and /reset). */
export function clearPersistedFunctionMarks(): void {
  runtimeDb.prepare("DELETE FROM function_marks").run();
}
