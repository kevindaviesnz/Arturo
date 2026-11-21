import { describe, expect, it } from "vitest";
import {
  buildMissionSynthesisPrompt,
  findUnsupportedQuantities,
  joinAnswersAsMission,
  MAX_MISSION_LENGTH,
  parseSynthesisedMission,
} from "./missionSynthesis";

const transcript = [
  { role: "assistant" as const, content: "What will the business do?" },
  { role: "user" as const, content: "a sole legal practice specialing in property law" },
  { role: "assistant" as const, content: "Residential or commercial?" },
  { role: "user" as const, content: "residential" },
  { role: "assistant" as const, content: "Will you handle leases?" },
  { role: "user" as const, content: "no" },
];

describe("buildMissionSynthesisPrompt", () => {
  it("includes both sides so a bare answer keeps its meaning", () => {
    const prompt = buildMissionSynthesisPrompt("Oakview Law", transcript);

    expect(prompt).toContain("Adviser: Will you handle leases?");
    expect(prompt).toContain("Operator: no");
  });

  it("forbids inventing detail the operator never gave", () => {
    expect(buildMissionSynthesisPrompt("Oakview Law", transcript)).toMatch(
      /Do not invent a location, a\s+client base/
    );
  });

  it("asks for an exclusion to be expressed as focus", () => {
    expect(buildMissionSynthesisPrompt("Oakview Law", transcript)).toContain(
      "express the resulting focus rather"
    );
  });
});

describe("parseSynthesisedMission", () => {
  it("returns a synthesised mission", () => {
    expect(
      parseSynthesisedMission(
        JSON.stringify({
          mission:
            "Oakview Law is a sole legal practice specialising in residential property sale and purchase.",
        })
      )
    ).toContain("residential property sale and purchase");
  });

  it("tolerates markdown fences", () => {
    expect(
      parseSynthesisedMission(
        '```json\n{"mission":"A sole practice serving small businesses."}\n```'
      )
    ).toBe("A sole practice serving small businesses.");
  });

  it("collapses stray whitespace", () => {
    expect(
      parseSynthesisedMission('{"mission":"A sole\\n\\n  practice."}')
    ).toBe("A sole practice.");
  });

  it("rejects a mission that just echoes the operator's first person", () => {
    expect(() =>
      parseSynthesisedMission(
        '{"mission":"I want to start a sole legal practice."}'
      )
    ).toThrow(/first-person/i);
  });

  it("rejects a mission longer than the display limit", () => {
    expect(() =>
      parseSynthesisedMission(
        JSON.stringify({ mission: "x".repeat(MAX_MISSION_LENGTH + 1) })
      )
    ).toThrow(/longer than/i);
  });

  it("rejects a response with no mission", () => {
    expect(() => parseSynthesisedMission("{}")).toThrow();
  });
});

describe("joinAnswersAsMission", () => {
  it("preserves the previous behaviour as a fallback", () => {
    expect(joinAnswersAsMission(transcript)).toBe(
      "a sole legal practice specialing in property law. residential. no"
    );
  });

  it("ignores the adviser's turns", () => {
    expect(joinAnswersAsMission(transcript)).not.toContain("Residential or commercial");
  });
});

describe("findUnsupportedQuantities", () => {
  const transcript = [
    { role: "assistant" as const, content: "Tell me about the business." },
    {
      role: "user" as const,
      content:
        "A community food bank. Two paid staff and about thirty volunteers, handing out around 200 food parcels a week.",
    },
  ];

  it("accepts quantities the operator stated, in words or digits", () => {
    expect(
      findUnsupportedQuantities(
        "Distributes 200 food parcels a week with 2 paid staff and 30 volunteers.",
        transcript
      )
    ).toEqual([]);
  });

  it("catches a frequency the operator never gave", () => {
    expect(
      findUnsupportedQuantities(
        "Distributes donated food parcels, six days a week.",
        transcript
      )
    ).toEqual(["6"]);
  });

  it("ignores a mission that states no quantities at all", () => {
    expect(
      findUnsupportedQuantities(
        "Provides food support to families in south Auckland.",
        transcript
      )
    ).toEqual([]);
  });
});

describe("parseSynthesisedMission quantity check", () => {
  const transcript = [
    { role: "user" as const, content: "We hand out 200 parcels a week." },
  ];

  it("rejects a mission that invents a number", () => {
    expect(() =>
      parseSynthesisedMission(
        JSON.stringify({ mission: "Hands out 200 parcels a week, six days a week." }),
        transcript
      )
    ).toThrow(/quantities the operator did not/);
  });

  it("accepts a mission whose numbers all came from the operator", () => {
    expect(
      parseSynthesisedMission(
        JSON.stringify({ mission: "Hands out 200 parcels a week to local families." }),
        transcript
      )
    ).toBe("Hands out 200 parcels a week to local families.");
  });
});
