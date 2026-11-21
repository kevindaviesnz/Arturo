import type { WorkerChatMessage } from "../chat/workerChatMessage";
import { runtimeDb } from "./runtimeDatabase";

function fromRow(row: Record<string, unknown>): WorkerChatMessage {
  return {
    id: String(row.id),
    workerName: String(row.workerName),
    role: row.role as WorkerChatMessage["role"],
    content: String(row.content),
    createdAt: Number(row.createdAt),
  };
}

export function saveWorkerChatMessage(message: WorkerChatMessage): void {
  runtimeDb.prepare(`
    INSERT INTO worker_chat_messages (id, worker_name, role, content, created_at)
    VALUES (@id, @workerName, @role, @content, @createdAt)
  `).run(message);
}

export function loadWorkerChatMessages(workerName: string): WorkerChatMessage[] {
  return (runtimeDb.prepare(`
    SELECT id, worker_name AS workerName, role, content, created_at AS createdAt
    FROM worker_chat_messages WHERE worker_name = @workerName
    ORDER BY created_at ASC, rowid ASC
  `).all({ workerName }) as Array<Record<string, unknown>>).map(fromRow);
}

export function clearWorkerChatMessages(workerName: string): void {
  runtimeDb.prepare("DELETE FROM worker_chat_messages WHERE worker_name = ?").run(workerName);
}

export function clearAllWorkerChatMessages(): void {
  runtimeDb.prepare("DELETE FROM worker_chat_messages").run();
}
