import {
  describe,
  expect,
  it,
} from "vitest";

import {
  appendPolicyAuditRecord,
  createPolicyAuditLog,
} from "./policyAuditLog";

describe("policyAuditLog", () => {
  it("creates empty audit log", () => {
    expect(
      createPolicyAuditLog()
    ).toEqual([]);
  });

  it("appends audit records immutably", () => {
    const original =
      createPolicyAuditLog();

    const updated =
      appendPolicyAuditRecord(
        original,
        {
          id: "policy-audit-1",
          sequence: 1,
          action:
            "policy.created",
          policyId:
            "policy-1",
          timestamp: 1000,
          rule: {
            id: "policy-1",
            description:
              "Deny high risk",
            effect: "deny",
            match: {
              riskLevel:
                "high",
            },
          },
        }
      );

    expect(original).toEqual([]);
    expect(updated).toHaveLength(1);
  });
});