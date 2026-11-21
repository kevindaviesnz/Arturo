import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const create = vi.fn();

vi.mock("openai", () => {
  class FakeOpenAI {
    chat = { completions: { create } };
  }
  (FakeOpenAI as unknown as { APIError: unknown }).APIError = class extends Error {};
  return { default: FakeOpenAI };
});

import {
  formatOpenAiFailure,
  generateWithOpenAi,
  summarizeOpenAiError,
} from "./openaiClient";

import * as usage from "./llmUsage";

describe("summarizeOpenAiError", () => {
  it("returns an empty summary for a non-API error", () => {
    expect(summarizeOpenAiError(new Error("boom"))).toEqual({});
  });
});

describe("formatOpenAiFailure", () => {
  it("gives plain guidance and never leaks the raw error body", () => {
    const err = formatOpenAiFailure(new Error("some raw body"), "gpt-4o");
    expect(err.message).toContain("OpenAI request failed for model gpt-4o");
    expect(err.message).not.toContain("some raw body");
  });
});

describe("generateWithOpenAi", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    create.mockReset();
    vi.restoreAllMocks();
  });

  it("refuses when no API key is set", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      generateWithOpenAi({ model: "gpt-4o", prompt: "hi" })
    ).rejects.toThrow("OPENAI_API_KEY is not set");
  });

  it("returns the message content and records total token usage", async () => {
    process.env.OPENAI_API_KEY = "sk-openai-test-key-1234567890";
    create.mockResolvedValue({
      choices: [{ message: { content: "Hello world" } }],
      usage: { total_tokens: 7 },
    });
    const record = vi.spyOn(usage, "recordLlmTokenUsage");

    const result = await generateWithOpenAi({ model: "gpt-4o", prompt: "hi" });

    expect(result.response).toBe("Hello world");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o", max_completion_tokens: 16000 })
    );
    expect(record).toHaveBeenCalledWith(7);
  });
});
