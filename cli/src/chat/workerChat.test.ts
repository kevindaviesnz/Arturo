import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithConfiguredLlm } from "../llm/llmClient";
import { addWorker, clearWorkers } from "../control/workers";
import { clearAllWorkerChatMessages, loadWorkerChatMessages } from "../storage/workerChatRepository";
import {
  buildWorkerChatPrompt,
  chatWithWorker,
  endWorkerChat,
  getActiveWorkerChat,
  startWorkerChat,
  WORKER_CHAT_PREFIX,
} from "./workerChat";

vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: vi.fn(),
}));

describe("workerChat", () => {
  beforeEach(() => {
    endWorkerChat();
    clearWorkers();
    clearAllWorkerChatMessages();
    addWorker({
      name: "Safety Worker",
      kind: "ai",
      archetype: "guardian",
      model: "llama3.2:latest",
      trust: false,
      capabilities: ["safety"],
      run: function* (ctx: unknown) { return ctx; },
    });
  });
  afterEach(() => {
    endWorkerChat();
    clearWorkers();
    clearAllWorkerChatMessages();
    vi.resetAllMocks();
  });

  it("builds an explicitly read-only grounded prompt", () => {
    const prompt = buildWorkerChatPrompt("Safety Worker", "What do you know?", []);
    expect(prompt).toContain("READ-ONLY WORKER CHAT");
    expect(prompt).toContain("cannot execute actions");
    expect(prompt).toContain("Worker: Safety Worker");
    expect(prompt).toContain("USER: What do you know?");
  });

  it("persists both sides and labels the response", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({ response: "The records show no assigned Jobs." });
    const response = await chatWithWorker("Safety Worker", "Summarise your work");
    expect(response).toBe(`${WORKER_CHAT_PREFIX}The records show no assigned Jobs.`);
    expect(loadWorkerChatMessages("Safety Worker").map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(getActiveWorkerChat()).toBe("Safety Worker");
  });

  it("starts and ends a process-local conversation without deleting history", async () => {
    expect(startWorkerChat("Safety Worker")).toBe("Safety Worker");
    expect(getActiveWorkerChat()).toBe("Safety Worker");
    expect(endWorkerChat()).toBe("Safety Worker");
    expect(getActiveWorkerChat()).toBeUndefined();
  });

  it("does not allow a human Worker to become the active chat target", () => {
    addWorker({
      name: "Kevin",
      kind: "human",
      archetype: "guardian",
      trust: true,
      capabilities: ["safety"],
      run: function* (ctx: unknown) { return ctx; },
    });
    expect(() => startWorkerChat("Kevin")).toThrow("worker is not an AI worker: Kevin");
    expect(getActiveWorkerChat()).toBeUndefined();
  });

  it("suppresses claims of actions that chat could not execute", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({ response: "I have emailed the customer." });
    const response = await chatWithWorker("Safety Worker", "Email the customer");
    expect(response).toContain("No action was executed");
    expect(response).not.toContain("I have emailed");
  });

  // A Worker announced "I will create an Arturo Task for you to review" and
  // then printed a Task block for task-2, which did not exist. The operator
  // ran /task inspect task-2 and got "Task not found". Future tense slips
  // past the action-claim check, so the id itself has to be checked.
  it("names a record id the model invented", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({
      response: "I will create an Arturo Task.\n\nTask task-2\nStatus pending",
    });
    const response = await chatWithWorker("Safety Worker", "Make the schedule");
    expect(response).toContain("task-2");
    expect(response).toContain("does not exist");
    expect(response).toContain("Nothing was created");
  });

  it("says nothing when the model quotes a Task that is real", async () => {
    const { clearJobs, enqueueJob } = await import("../runtime/jobQueue");
    clearJobs();
    const job = enqueueJob("Review the cube", "Safety Worker");
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({
      response: `${job.id} is the one I completed earlier.`,
    });
    const response = await chatWithWorker("Safety Worker", "Which task?");
    expect(response).not.toContain("does not exist");
    clearJobs();
  });

  it("keeps the model's answer alongside the invented-id warning", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({
      response: "Practices are Monday to Friday. See task-9 for the detail.",
    });
    const response = await chatWithWorker("Safety Worker", "Summarise");
    expect(response).toContain("Practices are Monday to Friday");
    expect(response).toContain("task-9");
  });

  it("does not read human-task-3 as a missing task-3", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({
      response: "human-task-3 is waiting on you.",
    });
    const response = await chatWithWorker("Safety Worker", "What is waiting?");
    // Singular "does" proves one id was found, not two: a regex that let
    // task-3 match inside human-task-3 would report both and say "do".
    expect(response).toContain("referred to human-task-3, which does not exist");
  });
});
