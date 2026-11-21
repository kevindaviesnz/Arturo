import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPolicyAuditLog,
  loadPolicyAuditLog,
  savePolicyAuditLog,
} from "./policyAuditLogRepository";

afterEach(() => {
  clearPolicyAuditLog();
});

describe("policyAuditLogRepository", () => {
  it("persists policy audit records", () => {
    savePolicyAuditLog([
      {
        id: "policy-audit-1",
        sequence: 1,
        action:
          "policy.created",
        policyId:
          "policy-1",
        timestamp: 1000,
      },
    ]);

    expect(
      loadPolicyAuditLog()
    ).toEqual([
      {
        id: "policy-audit-1",
        sequence: 1,
        action:
          "policy.created",
        policyId:
          "policy-1",
        timestamp: 1000,
      },
    ]);
  });
});