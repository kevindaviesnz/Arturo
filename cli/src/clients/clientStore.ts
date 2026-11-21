/**
 * Reads and writes a business's clients, what it calls them, and the area of
 * work Arturo set up for them.
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import {
  clearPersistedClients, insertClientDesk, insertClientRecord, loadClientDesks, loadClientRecords,
  loadClientTerms, saveClientTerms,
} from "../storage/clientRepository";
import { DEFAULT_CLIENT_TERMS, type ClientDesk, type ClientRecord, type ClientTerms } from "./clientRecords";

export function listClientRecords(enterpriseId: string): ClientRecord[] {
  return loadClientRecords().filter((record) => record.enterpriseId === enterpriseId);
}

export function getClientRecord(id: string): ClientRecord | undefined {
  return loadClientRecords().find((record) => record.id === id);
}

/** Stores a new client under the next free number. */
export function addClientRecord(record: Omit<ClientRecord, "id">): ClientRecord {
  const highest = Math.max(0, ...loadClientRecords().map((row) => Number(/^client-(\d+)$/.exec(row.id)?.[1] ?? 0)));
  const saved: ClientRecord = { ...record, id: `client-${highest + 1}` };
  insertClientRecord(saved);
  return saved;
}

export function getClientTerms(enterpriseId: string): ClientTerms {
  return loadClientTerms().find((terms) => terms.enterpriseId === enterpriseId) ?? { enterpriseId, ...DEFAULT_CLIENT_TERMS };
}

export function setClientTerms(terms: ClientTerms): void {
  saveClientTerms(terms);
}

export function getClientDesk(enterpriseId: string): ClientDesk | undefined {
  return loadClientDesks().find((desk) => desk.enterpriseId === enterpriseId);
}

export function recordClientDesk(desk: ClientDesk): void {
  insertClientDesk(desk);
}

export function clearClients(): void {
  clearPersistedClients();
}
