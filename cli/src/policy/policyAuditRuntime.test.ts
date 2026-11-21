import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPolicyAuditLog,
} from "../storage/policyAuditLogRepository";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  recordPolicyCreated,
  recordPolicyDeleted,
  recordPolicyUpdated,
} from "./policyAuditRuntime";

describe("policyAuditRuntime", () => {
  // The runtime event log is shared, file-backed state. Clear it before each
  // test too, not only after, so these assertions on the exact event list are
  // isolated from whatever test file happened to run first.
  beforeEach(() => {
    clearPolicyAuditLog();
    clearRuntimeEventLog();
  });

  afterEach(() => {
    clearPolicyAuditLog();
    clearRuntimeEventLog();
  });

  it(
    "records policy creation",
    () => {
      recordPolicyCreated({
        id: "policy-1",
        description:
          "Deny high risk",
        effect: "deny",
        match: {
          riskLevel: "high",
        },
      });

      expect(
        loadRuntimeEventLog().events
      ).toMatchObject([
        {
          type: "policy.created",
          payload: {
            policyId: "policy-1",
          },
        },
      ]);
    }
  );

  it(
    "records policy update",
    () => {
      recordPolicyCreated({
        id: "policy-1",
        description:
          "Deny high risk",
        effect: "deny",
        match: {
          riskLevel: "high",
        },
      });

      recordPolicyUpdated({
        id: "policy-1",
        description:
          "Updated policy",
        effect: "deny",
        match: {
          riskLevel: "high",
        },
      });

      expect(
        loadRuntimeEventLog().events
      ).toMatchObject([
        {
          type: "policy.created",
          payload: {
            policyId: "policy-1",
          },
        },
        {
          type: "policy.updated",
          payload: {
            policyId: "policy-1",
          },
        },
      ]);
    }
  );

  it(
    "records policy deletion",
    () => {
      recordPolicyCreated({
        id: "policy-1",
        description:
          "Deny high risk",
        effect: "deny",
        match: {
          riskLevel: "high",
        },
      });

      recordPolicyUpdated({
        id: "policy-1",
        description:
          "Updated policy",
        effect: "deny",
        match: {
          riskLevel: "high",
        },
      });

      recordPolicyDeleted(
        "policy-1"
      );

      expect(
        loadRuntimeEventLog().events
      ).toMatchObject([
        {
          type: "policy.created",
          payload: {
            policyId: "policy-1",
          },
        },
        {
          type: "policy.updated",
          payload: {
            policyId: "policy-1",
          },
        },
        {
          type: "policy.deleted",
          payload: {
            policyId: "policy-1",
          },
        },
      ]);
    }
  );
});