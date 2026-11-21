import {
  chatWithWorker,
  clearWorkerChatHistory,
  endWorkerChat,
  getActiveWorkerChat,
  getWorkerChatHistory,
  startWorkerChat,
} from "../chat/workerChat";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import type { WorkStreamEntry } from "./uiState";

const usage = 'Use /chat "<worker-name>" "<message>", /chat with "<worker-name>", /chat history "<worker-name>", /chat clear "<worker-name>", /chat status, or /chat end';

function activeChatSuffix(workerName: string): string {
  return `\n\nConversation active with ${workerName}. Enter plain text to reply, or use /chat end.`;
}

/** Routes plain text to the active read-only Worker Chat session, when present. */
export async function handleUiWorkerChatContinuation(
  message: string
): Promise<WorkStreamEntry | undefined> {
  const workerName = getActiveWorkerChat();
  if (!workerName) return undefined;
  try {
    const response = await chatWithWorker(workerName, message);
    broadcastEvent("worker.chat.responded", "success", `Worker chat response recorded: ${workerName}`);
    return {
      actor: workerName,
      label: response.startsWith("Mode: READ-ONLY WORKER CHAT") ? "Read-only worker chat" : "Worker response",
      body: `${response}${activeChatSuffix(workerName)}`,
    };
  } catch (error) {
    return {
      actor: "Arturo",
      label: "Worker chat failed",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function handleUiWorkerChatCommand(
  args: readonly string[]
): Promise<WorkStreamEntry> {
  const [first, second, ...rest] = args;
  try {
    if (first === "status") {
      const active = getActiveWorkerChat();
      return {
        actor: "Arturo",
        label: "Worker chat status",
        body: active
          ? `Conversation active with ${active}. Enter plain text to reply, or use /chat end.`
          : "No active Worker Chat conversation.",
      };
    }

    if (first === "end") {
      const ended = endWorkerChat();
      return {
        actor: "Arturo",
        label: "Worker chat ended",
        body: ended
          ? `Ended the active conversation with ${ended}. Chat history was preserved.`
          : "No active Worker Chat conversation.",
      };
    }

    if (first === "with") {
      if (!second) return { actor: "Arturo", label: "Usage", body: usage };
      const workerName = startWorkerChat(second);
      return {
        actor: "Arturo",
        label: "Worker chat started",
        body: `Conversation active with ${workerName}. Enter plain text to reply, or use /chat end.`,
      };
    }

    if (first === "history") {
      if (!second) return { actor: "Arturo", label: "Usage", body: usage };
      const messages = getWorkerChatHistory(second);
      return {
        actor: "Arturo",
        label: `Chat history · ${second}`,
        body: messages.length
          ? messages.map((message, index) => `${index + 1}. ${message.role === "user" ? "You" : second}: ${message.content}`).join("\n\n")
          : "No chat history.",
      };
    }

    if (first === "clear") {
      if (!second) return { actor: "Arturo", label: "Usage", body: usage };
      clearWorkerChatHistory(second);
      broadcastEvent("worker.chat.cleared", "success", `Worker chat cleared: ${second}`);
      return { actor: "Arturo", label: "Worker chat cleared", body: `Cleared chat history for ${second}.` };
    }

    // `/chat "<worker-name>"` with no message: open the conversation, which is
    // what `/chat with "<worker-name>"` already does. Printing usage instead
    // made the obvious spelling of the command look wrong — an operator who
    // knows the Worker's name has said everything the command needs.
    if (first && !second) {
      const workerName = startWorkerChat(first);
      return {
        actor: "Arturo",
        label: "Worker chat started",
        body: `Conversation active with ${workerName}. Enter plain text to reply, or use /chat end.`,
      };
    }

    if (!first || !second) return { actor: "Arturo", label: "Usage", body: usage };
    const message = [second, ...rest].join(" ");
    const response = await chatWithWorker(first, message);
    broadcastEvent("worker.chat.responded", "success", `Worker chat response recorded: ${first}`);
    return { actor: first, label: response.startsWith("Mode: READ-ONLY WORKER CHAT") ? "Read-only worker chat" : "Worker response", body: `${response}${activeChatSuffix(first)}` };
  } catch (error) {
    return {
      actor: "Arturo",
      label: "Worker chat failed",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}
