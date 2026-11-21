import { afterEach, describe, expect, it, vi } from "vitest";

import { refusePaidModelRun } from "./startBotRun";
import * as modelSelection from "../llm/modelSelection";

afterEach(() => {
  vi.restoreAllMocks();
});

function selects(
  selection: modelSelection.ModelSelection | undefined
): void {
  vi.spyOn(modelSelection, "getSelectedModel").mockReturnValue(selection);
}

describe("a bot run that would spend money", () => {
  it("refuses a paid model when the run was not started with --paid", () => {
    selects({ provider: "anthropic", model: "claude-opus-4-8" });
    expect(refusePaidModelRun(false)).toContain("claude-opus-4-8");
  });

  it("refuses every paid provider, not just the one that prompted this", () => {
    for (const provider of ["anthropic", "openai", "gemini"] as const) {
      selects({ provider, model: `${provider}-model` });
      expect(refusePaidModelRun(false)).toBeDefined();
    }
  });

  it("allows it once the operator has asked for it explicitly", () => {
    selects({ provider: "gemini", model: "gemini-2.5-pro" });
    expect(refusePaidModelRun(true)).toBeUndefined();
  });

  it("says nothing about a local model, with or without the flag", () => {
    selects({ provider: "ollama", model: "llama3.2:latest" });
    expect(refusePaidModelRun(false)).toBeUndefined();
    expect(refusePaidModelRun(true)).toBeUndefined();
  });

  it("says nothing when no model has been chosen at all", () => {
    selects(undefined);
    expect(refusePaidModelRun(false)).toBeUndefined();
  });

  it("names both ways out rather than only refusing", () => {
    selects({ provider: "openai", model: "gpt-4o" });
    const refusal = refusePaidModelRun(false) ?? "";
    expect(refusal).toContain("/model");
    expect(refusal).toContain("--paid");
    expect(refusal).toContain("Nothing has been typed");
  });

  it("says why the usual cap does not save the operator here", () => {
    selects({ provider: "anthropic", model: "claude-sonnet-5" });
    expect(refusePaidModelRun(false)).toContain("not covered by Arturo's cap");
  });
});
