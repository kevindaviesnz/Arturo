import {
  describe,
  expect,
  it,
} from "vitest";

import {
  evaluatePolicy,
  policyRuleMatches,
} from "./policyEngine";

import type {
  PolicyContext,
} from "./policyContext";

import type {
  PolicyRule,
} from "./policyRule";

describe("policyEngine", () => {
  it("matches capability id", () => {
    const rule: PolicyRule = {
      id: "rule-1",
      description: "match",
      effect: "deny",
      match: {
        capabilityId:
          "filesystem.delete",
      },
    };

    const context: PolicyContext = {
      capabilityId:
        "filesystem.delete",
      riskLevel: "high",
    };

    expect(
      policyRuleMatches(
        rule,
        context
      )
    ).toBe(true);
  });

  it("does not match different capability", () => {
    const rule: PolicyRule = {
      id: "rule-1",
      description: "match",
      effect: "deny",
      match: {
        capabilityId:
          "filesystem.delete",
      },
    };

    const context: PolicyContext = {
      capabilityId:
        "filesystem.read",
      riskLevel: "high",
    };

    expect(
      policyRuleMatches(
        rule,
        context
      )
    ).toBe(false);
  });

  it("returns deny when no rules match", () => {
    const result =
      evaluatePolicy(
        [],
        {
          capabilityId:
            "filesystem.read",
          riskLevel: "low",
        }
      );

    expect(result).toEqual({
      effect: "deny",
    });
  });
  
  it("returns deny when deny rule matches", () => {
    const result =
      evaluatePolicy(
        [
          {
            id: "rule-1",
            description:
              "deny deletes",
            effect: "deny",
            match: {
              capabilityId:
                "filesystem.delete",
            },
          },
        ],
        {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
        }
      );

    expect(result).toEqual({
      effect: "deny",
      matchedRuleId:
        "rule-1",
    });
  });

  it("returns require approval when rule matches", () => {
    const result =
      evaluatePolicy(
        [
          {
            id: "rule-1",
            description:
              "approval",
            effect:
              "require-approval",
            match: {
              riskLevel:
                "high",
            },
          },
        ],
        {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
        }
      );

    expect(result).toEqual({
      effect:
        "require-approval",
      matchedRuleId:
        "rule-1",
    });
  });

  it("uses first matching rule", () => {
    const result =
      evaluatePolicy(
        [
          {
            id: "rule-1",
            description:
              "deny",
            effect: "deny",
            match: {
              riskLevel:
                "high",
            },
          },
          {
            id: "rule-2",
            description:
              "approval",
            effect:
              "require-approval",
            match: {
              riskLevel:
                "high",
            },
          },
        ],
        {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
        }
      );

    expect(result).toEqual({
      effect: "deny",
      matchedRuleId:
        "rule-1",
    });
  });

  it("matches role", () => {
  expect(
    policyRuleMatches(
      {
        id: "admin-allow",
        description:
          "Allow admin",
        effect: "allow",
        match: {
          role: "admin",
        },
      },
      {
        capabilityId:
          "filesystem.delete",
        riskLevel: "high",
        role: "admin",
      }
    )
  ).toBe(true);

  expect(
    policyRuleMatches(
      {
        id: "admin-allow",
        description:
          "Allow admin",
        effect: "allow",
        match: {
          role: "admin",
        },
      },
      {
        capabilityId:
          "filesystem.delete",
        riskLevel: "high",
        role: "worker",
      }
    )
  ).toBe(false);
  });
  
  it("matches trust boundary", () => {
  expect(
    policyRuleMatches(
      {
        id: "deny-external",
        description:
          "Deny external capabilities",
        effect: "deny",
        match: {
          trustBoundary: "external",
        },
      },
      {
        capabilityId:
          "email.send",
        riskLevel: "high",
        role: "worker",
        trustBoundary: "external",
      }
    )
  ).toBe(true);

  expect(
    policyRuleMatches(
      {
        id: "deny-external",
        description:
          "Deny external capabilities",
        effect: "deny",
        match: {
          trustBoundary: "external",
        },
      },
      {
        capabilityId:
          "math.add",
        riskLevel: "low",
        role: "worker",
        trustBoundary: "trusted",
      }
    )
  ).toBe(false);
});

  /**
   * The clause that lets one rule say "this Function, but only when it acts
   * outside Arturo" — how a staffing rule stops gating every draft and
   * summary while still catching anything irreversible.
   */
  describe("consequentialOnly", () => {
    const functionRule = {
      id: "staffing-approval:e-1:invoicing",
      description: "Approve outside effects",
      effect: "require-approval" as const,
      match: {
        businessFunctionId: "e-1:invoicing",
        consequentialOnly: true,
      },
    };

    const context = (consequential: boolean) => ({
      capabilityId: consequential ? "email-send" : "analysis",
      riskLevel: "low" as const,
      businessFunctionId: "e-1:invoicing",
      consequential,
    });

    it("matches work with an effect outside Arturo", () => {
      expect(policyRuleMatches(functionRule, context(true))).toBe(true);
    });

    it("does not match work without one", () => {
      expect(policyRuleMatches(functionRule, context(false))).toBe(false);
    });

    it("does not match when the caller never set the flag", () => {
      // Absent reads as false, so a caller that forgets can only fail to match
      // a consequentialOnly rule, never match one by accident.
      expect(
        policyRuleMatches(functionRule, {
          capabilityId: "email-send",
          riskLevel: "low",
          businessFunctionId: "e-1:invoicing",
        })
      ).toBe(false);
    });

    it("is a wildcard when the rule does not mention it", () => {
      const broadRule = {
        ...functionRule,
        match: { businessFunctionId: "e-1:invoicing" },
      };
      expect(policyRuleMatches(broadRule, context(true))).toBe(true);
      expect(policyRuleMatches(broadRule, context(false))).toBe(true);
    });

    it("means non-consequential work only when set to false", () => {
      // Compared against undefined rather than falsiness: a rule saying false
      // is making a statement, where an absent field declines to.
      const benignOnly = {
        ...functionRule,
        match: {
          businessFunctionId: "e-1:invoicing",
          consequentialOnly: false,
        },
      };
      expect(policyRuleMatches(benignOnly, context(false))).toBe(true);
      expect(policyRuleMatches(benignOnly, context(true))).toBe(false);
    });
  });
});
