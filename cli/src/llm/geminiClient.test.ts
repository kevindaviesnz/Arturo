import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatGeminiFailure,
  summarizeGeminiError,
} from "./geminiClient";

describe("Gemini error privacy", () => {
  it("extracts quota status without reproducing the raw provider body", () => {
    const raw = JSON.stringify({
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "quota detail containing-sensitive-context",
        details: [{ debug: "internal-provider-detail" }],
      },
    });

    expect(
      summarizeGeminiError(new Error(raw))
    ).toEqual({
      code: 429,
      status: "RESOURCE_EXHAUSTED",
    });

    const message =
      formatGeminiFailure(
        new Error(raw),
        "approved-model"
      ).message;
    expect(message).toContain("HTTP 429");
    expect(message).toContain("RESOURCE_EXHAUSTED");
    expect(message).not.toContain("containing-sensitive-context");
    expect(message).not.toContain("internal-provider-detail");
  });
});
