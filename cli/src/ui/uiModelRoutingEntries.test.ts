import { afterEach, expect, it } from "vitest";
import { resetModelRoutingUsage } from "../llm/modelRouting";
import {
  readModelRoutingEntry,
  readModelsEntry,
} from "./uiModelRoutingEntries";

afterEach(() => resetModelRoutingUsage());

it("shows fail-closed routing status without exposing credentials", () => {
  const body = readModelRoutingEntry().body;
  expect(body).toContain("Mode:");
  expect(body).toContain("External calls left:");
  expect(body).toContain("Configuration ready:");
  expect(body).toContain("Provider quota and availability");
  expect(body).toContain("repeated structured-output validation failure only");
  expect(body).not.toContain(process.env.GEMINI_API_KEY ?? "impossible-secret-value");
});

it("lists every safe model choice without contacting a provider", () => {
  const body =
    readModelsEntry({
      ARTURO_LLM_MODEL: "llama-test",
      ARTURO_PAID_ESCALATION_MODEL: "gemini-test",
      ARTURO_MODEL_PROFILES_JSON: JSON.stringify({
        "premium-reasoning": {
          provider: "gemini",
          model: "gemini-reasoning-test",
        },
      }),
    }).body;

  expect(body).toContain("Friendly names:");
  expect(body).toContain("local");
  expect(body).toContain("premium");
  expect(body).toContain("local-default");
  expect(body).toContain("premium-default");
  expect(body).toContain("premium-reasoning");
  expect(body).toContain("llama-test");
  expect(body).toContain("gemini-test");
  // The list is a menu of what /model can offer, not a set of switch values.
  expect(body).toContain("Run /model to choose one of these by number");
  expect(body).toContain("until you run /model again");
  expect(body).not.toContain("--model");
  expect(body).not.toContain("--compare");
});
