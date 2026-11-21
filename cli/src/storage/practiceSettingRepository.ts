import type { PracticeSetting } from "../work/practiceSetting";
import { runtimeDb } from "./runtimeDatabase";

/** The stored text of one business's setting. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPracticeSettingRow(enterpriseId: string): string | undefined {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM practice_settings WHERE enterprise_id = ?").get(enterpriseId) as { recordJson: string } | undefined)?.recordJson;
}

/** SIDE EFFECT: Inserts or replaces one business's setting. */
export function savePracticeSetting(setting: PracticeSetting): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO practice_settings (enterprise_id, record_json) VALUES (?, ?)").run(setting.enterpriseId, JSON.stringify(setting));
}

/** SIDE EFFECT: Deletes every practice setting. */
export function clearPersistedPracticeSettings(): void {
  runtimeDb.prepare("DELETE FROM practice_settings").run();
}
