import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  formatSafeOllamaUrl,
  generateWithOllama,
} from "./ollamaClient";

describe("Ollama error privacy", () => {
  it("removes endpoint credentials and query secrets", () => {
    const safe =
      formatSafeOllamaUrl(
        "https://user:password@example.com/api/generate?token=secret"
      );

    expect(safe).toBe(
      "https://example.com/api/generate"
    );
    expect(safe).not.toContain("password");
    expect(safe).not.toContain("token");
  });
});

describe("Ollama unreachable message", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns a raw connection failure into plain words that point at /model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));

    await expect(
      generateWithOllama({ model: "llama3.2:latest", prompt: "hi" })
    ).rejects.toThrow(/local AI model.*\/model/s);

    // The unintelligible original must not reach the operator.
    await expect(
      generateWithOllama({ model: "llama3.2:latest", prompt: "hi" })
    ).rejects.not.toThrow(/fetch failed/);
  });
});
