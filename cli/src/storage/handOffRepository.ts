import type { HandOff, HandOffDelivery } from "../runtime/handOff";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadHandOffs(): HandOff[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM hand_offs ORDER BY function_id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as HandOff);
}

/** SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database. */
export function saveHandOff(handOff: HandOff): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO hand_offs (function_id, record_json) VALUES (?, ?)")
    .run(handOff.functionId, JSON.stringify(handOff));
}

/** SIDE EFFECT: Deletes one hand-off; what it delivered is kept as history. */
export function deleteHandOff(functionId: string): void {
  runtimeDb.prepare("DELETE FROM hand_offs WHERE function_id = ?").run(functionId);
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadHandOffDeliveries(): HandOffDelivery[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM hand_off_deliveries")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as HandOffDelivery);
}

/**
 * Records a delivery once. Returns false when that result was already handed
 * over by that Function, so a second sign-off path cannot deliver it twice.
 *
 * SIDE EFFECT: May insert one row in the runtime SQLite database.
 */
export function saveHandOffDeliveryOnce(delivery: HandOffDelivery): boolean {
  const result = runtimeDb
    .prepare("INSERT OR IGNORE INTO hand_off_deliveries (function_id, job_id, record_json) VALUES (?, ?, ?)")
    .run(delivery.functionId, delivery.jobId, JSON.stringify(delivery));
  return result.changes === 1;
}

/** SIDE EFFECT: Replaces one delivery row, once its Human Task exists. */
export function saveHandOffDelivery(delivery: HandOffDelivery): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO hand_off_deliveries (function_id, job_id, record_json) VALUES (?, ?, ?)")
    .run(delivery.functionId, delivery.jobId, JSON.stringify(delivery));
}

/** SIDE EFFECT: Deletes every hand-off and its history. */
export function clearPersistedHandOffs(): void {
  runtimeDb.prepare("DELETE FROM hand_off_deliveries").run();
  runtimeDb.prepare("DELETE FROM hand_offs").run();
}
