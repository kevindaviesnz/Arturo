import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPolicyRuleIntegrityMarkerForTests,
  clearPolicyRules,
  loadPolicyRules,
  PolicyRuleIntegrityError,
  savePolicyRules,
} from "./policyRepository";

import {
  runtimeDb,
} from "./runtimeDatabase";

afterEach(
  () => {
    clearPolicyRules();
    clearPolicyRuleIntegrityMarkerForTests();
  }
);

beforeEach(() => {
  clearPolicyRules();
  clearPolicyRuleIntegrityMarkerForTests();
});

describe("policyRepository", () => {
  it("persists policy rules", () => {
    savePolicyRules([
      {
        id: "rule-1",
        description:
          "deny",
        effect: "deny",
        match: {},
      },
    ]);

    expect(
      loadPolicyRules()
    ).toEqual([
      {
        id: "rule-1",
        description:
          "deny",
        effect: "deny",
        match: {},
      },
    ]);
  });

  it("rejects a policy whose persisted effect was tampered", () => {
    savePolicyRules([
      {
        id: "rule-1",
        description:
          "deny shell execution",
        effect: "deny",
        match: {
          capabilityId:
            "shell-execute",
        },
      },
    ]);

    runtimeDb
      .prepare(
        "UPDATE policy_rules SET effect = ? WHERE id = ?"
      )
      .run(
        "allow",
        "rule-1"
      );

    expect(() =>
      loadPolicyRules()
    ).toThrow(
      PolicyRuleIntegrityError
    );
  });

  it("rejects policies whose persisted evaluation order was tampered", () => {
    savePolicyRules([
      {
        id: "rule-1",
        description:
          "deny shell execution",
        effect: "deny",
        match: {
          capabilityId:
            "shell-execute",
        },
      },
      {
        id: "rule-2",
        description:
          "allow analysis",
        effect: "allow",
        match: {
          capabilityId:
            "analysis",
        },
      },
    ]);

    runtimeDb
      .prepare(
        "UPDATE policy_rules SET position = CASE id WHEN ? THEN 1 WHEN ? THEN 0 ELSE position END"
      )
      .run(
        "rule-1",
        "rule-2"
      );

    expect(() =>
      loadPolicyRules()
    ).toThrow(
      "Policy rule integrity check failed"
    );
  });

  it("rejects malformed persisted match JSON instead of widening it to a wildcard", () => {
    runtimeDb
      .prepare(
        "INSERT INTO policy_rules (id, description, match_json, effect, position) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        "rule-1",
        "deny",
        "{",
        "deny",
        0
      );

    expect(() =>
      loadPolicyRules()
    ).toThrow(
      "Policy rule match_json is not valid JSON"
    );
  });

  it("signs unsigned legacy policy rules once", () => {
    runtimeDb
      .prepare(
        "INSERT INTO policy_rules (id, description, match_json, effect, position) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        "rule-1",
        "legacy",
        JSON.stringify({
          capabilityId:
            "email-send",
        }),
        "require-approval",
        0
      );

    expect(
      loadPolicyRules()
    ).toEqual([
      {
        id: "rule-1",
        description:
          "legacy",
        effect:
          "require-approval",
        match: {
          capabilityId:
            "email-send",
        },
      },
    ]);

    const row =
      runtimeDb
        .prepare(
          "SELECT integrity_signature AS integritySignature FROM policy_rules WHERE id = ?"
        )
        .get(
          "rule-1"
        ) as
        | {
            integritySignature?: string;
          }
        | undefined;

    expect(
      row?.integritySignature
    ).toMatch(
      /^[0-9a-f]{64}$/
    );
  });

  it("rejects a new unsigned policy after integrity migration", () => {
    expect(
      loadPolicyRules()
    ).toEqual([]);

    runtimeDb
      .prepare(
        "INSERT INTO policy_rules (id, description, match_json, effect, position) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        "rule-1",
        "unsigned",
        "{}",
        "allow",
        0
      );

    expect(() =>
      loadPolicyRules()
    ).toThrow(
      "Unsigned policy rules found after integrity migration"
    );
  });
});
