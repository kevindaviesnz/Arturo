import {
  describe,
  expect,
  it,
} from "vitest";

import {
  extractFirstJsonObjectText,
  isReviewLoopConfidence,
  isStringArray,
  parseJsonObject,
  parseReviewLoopDecision,
} from "./reviewLoopDecision";

describe("extractFirstJsonObjectText", () => {
  it("extracts JSON from noisy model output", () => {
    expect(
      extractFirstJsonObjectText(
        [
          "Worker: Reviewer AI",
          "Output:",
          '{ "decision": "approved", "reason": "ok", "confidence": "high" }',
        ].join("\n")
      )
    ).toBe(
      '{ "decision": "approved", "reason": "ok", "confidence": "high" }'
    );
  });

  it("repairs one missing final closing brace", () => {
    expect(
      extractFirstJsonObjectText(
        [
          "{",
          '  "decision": "rejected",',
          '  "reason": "Too vague.",',
          '  "requiredRevisions": ["Explain feedback loops"],',
          '  "confidence": "medium"',
        ].join("\n")
      )
    ).toBe(
      [
        "{",
        '  "decision": "rejected",',
        '  "reason": "Too vague.",',
        '  "requiredRevisions": ["Explain feedback loops"],',
        '  "confidence": "medium"',
        "}",
      ].join("\n")
    );
  });
});

describe("extractFirstJsonObjectText", () => {
  it("extracts JSON from noisy model output", () => {
    expect(
      extractFirstJsonObjectText(
        [
          "Worker: Reviewer AI",
          "Output:",
          '{ "decision": "approved", "reason": "ok", "confidence": "high" }',
        ].join("\n")
      )
    ).toBe(
      '{ "decision": "approved", "reason": "ok", "confidence": "high" }'
    );
  });

  it("repairs one missing final closing brace", () => {
    expect(
      extractFirstJsonObjectText(
        [
          '{',
          '  "decision": "rejected",',
          '  "reason": "Too vague.",',
          '  "requiredRevisions": ["Explain feedback loops"],',
          '  "confidence": "medium"',
        ].join("\n")
      )
    ).toBe(
      [
        "{",
        '  "decision": "rejected",',
        '  "reason": "Too vague.",',
        '  "requiredRevisions": ["Explain feedback loops"],',
        '  "confidence": "medium"',
        "}",
      ].join("\n")
    );
  });
});

describe("isReviewLoopConfidence", () => {
  it("accepts valid confidence values", () => {
    expect(
      isReviewLoopConfidence("low")
    ).toBe(true);

    expect(
      isReviewLoopConfidence("medium")
    ).toBe(true);

    expect(
      isReviewLoopConfidence("high")
    ).toBe(true);
  });

  it("rejects invalid confidence values", () => {
    expect(
      isReviewLoopConfidence("certain")
    ).toBe(false);

    expect(
      isReviewLoopConfidence(undefined)
    ).toBe(false);
  });
});

describe("isStringArray", () => {
  it("accepts arrays of strings", () => {
    expect(
      isStringArray([
        "revise novelty rationale",
        "separate safety risks",
      ])
    ).toBe(true);
  });

  it("rejects arrays containing non-strings", () => {
    expect(
      isStringArray([
        "valid",
        123,
      ])
    ).toBe(false);
  });
});

describe("parseJsonObject", () => {
  it("parses valid JSON objects", () => {
    expect(
      parseJsonObject(
        '{"decision":"approved"}'
      )
    ).toEqual({
      decision:
        "approved",
    });
  });

  it("rejects invalid JSON", () => {
    expect(
      parseJsonObject(
        "not json"
      )
    ).toBeUndefined();
  });

  it("rejects JSON arrays", () => {
    expect(
      parseJsonObject(
        '["approved"]'
      )
    ).toBeUndefined();
  });
});

describe("parseReviewLoopDecision", () => {
  it("parses approved decisions", () => {
    expect(
      parseReviewLoopDecision(
        JSON.stringify({
          decision:
            "approved",
          reason:
            "The route strategy is acceptable.",
          confidence:
            "medium",
        })
      )
    ).toEqual({
      decision:
        "approved",
      reason:
        "The route strategy is acceptable.",
      confidence:
        "medium",
    });
  });

  it("parses rejected decisions", () => {
    expect(
      parseReviewLoopDecision(
        JSON.stringify({
          decision:
            "rejected",
          reason:
            "The route strategy is too generic.",
          requiredRevisions: [
            "Compare route families more clearly",
            "Separate novelty risk from feasibility risk",
          ],
          confidence:
            "medium",
        })
      )
    ).toEqual({
      decision:
        "rejected",
      reason:
        "The route strategy is too generic.",
      requiredRevisions: [
        "Compare route families more clearly",
        "Separate novelty risk from feasibility risk",
      ],
      confidence:
        "medium",
      });
  });

  it("rejects malformed approved decisions", () => {
    expect(
      parseReviewLoopDecision(
        JSON.stringify({
          decision:
            "approved",
          confidence:
            "medium",
        })
      )
    ).toBeUndefined();
  });

  it("rejects malformed rejected decisions", () => {
    expect(
      parseReviewLoopDecision(
        JSON.stringify({
          decision:
            "rejected",
          reason:
            "Missing revisions.",
          confidence:
            "medium",
        })
      )
    ).toBeUndefined();
  });

  it("extracts the final JSON object when prompt schemas appear earlier", () => {
  expect(
    extractFirstJsonObjectText(
      [
        "Approval schema:",
        "{",
        '  "decision": "approved",',
        '  "reason": "short explanation",',
        '  "confidence": "low|medium|high"',
        "}",
        "",
        "Output:",
        "{",
        '  "decision": "rejected",',
        '  "reason": "Wrong explanation.",',
        '  "requiredRevisions": ["Explain Arturo correctly."],',
        '  "confidence": "low"',
        "}",
      ].join("\n")
    )
  ).toBe(
    [
      "{",
      '  "decision": "rejected",',
      '  "reason": "Wrong explanation.",',
      '  "requiredRevisions": ["Explain Arturo correctly."],',
      '  "confidence": "low"',
      "}",
    ].join("\n")
  );
  });

  it("repairs the final JSON object when it is missing its closing brace", () => {
  expect(
    extractFirstJsonObjectText(
      [
        "Output:",
        "{",
        '  "decision": "rejected",',
        '  "reason": "Wrong explanation.",',
        '  "requiredRevisions": [',
        '    "Explain Arturo as a workflow system."',
        "  ],",
        '  "confidence": "low"',
      ].join("\n")
    )
  ).toBe(
    [
      "{",
      '  "decision": "rejected",',
      '  "reason": "Wrong explanation.",',
      '  "requiredRevisions": [',
      '    "Explain Arturo as a workflow system."',
      "  ],",
      '  "confidence": "low"',
      "}",
    ].join("\n")
  );
});
  
});