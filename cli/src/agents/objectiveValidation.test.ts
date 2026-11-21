import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isObjectiveLifetime,
  isObjectiveType,
  parseObjectiveClassification,
} from "./objectiveValidation";

describe("objectiveValidation", () => {
  it("recognizes supported objective types", () => {
    expect(
      isObjectiveType("create")
    ).toBe(true);

    expect(
      isObjectiveType("unknown")
    ).toBe(true);
  });

  it("rejects unsupported objective types", () => {
    expect(
      isObjectiveType("workflow")
    ).toBe(false);
  });

  it("recognizes objective lifetimes", () => {
    expect(
      isObjectiveLifetime("finite")
    ).toBe(true);

    expect(
      isObjectiveLifetime("persistent")
    ).toBe(true);
  });

  it("parses valid objective classification JSON", () => {
    expect(
      parseObjectiveClassification(
        JSON.stringify({
          description: "Create a fast fashion business",
          type: "create",
          lifetime: "finite",
          businessPattern: "Fashion Retail",
          supported: true,
          reason: "The request asks Arturo to create a business.",
        })
      )
    ).toEqual({
      description: "Create a fast fashion business",
      type: "create",
      lifetime: "finite",
      businessPattern: "Fashion Retail",
      supported: true,
      reason: "The request asks Arturo to create a business.",
    });
  });

  it("rejects unsupported objective classification type", () => {
    expect(() =>
      parseObjectiveClassification(
        JSON.stringify({
          description: "Do something",
          type: "unsupported",
          lifetime: "finite",
          businessPattern: "Unknown",
          supported: false,
          reason: "Unsupported type.",
        })
      )
    ).toThrow(
      "Invalid objective classification: type is unsupported"
    );
  });

  it("rejects unsupported lifetime", () => {
    expect(() =>
      parseObjectiveClassification(
        JSON.stringify({
          description: "Operate a mentoring business",
          type: "operate",
          lifetime: "forever",
          businessPattern: "Professional Services",
          supported: true,
          reason: "The request is ongoing.",
        })
      )
    ).toThrow(
      "Invalid objective classification: lifetime is unsupported"
    );
  });
});