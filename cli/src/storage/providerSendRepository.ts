import type { ProviderSend } from "../runtime/providerSendLog";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Appends one send. Sends are never changed or removed, except by /reset. */
export function insertProviderSend(send: ProviderSend): void {
  runtimeDb.prepare("INSERT INTO provider_sends (id, job_id, purpose, at, record_json) VALUES (?, ?, ?, ?, ?)")
    .run(send.id, send.jobId, send.purpose, send.at, JSON.stringify(send));
}

/** Sends for one Task, oldest first. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadProviderSends(jobId: string): ProviderSend[] {
  const rows = runtimeDb.prepare("SELECT record_json AS recordJson FROM provider_sends WHERE job_id = ? ORDER BY at, rowid").all(jobId) as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as ProviderSend);
}

/** SIDE EFFECT: Deletes the whole provider send log (tests and /reset). */
export function clearPersistedProviderSends(): void {
  runtimeDb.prepare("DELETE FROM provider_sends").run();
}
