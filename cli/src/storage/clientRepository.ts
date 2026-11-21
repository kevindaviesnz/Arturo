import type { ClientDesk, ClientRecord, ClientTerms } from "../clients/clientRecords";
import type { AssistantConversation } from "../clients/clientIntake";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadClientRecords(): ClientRecord[] {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM client_records ORDER BY created_at, id").all() as Array<{ recordJson: string }>)
    .map((row) => JSON.parse(row.recordJson) as ClientRecord);
}

/** SIDE EFFECT: Inserts one row; refuses to overwrite an existing client. */
export function insertClientRecord(record: ClientRecord): void {
  runtimeDb.prepare("INSERT INTO client_records (id, enterprise_id, created_at, record_json) VALUES (?, ?, ?, ?)")
    .run(record.id, record.enterpriseId, record.createdAt, JSON.stringify(record));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadClientTerms(): ClientTerms[] {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM client_terms").all() as Array<{ recordJson: string }>)
    .map((row) => JSON.parse(row.recordJson) as ClientTerms);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveClientTerms(terms: ClientTerms): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO client_terms (enterprise_id, record_json) VALUES (?, ?)").run(terms.enterpriseId, JSON.stringify(terms));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadClientDesks(): ClientDesk[] {
  return (runtimeDb.prepare("SELECT record_json AS recordJson FROM client_desks").all() as Array<{ recordJson: string }>)
    .map((row) => JSON.parse(row.recordJson) as ClientDesk);
}

/** SIDE EFFECT: Inserts one row; a business has one client desk. */
export function insertClientDesk(desk: ClientDesk): void {
  runtimeDb.prepare("INSERT INTO client_desks (enterprise_id, record_json) VALUES (?, ?)").run(desk.enterpriseId, JSON.stringify(desk));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadAssistantConversations(enterpriseId: string, person?: string): AssistantConversation[] {
  const rows = person === undefined
    ? runtimeDb.prepare("SELECT record_json AS recordJson FROM assistant_conversations WHERE enterprise_id = ? ORDER BY updated_at").all(enterpriseId)
    : runtimeDb.prepare("SELECT record_json AS recordJson FROM assistant_conversations WHERE enterprise_id = ? AND person = ? ORDER BY updated_at").all(enterpriseId, person);
  return (rows as Array<{ recordJson: string }>).map((row) => JSON.parse(row.recordJson) as AssistantConversation);
}

/** SIDE EFFECT: Inserts or replaces one conversation. */
export function saveAssistantConversation(conversation: AssistantConversation): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO assistant_conversations (id, enterprise_id, person, status, updated_at, record_json) VALUES (?, ?, ?, ?, ?, ?)")
    .run(conversation.id, conversation.enterpriseId, conversation.person, conversation.status, conversation.updatedAt, JSON.stringify(conversation));
}

/** SIDE EFFECT: Deletes every client, term and desk record. */
export function clearPersistedClients(): void {
  runtimeDb.exec("DELETE FROM client_records; DELETE FROM client_terms; DELETE FROM client_desks; DELETE FROM assistant_conversations;");
}
