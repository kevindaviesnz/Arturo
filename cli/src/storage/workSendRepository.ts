import type { WorkSend } from "../work/workSendLog";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Appends one send. Sends are never changed or removed, except by /reset. */
export function insertWorkSend(send: WorkSend): void {
  runtimeDb.prepare("INSERT INTO work_sends (id, job_id, work_id, at, record_json) VALUES (?, ?, ?, ?, ?)")
    .run(send.id, send.jobId, send.workId, send.at, JSON.stringify(send));
}

/** Sends for one piece of work, or all, oldest first. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWorkSends(workIds?: readonly string[]): WorkSend[] {
  const rows = runtimeDb.prepare("SELECT record_json AS recordJson FROM work_sends ORDER BY at, rowid").all() as Array<{ recordJson: string }>;
  const sends = rows.map((row) => JSON.parse(row.recordJson) as WorkSend);
  return workIds ? sends.filter((send) => workIds.includes(send.workId)) : sends;
}

/** SIDE EFFECT: Deletes the whole send log (tests and /reset). */
export function clearPersistedWorkSends(): void {
  runtimeDb.prepare("DELETE FROM work_sends").run();
}
