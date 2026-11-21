import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithGemini } from "./geminiClient";
import { generateWithOllama } from "./ollamaClient";
import { generateWithConfiguredLlm, generateWithPaidEscalation } from "./llmClient";
import { getModelRoutingStatus, resetModelRoutingUsage } from "./modelRouting";

vi.mock("./geminiClient", () => ({ generateWithGemini: vi.fn() }));
vi.mock("./ollamaClient", () => ({ generateWithOllama: vi.fn() }));

const keys = [
  "ARTURO_LLM_PROVIDER",
  "ARTURO_LLM_MODEL",
  "ARTURO_LLM_ROUTING_MODE",
  "ARTURO_PAID_ESCALATION_ENABLED",
  "ARTURO_PAID_ESCALATION_MODEL",
  "ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION",
  "GEMINI_API_KEY",
] as const;
let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  resetModelRoutingUsage();
  vi.resetAllMocks();
});

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetModelRoutingUsage();
});

describe("llm client routing", () => {
  it("keeps ordinary calls local by default", async () => {
    vi.mocked(generateWithOllama).mockResolvedValue({ response: "local" });
    await expect(generateWithConfiguredLlm({ model: "local-model", prompt: "work" }))
      .resolves.toEqual({ response: "local" });
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("uses the separately configured paid model only through explicit escalation", async () => {
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "approved-paid-model";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "1";
    process.env.GEMINI_API_KEY = "secret";
    vi.mocked(generateWithGemini).mockResolvedValue({ response: "corrected" });

    await expect(generateWithPaidEscalation({
      prompt: "repair schema",
      reason: "repeated-structured-output-failure",
    })).resolves.toEqual({ response: "corrected" });
    expect(generateWithGemini).toHaveBeenCalledWith({
      model: "approved-paid-model",
      prompt: "repair schema",
    });
    expect(getModelRoutingStatus().paidCallsUsed).toBe(1);
  });

  it("forces ordinary local-first calls through the configured Ollama tier", async () => {
    process.env.ARTURO_LLM_PROVIDER = "gemini";
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_LLM_MODEL = "approved-local-model";
    vi.mocked(generateWithOllama).mockResolvedValue({ response: "local" });

    await expect(generateWithConfiguredLlm({ model: "remote-worker-model", prompt: "work" }))
      .resolves.toEqual({ response: "local" });
    expect(generateWithOllama).toHaveBeenCalledWith({
      model: "approved-local-model",
      prompt: "work",
    });
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("does not call a provider when escalation is disabled", async () => {
    await expect(generateWithPaidEscalation({
      prompt: "work",
      reason: "human-authorized-quality-review",
    })).rejects.toThrow("Paid model escalation is not configured");
    expect(generateWithGemini).not.toHaveBeenCalled();
  });

  it("explains that failed external escalation still consumes its reservation", async () => {
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "approved-paid-model";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "1";
    process.env.GEMINI_API_KEY = "secret";
    vi.mocked(generateWithGemini).mockRejectedValue(
      new Error("Provider quota unavailable.")
    );

    await expect(
      generateWithPaidEscalation({
        prompt: "work",
        reason: "human-authorized-quality-review",
      })
    ).rejects.toThrow(
      "allowance was reserved"
    );
    expect(
      getModelRoutingStatus().paidCallsRemaining
    ).toBe(0);
  });
});

describe("a paid escalation to a model Arturo has never heard of", () => {
  it("names the configured model instead of blaming the provider", async () => {
    // Three scenario runs read "HTTP 503 UNAVAILABLE ... Check provider status
    // and configuration" as an outage. The configuration was the problem:
    // ARTURO_PAID_ESCALATION_MODEL was set to a Gemini model that does not
    // exist, and Arturo already knew the id was not one of its own.
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "gemini-3.5-flash";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "1";
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(generateWithGemini).mockRejectedValue(
      new Error("Gemini request failed for model gemini-3.5-flash. HTTP 503.")
    );

    const failure = await generateWithPaidEscalation({
      prompt: "anything",
      reason: "human-authorized-quality-review",
    }).catch((error: Error) => error.message);

    expect(failure).toContain("gemini-3.5-flash");
    expect(failure).toContain("not a model Arturo knows about");
    expect(failure).toContain("ARTURO_PAID_ESCALATION_MODEL");
    // The known ids come from the catalog, so the hint cannot go stale.
    expect(failure).toContain("gemini-2.5-flash");
    // And the reservation is still reported, because it still happened.
    expect(failure).toContain("remains consumed");
  });

  it("says nothing extra when the model is one it knows", async () => {
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "gemini-2.5-flash";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "1";
    process.env.GEMINI_API_KEY = "test-key";
    vi.mocked(generateWithGemini).mockRejectedValue(
      new Error("Gemini request failed. HTTP 503.")
    );

    const failure = await generateWithPaidEscalation({
      prompt: "anything",
      reason: "human-authorized-quality-review",
    }).catch((error: Error) => error.message);

    expect(failure).not.toContain("not a model Arturo knows about");
  });
});
