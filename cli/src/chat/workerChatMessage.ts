export type WorkerChatRole = "user" | "assistant";

export type WorkerChatMessage = {
  readonly id: string;
  readonly workerName: string;
  readonly role: WorkerChatRole;
  readonly content: string;
  readonly createdAt: number;
};
