import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPolicyCreatedEvent,
  createPolicyDeletedEvent,
  createPolicyUpdatedEvent,
} from "./policyAuditEvents";

const rule = {
  id: "policy-1",
  description:
    "Deny high risk",
  effect: "deny" as const,
  match: {
    riskLevel:
      "high" as const,
  },
};

describe("policyAuditEvents", () => {
  it("creates policy created event", () => {
    expect(
      createPolicyCreatedEvent(
        1,
        rule,
        1000
      )
    ).toMatchObject({
      sequence: 1,
      id:
        "policy-created-policy-1-1000",
      type: "policy.created",
      level: "info",
      message:
        "Policy created: policy-1",
      timestamp: 1000,
      payload: {
        policyId:
          "policy-1",
        rule,
      },
    });
  });

  it("creates policy updated event", () => {
    expect(
      createPolicyUpdatedEvent(
        2,
        rule,
        2000
      )
    ).toMatchObject({
      sequence: 2,
      id:
        "policy-updated-policy-1-2000",
      type: "policy.updated",
      level: "info",
      message:
        "Policy updated: policy-1",
      timestamp: 2000,
      payload: {
        policyId:
          "policy-1",
        rule,
      },
    });
  });

  it("creates policy deleted event", () => {
    expect(
      createPolicyDeletedEvent(
        3,
        "policy-1",
        3000
      )
    ).toMatchObject({
      sequence: 3,
      id:
        "policy-deleted-policy-1-3000",
      type: "policy.deleted",
      level: "warn",
      message:
        "Policy deleted: policy-1",
      timestamp: 3000,
      payload: {
        policyId:
          "policy-1",
      },
    });
  });
});