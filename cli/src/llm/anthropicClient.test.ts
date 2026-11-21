import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = { create };
  }
  // Preserve the APIError class the client narrows on.
  (FakeAnthropic as unknown as { APIError: unknown }).APIError = class extends Error {};
  return { default: FakeAnthropic };
});

import {
  formatAnthropicFailure,
  generateWithAnthropic,
  summarizeAnthropicError,
} from "./anthropicClient";

import * as usage from "./llmUsage";

describe("summarizeAnthropicError", () => {
  it("returns an empty summary for a non-API error", () => {
    expect(summarizeAnthropicError(new Error("boom"))).toEqual({});
  });
});

describe("formatAnthropicFailure", () => {
  it("gives plain guidance and never leaks the raw error body", () => {
    const err = formatAnthropicFailure(new Error("some raw body"), "claude-opus-4-8");
    expect(err.message).toContain("Claude request failed for model claude-opus-4-8");
    expect(err.message).not.toContain("some raw body");
  });
});

describe("generateWithAnthropic", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    create.mockReset();
    vi.restoreAllMocks();
  });

  it("refuses when no API key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      generateWithAnthropic({ model: "claude-opus-4-8", prompt: "hi" })
    ).rejects.toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("concatenates text blocks (dropping non-text) and records token usage", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-1234567890";
    create.mockResolvedValue({
      content: [
        { type: "text", text: "Hello " },
        { type: "thinking", thinking: "…" },
        { type: "text", text: "world" },
      ],
      usage: { input_tokens: 3, output_tokens: 2 },
    });
    const record = vi.spyOn(usage, "recordLlmTokenUsage");

    const result = await generateWithAnthropic({ model: "claude-opus-4-8", prompt: "hi" });

    expect(result.response).toBe("Hello world");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-8", max_tokens: 16000 })
    );
    expect(record).toHaveBeenCalledWith(5);
  });
});
