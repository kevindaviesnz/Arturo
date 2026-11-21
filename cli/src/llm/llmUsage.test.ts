import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  getLlmTokensUsed,
  recordLlmTokenUsage,
  resetLlmTokenUsage,
} from "./llmUsage";

beforeEach(
  resetLlmTokenUsage
);

describe("llmUsage", () => {
  it("accumulates valid provider token counts", () => {
    recordLlmTokenUsage(12);
    recordLlmTokenUsage(8);

    expect(
      getLlmTokensUsed()
    ).toBe(20);
  });

  it("ignores invalid token metadata", () => {
    recordLlmTokenUsage(undefined);
    recordLlmTokenUsage(-4);
    recordLlmTokenUsage(Number.NaN);

    expect(
      getLlmTokensUsed()
    ).toBe(0);
  });
});
