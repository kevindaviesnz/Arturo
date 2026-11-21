import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearApprovalChains,
} from "./approvalChainStore";

import {
  approveJobInChain,
  createJobApprovalChain,
  getApprovalStatus,
  rejectJobInChain,
} from "./approvalRuntime";

beforeEach(() => {
  clearApprovalChains();
});

describe("approval runtime", () => {
  it("creates job approval chain", () => {
    expect(
      createJobApprovalChain(
        "job-1",
        2
      )
    ).toMatchObject({
      jobId:
        "job-1",
      requiredApprovals:
        2,
      status:
        "pending",
    });
  });

  it("approves when quorum is reached", () => {
    createJobApprovalChain(
      "job-1",
      2
    );

    approveJobInChain(
      "job-1",
      "alice",
      1
    );

    expect(
      getApprovalStatus(
        "job-1"
      )
    ).toBe(
      "pending"
    );

    approveJobInChain(
      "job-1",
      "bob",
      2
    );

    expect(
      getApprovalStatus(
        "job-1"
      )
    ).toBe(
      "approved"
    );
  });

  it("rejects immediately", () => {
    createJobApprovalChain(
      "job-1",
      2
    );

    rejectJobInChain(
      "job-1",
      "alice",
      "Unsafe",
      1
    );

    expect(
      getApprovalStatus(
        "job-1"
      )
    ).toBe(
      "rejected"
    );
  });

  it("throws when approving missing chain", () => {
    expect(() =>
      approveJobInChain(
        "missing",
        "alice",
        1
      )
    ).toThrow(
      "Approval chain not found: missing"
    );
  });

  it("stores signed approval decisions", () => {
    createJobApprovalChain(
      "job-1",
      1
    );

    const chain =
      approveJobInChain(
        "job-1",
        "operator",
        1
      );

    expect(
      chain.decisions[0]
    ).toMatchObject({
      worker:
        "operator",
      decision:
        "approved",
      timestamp:
        1,
    });

    expect(
      (
        chain.decisions[0] as any
      ).signature
    ).toBeDefined();
  });

  it("stores signed rejection decisions", () => {
    createJobApprovalChain(
      "job-1",
      1
    );

    const chain =
      rejectJobInChain(
        "job-1",
        "operator",
        "Unsafe",
        1
      );

    expect(
      chain.decisions[0]
    ).toMatchObject({
      worker:
        "operator",
      decision:
        "rejected",
      reason:
        "Unsafe",
      timestamp:
        1,
    });

    expect(
      (
        chain.decisions[0] as any
      ).signature
    ).toBeDefined();
  });

  it("creates approval chain with policy", () => {
    const chain =
      createJobApprovalChain(
        "job-1",
        2,
        {
          type:
            "threshold",
          requiredApprovals:
            1,
        }
      );

    expect(
      chain
    ).toMatchObject({
      jobId:
        "job-1",
      requiredApprovals:
        2,
      policy: {
        type:
          "threshold",
        requiredApprovals:
          1,
      },
    });
  });

  it("preserves the governance policy that triggered approval", () => {
    const chain = createJobApprovalChain(
      "job-governed",
      1,
      undefined,
      "policy-analysis-review"
    );

    expect(chain.governancePolicyId).toBe("policy-analysis-review");
  });
});
