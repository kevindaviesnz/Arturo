import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ApprovalChain,
} from "./approvalChainStore";

import {
  verifyApprovalRequirementsSignature,
  withRequirementsSignature,
} from "./approvalRequirementsSigning";

const SECRET = "requirements-secret-000000000000000";

function baseChain(): ApprovalChain {
  return {
    jobId: "job-1",
    requiredApprovals: 2,
    decisions: [],
    status: "pending",
    governancePolicyId: "policy-1",
  };
}

describe("approvalRequirementsSigning", () => {
  it("verifies a freshly signed requirements envelope", () => {
    const signed = withRequirementsSignature(baseChain(), SECRET);
    expect(
      verifyApprovalRequirementsSignature(signed, SECRET)
    ).toBe(true);
  });

  it("fails when requiredApprovals is changed after signing", () => {
    const signed = withRequirementsSignature(baseChain(), SECRET);
    const tampered = { ...signed, requiredApprovals: 1 };
    expect(
      verifyApprovalRequirementsSignature(tampered, SECRET)
    ).toBe(false);
  });

  it("fails when the policy is changed after signing", () => {
    const signed = withRequirementsSignature(baseChain(), SECRET);
    const tampered: ApprovalChain = {
      ...signed,
      policy: { type: "threshold", requiredApprovals: 1 },
    };
    expect(
      verifyApprovalRequirementsSignature(tampered, SECRET)
    ).toBe(false);
  });

  it("fails when the signature is absent", () => {
    expect(
      verifyApprovalRequirementsSignature(baseChain(), SECRET)
    ).toBe(false);
  });

  it("does not verify against a different secret", () => {
    const signed = withRequirementsSignature(baseChain(), SECRET);
    expect(
      verifyApprovalRequirementsSignature(signed, "other-secret-00000000000000000000")
    ).toBe(false);
  });

  it("is stable across unanimous required-worker ordering", () => {
    const a = withRequirementsSignature(
      { ...baseChain(), policy: { type: "unanimous", requiredWorkers: ["a", "b"] } },
      SECRET
    );
    const b = withRequirementsSignature(
      { ...baseChain(), policy: { type: "unanimous", requiredWorkers: ["b", "a"] } },
      SECRET
    );
    expect(a.requirementsSignature).toBe(b.requirementsSignature);
  });
});
