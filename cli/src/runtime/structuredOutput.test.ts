import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isStructuredWorkerResult,
  tryParseStructuredOutput,
} from "./structuredOutput";

describe("isStructuredWorkerResult", () => {
  it("accepts valid structured worker results", () => {
    expect(
      isStructuredWorkerResult({
        type: "research.result",
        payload: {
          summary: "Test",
        },
      })
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(
      isStructuredWorkerResult(null)
    ).toBe(false);
  });

  it("rejects objects without a string type", () => {
    expect(
      isStructuredWorkerResult({
        type: 123,
        payload: {},
      })
    ).toBe(false);
  });

  it("rejects objects without payload", () => {
    expect(
      isStructuredWorkerResult({
        type: "research.result",
      })
    ).toBe(false);
  });
});

describe("tryParseStructuredOutput", () => {
  it("parses valid structured JSON output", () => {
    expect(
      tryParseStructuredOutput(
        JSON.stringify({
          type: "research.result",
          payload: {
            summary: "AI-native startups use AI as a core capability.",
          },
        })
      )
    ).toEqual({
      type: "research.result",
      payload: {
        summary: "AI-native startups use AI as a core capability.",
      },
    });
  });

  it("returns undefined for invalid JSON", () => {
    expect(
      tryParseStructuredOutput(
        "not json"
      )
    ).toBeUndefined();
  });

  it("returns undefined for valid JSON with wrong shape", () => {
    expect(
      tryParseStructuredOutput(
        JSON.stringify({
          message: "hello",
        })
      )
    ).toBeUndefined();
  });
});