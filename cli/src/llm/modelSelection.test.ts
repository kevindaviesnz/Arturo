import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearSelectedModel,
  getSelectedModel,
  setSelectedModel,
} from "./modelSelection";

import {
  getModelRoutingStatus,
} from "./modelRouting";

describe("modelSelection", () => {
  afterEach(clearSelectedModel);

  it("round-trips a local selection and survives a fresh read", () => {
    setSelectedModel({ provider: "ollama", model: "qwen2.5:14b" });
    expect(getSelectedModel()).toEqual({
      provider: "ollama",
      model: "qwen2.5:14b",
    });
  });

  it("returns undefined when nothing was ever chosen", () => {
    expect(getSelectedModel()).toBeUndefined();
  });

  it("clears back to no selection", () => {
    setSelectedModel({ provider: "ollama", model: "qwen2.5:14b" });
    clearSelectedModel();
    expect(getSelectedModel()).toBeUndefined();
  });

  it("routes the local model through the operator's choice, beating the environment default", () => {
    setSelectedModel({ provider: "ollama", model: "qwen2.5:14b" });
    expect(getModelRoutingStatus().localModel).toBe("qwen2.5:14b");
  });

  it("never lets a paid selection change the local route", () => {
    // A paid choice is applied per call through the budget-capped escalation
    // path; the local route must stay local so nothing else silently follows
    // the paid selection.
    setSelectedModel({ provider: "gemini", model: "some-paid-model" });
    expect(getModelRoutingStatus().localModel).not.toBe("some-paid-model");
  });
});
