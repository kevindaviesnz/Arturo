import { runtimeDb } from "./runtimeDatabase";

/** The stored text of one business's web search switch. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWebSearchSwitchRow(enterpriseId: string): string | undefined {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM web_search_switches WHERE enterprise_id = ?").get(enterpriseId) as { recordJson: string } | undefined)?.recordJson;
}

/** SIDE EFFECT: Inserts or replaces one business's switch. */
export function saveWebSearchSwitchRow(enterpriseId: string, recordJson: string): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO web_search_switches (enterprise_id, record_json) VALUES (?, ?)").run(enterpriseId, recordJson);
}

/** SIDE EFFECT: Deletes every switch (tests and /reset). */
export function clearPersistedWebSearchSwitches(): void {
  runtimeDb.prepare("DELETE FROM web_search_switches").run();
}
