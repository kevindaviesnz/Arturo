import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPolicyEvaluatedEvent,
} from "./policyEvents";

describe("policyEvents", () => {
  it("creates allow policy evaluated event", () => {
    expect(
      createPolicyEvaluatedEvent(
        1,
        {
          capabilityId:
            "filesystem.read",
          riskLevel: "low",
          role: "worker",
        },
        {
          effect: "allow",
        },
        1000
      )
    ).toMatchObject({
      sequence: 1,
      id: "policy-evaluated-1",
      type: "policy.evaluated",
      level: "info",
      message: "Policy evaluated: allow",
      timestamp: 1000,
      payload: {
        capabilityId:
          "filesystem.read",
        riskLevel: "low",
        role: "worker",
        effect: "allow",
      },
    });
  });

  it("creates deny policy evaluated event", () => {
    expect(
      createPolicyEvaluatedEvent(
        2,
        {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
          role: "worker",
        },
        {
          effect: "deny",
          matchedRuleId:
            "deny-high-risk",
        },
        2000
      )
    ).toMatchObject({
      sequence: 2,
      id: "policy-evaluated-2",
      type: "policy.evaluated",
      level: "warn",
      message: "Policy evaluated: deny",
      timestamp: 2000,
      payload: {
        capabilityId:
          "filesystem.delete",
        riskLevel: "high",
        role: "worker",
        effect: "deny",
        matchedRuleId:
          "deny-high-risk",
      },
    });
  });
});