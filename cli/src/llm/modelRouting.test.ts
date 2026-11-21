import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canUsePaidEscalation,
  getModelRoutingStatus,
  reservePaidEscalation,
  resetModelRoutingUsage,
} from "./modelRouting";

const keys = [
  "ARTURO_LLM_ROUTING_MODE",
  "ARTURO_LLM_MODEL",
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
});

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetModelRoutingUsage();
});

describe("model routing policy", () => {
  it("is local and fail-closed by default", () => {
    const status = getModelRoutingStatus();
    expect(status).toMatchObject({
      mode: "single",
      localProvider: "ollama",
      localModel: "llama3.2:latest",
      paidEscalationEnabled: false,
      configured: false,
      paidCallsRemaining: 0,
    });
    expect(canUsePaidEscalation()).toBe(false);
  });

  it("requires every paid escalation control", () => {
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "approved-model";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "2";
    process.env.GEMINI_API_KEY = "secret";
    expect(canUsePaidEscalation()).toBe(true);
  });

  it("reserves calls before execution and enforces the hard session cap", () => {
    process.env.ARTURO_LLM_ROUTING_MODE = "local-first";
    process.env.ARTURO_PAID_ESCALATION_ENABLED = "true";
    process.env.ARTURO_PAID_ESCALATION_MODEL = "approved-model";
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "1";
    process.env.GEMINI_API_KEY = "secret";
    reservePaidEscalation("repeated-structured-output-failure");
    expect(getModelRoutingStatus()).toMatchObject({
      paidCallsUsed: 1,
      paidCallsRemaining: 0,
      lastEscalationReason: "repeated-structured-output-failure",
    });
    expect(() => reservePaidEscalation("human-authorized-quality-review"))
      .toThrow("session call budget is exhausted");
  });

  it("treats invalid budgets as zero", () => {
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION = "unlimited";
    expect(getModelRoutingStatus().maxPaidCallsPerSession).toBe(0);
  });
});
