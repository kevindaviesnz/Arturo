import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearSelectedModel,
  setSelectedModel,
} from "./modelSelection";

import {
  getModelRoutingStatus,
} from "./modelRouting";

/**
 * /model is the single place the model is chosen, and the choice holds until
 * it is run again. Anything that names a model to an operator — a Worker
 * record, a capability attestation — has to name the one that will actually be
 * called, or the record is worse than no record.
 */
describe("the effective model", () => {
  beforeEach(() => {
    clearSelectedModel();
  });
  afterEach(() => {
    clearSelectedModel();
  });

  it("comes from the /model selection, outranking a per-Worker name", () => {
    setSelectedModel({ provider: "ollama", model: "qwen2.5:14b" });
    expect(getModelRoutingStatus().localModel).toBe("qwen2.5:14b");
  });

  it("falls back to the configured default when nothing is selected", () => {
    const expected = process.env.ARTURO_LLM_MODEL ?? "llama3.2:latest";
    expect(getModelRoutingStatus().localModel).toBe(expected);
  });

  it("never lets a paid selection become the local route", () => {
    // A paid pick is applied per call through the budget-capped path; it must
    // not silently become the default every local call uses.
    setSelectedModel({ provider: "gemini", model: "gemini-2.5-pro" });
    expect(getModelRoutingStatus().localModel).not.toBe("gemini-2.5-pro");
  });
});
