import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../llm/ollamaStatus", () => ({
  checkOllamaAvailability: vi.fn(),
  pullOllamaModel: vi.fn(),
}));

vi.mock("../llm/apiKeyStore", () => ({
  hasApiKey: vi.fn(),
  looksLikePlausibleKey: vi.fn((v: string) => v.trim().length >= 8 && !/\s/.test(v.trim())),
  saveApiKey: vi.fn(),
}));

import {
  checkOllamaAvailability,
  pullOllamaModel,
} from "../llm/ollamaStatus";

import {
  hasApiKey,
  saveApiKey,
} from "../llm/apiKeyStore";

import {
  clearSelectedModel,
  getSelectedModel,
} from "../llm/modelSelection";

import {
  clearPendingModelState,
  handleUiModelCommand,
  handleUiModelReply,
  isModelMenuActive,
} from "./uiModelEntries";

const availability = vi.mocked(checkOllamaAvailability);
const pull = vi.mocked(pullOllamaModel);
const keyPresent = vi.mocked(hasApiKey);
const saveKey = vi.mocked(saveApiKey);

/** Finds the 1-based index of the first listed choice matching text. */
function choiceNumber(body: string, contains: string): string {
  const line = body.split("\n").find((l) => /^\d+\./.test(l.trim()) && l.includes(contains));
  return line!.trim().split(".")[0];
}

describe("/model", () => {
  beforeEach(() => {
    clearPendingModelState();
    clearSelectedModel();
    vi.clearAllMocks();
    keyPresent.mockReturnValue(false);
  });

  afterEach(() => {
    clearPendingModelState();
    clearSelectedModel();
  });

  it("shows installed models, downloadable major models, and paid cloud models", async () => {
    availability.mockResolvedValue({
      reachable: true,
      models: ["llama3.2:latest"],
    });

    const [entry] = await handleUiModelCommand();

    expect(entry.label).toBe("Choose a model");
    expect(entry.body).toContain("llama3.2:latest");        // installed
    expect(entry.body).toContain("free, needs downloading"); // catalog
    expect(entry.body).toContain("paid, online");            // cloud
    expect(entry.body).toContain("Something else");          // custom
  });

  it("switches to an installed model and remembers it", async () => {
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "llama3.2:latest");

    const result = await handleUiModelReply(n);

    expect(result?.[0].label).toBe("Model changed");
    expect(getSelectedModel()).toEqual({ provider: "ollama", model: "llama3.2:latest" });
  });

  it("reports the menu as active while it waits, so the router lets it own the reply", async () => {
    // The router checks isModelMenuActive() ahead of any pending yes/no
    // confirmation — otherwise a stale "create these?" confirmation swallows the
    // model pick the operator was invited to make right at that prompt.
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    expect(isModelMenuActive()).toBe(false);

    const [entry] = await handleUiModelCommand();
    expect(isModelMenuActive()).toBe(true);

    await handleUiModelReply(choiceNumber(entry.body, "llama3.2:latest"));
    expect(isModelMenuActive()).toBe(false);
  });

  it("confirms before downloading a not-installed catalog model", async () => {
    availability.mockResolvedValue({ reachable: true, models: [] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "mistral");

    const confirm = await handleUiModelReply(n);
    expect(confirm?.[0].label).toBe("Download needed");
    expect(getSelectedModel()).toBeUndefined();

    pull.mockResolvedValue({ ok: true });
    const done = await handleUiModelReply("yes");
    expect(pull).toHaveBeenCalledWith("mistral", expect.any(Function));
    expect(done?.[0].label).toBe("Model changed");
  });

  it("warns about cost, then asks for and saves an API key for a paid model", async () => {
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "gemini");

    const cost = await handleUiModelReply(n);
    expect(cost?.[0].label).toBe("This one costs money");
    expect(getSelectedModel()).toBeUndefined();

    const askKey = await handleUiModelReply("yes");
    expect(askKey?.[0].label).toBe("Paste your API key");
    expect(askKey?.[0].body).toContain("GEMINI_API_KEY".length ? "API key" : "");

    const done = await handleUiModelReply("AIzaSyRealisticLookingKey123");
    expect(saveKey).toHaveBeenCalledWith("GEMINI_API_KEY", "AIzaSyRealisticLookingKey123");
    expect(done?.[0].label).toBe("Model changed");
    expect(getSelectedModel()).toEqual({ provider: "gemini", model: expect.stringContaining("gemini") });
  });

  it("skips the key prompt when the paid provider key is already set", async () => {
    keyPresent.mockReturnValue(true);
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "gemini");

    await handleUiModelReply(n);          // pick cloud
    const done = await handleUiModelReply("yes");  // confirm cost -> already have key

    expect(saveKey).not.toHaveBeenCalled();
    expect(done?.[0].label).toBe("Model changed");
    expect(getSelectedModel()?.provider).toBe("gemini");
  });

  it("does not save a key or switch when the pasted key looks implausible", async () => {
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "gemini");
    await handleUiModelReply(n);
    await handleUiModelReply("yes");

    const result = await handleUiModelReply("nope");
    expect(saveKey).not.toHaveBeenCalled();
    expect(result?.[0].label).toBe("Staying local");
    expect(getSelectedModel()).toBeUndefined();
  });

  it("lets the operator type a custom local model name", async () => {
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const [entry] = await handleUiModelCommand();
    const n = choiceNumber(entry.body, "Something else");

    const ask = await handleUiModelReply(n);
    expect(ask?.[0].label).toBe("Type a model name");

    // Not installed -> offer download.
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    const confirm = await handleUiModelReply("qwen2.5:14b");
    expect(confirm?.[0].label).toBe("Download needed");
  });

  it("keeps the current model when the reply is not a listed number", async () => {
    availability.mockResolvedValue({ reachable: true, models: ["llama3.2:latest"] });
    await handleUiModelCommand();

    const entries = await handleUiModelReply("whatever");
    expect(entries?.[0].label).toBe("Model unchanged");
    expect(getSelectedModel()).toBeUndefined();
  });

  it("guides instead of erroring when the model server is unreachable", async () => {
    availability.mockResolvedValue({ reachable: false });

    const [entry] = await handleUiModelCommand();
    expect(entry.label).toMatch(/model server/i);
    expect(entry.body).not.toMatch(/ECONNREFUSED|fetch failed/i);
  });

  it("passes replies through untouched when /model is not waiting on anything", async () => {
    expect(await handleUiModelReply("yes")).toBeUndefined();
  });
});
