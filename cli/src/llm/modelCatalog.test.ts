import { describe, expect, it } from "vitest";

import {
  CLOUD_CATALOG,
  LOCAL_CATALOG,
  apiKeyEnvVar,
  apiKeyHelpUrl,
  providerLabel,
} from "./modelCatalog";

describe("model catalog", () => {
  it("offers well-known free local models first", () => {
    expect(LOCAL_CATALOG.length).toBeGreaterThan(3);
    expect(LOCAL_CATALOG.every((entry) => entry.provider === "ollama")).toBe(true);
    expect(LOCAL_CATALOG.map((entry) => entry.model)).toContain("llama3.2");
  });

  it("offers paid cloud models only for providers Arturo can actually call", () => {
    const paid = new Set(["gemini", "anthropic", "openai"]);
    expect(CLOUD_CATALOG.every((entry) => paid.has(entry.provider))).toBe(true);
    // All three paid providers are represented.
    expect(CLOUD_CATALOG.some((entry) => entry.provider === "anthropic")).toBe(true);
    expect(CLOUD_CATALOG.some((entry) => entry.provider === "openai")).toBe(true);
    expect(CLOUD_CATALOG.some((entry) => entry.provider === "gemini")).toBe(true);
    // Model ids are the exact strings each SDK expects.
    expect(CLOUD_CATALOG.map((entry) => entry.model)).toContain("claude-opus-4-8");
    expect(CLOUD_CATALOG.map((entry) => entry.model)).toContain("gpt-4o");
  });

  it("names the API key variable and help URL for each paid provider", () => {
    expect(apiKeyEnvVar("gemini")).toBe("GEMINI_API_KEY");
    expect(apiKeyEnvVar("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(apiKeyEnvVar("openai")).toBe("OPENAI_API_KEY");
    expect(apiKeyEnvVar("ollama")).toBeUndefined();
    expect(apiKeyHelpUrl("gemini")).toMatch(/^https:/);
    expect(apiKeyHelpUrl("anthropic")).toMatch(/^https:/);
    expect(apiKeyHelpUrl("openai")).toMatch(/^https:/);
  });

  it("labels providers in plain words", () => {
    expect(providerLabel("gemini")).toBe("Google Gemini");
    expect(providerLabel("anthropic")).toBe("Anthropic Claude");
    expect(providerLabel("openai")).toBe("OpenAI GPT");
    expect(providerLabel("ollama")).toContain("local");
  });
});
