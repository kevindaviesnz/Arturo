import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isAgentArchetype,
  parseArchetypeClassification,
} from "./classifyArchetype";

describe("isAgentArchetype", () => {
  it("returns true for a valid archetype", () => {
    expect(
      isAgentArchetype(
        "researcher"
      )
    ).toBe(true);
  });

  it("returns false for an invalid archetype", () => {
    expect(
      isAgentArchetype(
        "writer"
      )
    ).toBe(false);
  });
});

describe("parseArchetypeClassification", () => {
  it("parses a valid archetype classification", () => {
    expect(
      parseArchetypeClassification(
        JSON.stringify({
          archetype: "researcher",
          confidence: 0.95,
          reason: "The request requires research.",
        })
      )
    ).toEqual({
      archetype: "researcher",
      confidence: 0.95,
      reason: "The request requires research.",
    });
  });

  it("defaults missing confidence and reason", () => {
    expect(
      parseArchetypeClassification(
        JSON.stringify({
          archetype: "creator",
        })
      )
    ).toEqual({
      archetype: "creator",
      confidence: 0,
      reason: "",
    });
  });

  it("throws for invalid JSON", () => {
    expect(() =>
      parseArchetypeClassification(
        "not json"
      )
    ).toThrow();
  });

  it("throws for an unknown archetype", () => {
    expect(() =>
      parseArchetypeClassification(
        JSON.stringify({
          archetype: "writer",
          confidence: 0.9,
          reason: "Invalid archetype.",
        })
      )
    ).toThrow(
      "Invalid archetype classification"
    );
  });
});