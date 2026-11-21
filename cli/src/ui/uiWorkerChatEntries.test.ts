import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatWithWorker,
  clearWorkerChatHistory,
  endWorkerChat,
  getActiveWorkerChat,
  getWorkerChatHistory,
  startWorkerChat,
} from "../chat/workerChat";
import {
  handleUiWorkerChatCommand,
  handleUiWorkerChatContinuation,
} from "./uiWorkerChatEntries";

vi.mock("../chat/workerChat", () => ({
  chatWithWorker: vi.fn(),
  clearWorkerChatHistory: vi.fn(),
  endWorkerChat: vi.fn(),
  getActiveWorkerChat: vi.fn(),
  getWorkerChatHistory: vi.fn(),
  startWorkerChat: vi.fn(),
}));

describe("uiWorkerChatEntries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns read-only worker chat output", async () => {
    vi.mocked(chatWithWorker).mockResolvedValue("Mode: READ-ONLY WORKER CHAT\n\nHello");
    await expect(handleUiWorkerChatCommand(["Safety Worker", "Hello"])).resolves.toEqual({
      actor: "Safety Worker",
      label: "Read-only worker chat",
      body: "Mode: READ-ONLY WORKER CHAT\n\nHello\n\nConversation active with Safety Worker. Enter plain text to reply, or use /chat end.",
    });
  });

  it("routes plain text to the active Worker", async () => {
    vi.mocked(getActiveWorkerChat).mockReturnValue("Safety Worker");
    vi.mocked(chatWithWorker).mockResolvedValue("Mode: READ-ONLY WORKER CHAT\n\nCertainly.");
    await expect(handleUiWorkerChatContinuation("yes")).resolves.toMatchObject({
      actor: "Safety Worker",
      label: "Read-only worker chat",
    });
    expect(chatWithWorker).toHaveBeenCalledWith("Safety Worker", "yes");
  });

  it("does not consume plain text when no Worker conversation is active", async () => {
    vi.mocked(getActiveWorkerChat).mockReturnValue(undefined);
    await expect(handleUiWorkerChatContinuation("Plan a launch")).resolves.toBeUndefined();
  });

  it("starts, reports, and ends the active conversation", async () => {
    vi.mocked(startWorkerChat).mockReturnValue("Safety Worker");
    expect((await handleUiWorkerChatCommand(["with", "Safety Worker"])).body).toContain("Conversation active");

    vi.mocked(getActiveWorkerChat).mockReturnValue("Safety Worker");
    expect((await handleUiWorkerChatCommand(["status"])).body).toContain("Safety Worker");

    vi.mocked(endWorkerChat).mockReturnValue("Safety Worker");
    expect((await handleUiWorkerChatCommand(["end"])).body).toContain("history was preserved");
  });

  it("shows and clears worker-specific history", async () => {
    vi.mocked(getWorkerChatHistory).mockReturnValue([{
      id: "message-1",
      workerName: "Safety Worker",
      role: "user",
      content: "Hello",
      createdAt: 1,
    }]);
    expect((await handleUiWorkerChatCommand(["history", "Safety Worker"])).body).toContain("You: Hello");
    await handleUiWorkerChatCommand(["clear", "Safety Worker"]);
    expect(clearWorkerChatHistory).toHaveBeenCalledWith("Safety Worker");
  });

  it("requires a worker and message", async () => {
    expect((await handleUiWorkerChatCommand([])).label).toBe("Usage");
  });

  // Naming a Worker and nothing else printed the usage block, so the obvious
  // spelling of the command looked wrong while /chat with "<name>" did exactly
  // what was wanted.
  it("opens the conversation when only a Worker is named", async () => {
    vi.mocked(startWorkerChat).mockReturnValue("Safety Worker");
    const entry = await handleUiWorkerChatCommand(["Safety Worker"]);
    expect(entry.label).toBe("Worker chat started");
    expect(entry.body).toContain("Conversation active with Safety Worker");
    expect(startWorkerChat).toHaveBeenCalledWith("Safety Worker");
  });

  it("still reports an unknown Worker rather than opening a chat", async () => {
    vi.mocked(startWorkerChat).mockImplementation(() => {
      throw new Error("worker not found: Nobody");
    });
    const entry = await handleUiWorkerChatCommand(["Nobody"]);
    expect(entry.label).toBe("Worker chat failed");
    expect(entry.body).toContain("worker not found: Nobody");
  });
});
