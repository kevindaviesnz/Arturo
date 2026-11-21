import type { WorkRecord } from "../work/workRecord";
import { runtimeDb } from "./runtimeDatabase";

type Row = { recordJson: string };

/** Each stored record, as text, so one that no longer parses can be reported rather than thrown. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWorkRecordRows(): Array<{ id: string; recordJson: string }> {
  return runtimeDb.prepare("SELECT id, record_json AS recordJson FROM work_records ORDER BY created_at, id").all() as Array<{ id: string; recordJson: string }>;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWorkRecordRow(id: string): string | undefined {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM work_records WHERE id = ?").get(id) as Row | undefined)?.recordJson;
}

/**
 * SIDE EFFECT: Inserts one row; refuses to overwrite an existing record, and
 * throws on a matter number already held by open work at the business.
 */
export function insertWorkRecord(record: WorkRecord): void {
  runtimeDb.prepare("INSERT INTO work_records (id, enterprise_id, parent_work_id, created_at, matter_number, cancelled_at, record_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(record.id, record.enterpriseId, record.parentWorkId ?? null, record.createdAt, record.matterNumber ?? null, record.cancelledAt ?? null, JSON.stringify(record));
}

/** SIDE EFFECT: Replaces one existing row. The id, business and parent never change. */
export function replaceWorkRecord(record: WorkRecord): void {
  // cancelled_at is only ever set: cancelled work is never reopened.
  const changed = runtimeDb.prepare("UPDATE work_records SET record_json = ?, cancelled_at = coalesce(cancelled_at, ?) WHERE id = ? AND enterprise_id = ?")
    .run(JSON.stringify(record), record.cancelledAt ?? null, record.id, record.enterpriseId).changes;
  if (changed !== 1) throw new Error(`No work called ${record.id} to change.`);
}

/** SIDE EFFECT: Deletes every work record. */
export function clearPersistedWork(): void {
  runtimeDb.prepare("DELETE FROM work_records").run();
}
