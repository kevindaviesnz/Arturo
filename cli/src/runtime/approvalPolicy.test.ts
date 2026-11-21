import {
  describe,
  expect,
  it,
} from "vitest";

import {
  countApprovedDecisions,
  evaluateApprovalPolicy,
  evaluateThresholdPolicy,
  evaluateUnanimousPolicy,
  hasRejectedDecision,
} from "./approvalPolicy";

describe("approvalPolicy", () => {
  it("counts approved decisions", () => {
    expect(
      countApprovedDecisions([
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        },
        {
          worker: "bob",
          decision: "rejected",
          timestamp: 2000,
        },
      ])
    ).toBe(1);
  });

  it("detects rejected decisions", () => {
    expect(
      hasRejectedDecision([
        {
          worker: "alice",
          decision: "rejected",
          timestamp: 1000,
        },
      ])
    ).toBe(true);
  });

  it("approves threshold policy when enough approvals exist", () => {
    expect(
      evaluateThresholdPolicy(
        2,
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
          {
            worker: "bob",
            decision: "approved",
            timestamp: 2000,
          },
        ]
      )
    ).toBe("approved");
  });

  it("keeps threshold policy pending when approvals are insufficient", () => {
    expect(
      evaluateThresholdPolicy(
        2,
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
        ]
      )
    ).toBe("pending");
  });

  it("approves unanimous policy when all required workers approve", () => {
    expect(
      evaluateUnanimousPolicy(
        [
          "alice",
          "bob",
        ],
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
          {
            worker: "bob",
            decision: "approved",
            timestamp: 2000,
          },
        ]
      )
    ).toBe("approved");
  });

  it("keeps unanimous policy pending when one required worker is missing", () => {
    expect(
      evaluateUnanimousPolicy(
        [
          "alice",
          "bob",
        ],
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
        ]
      )
    ).toBe("pending");
  });

  it("rejects veto policy when any rejection exists", () => {
    expect(
      evaluateApprovalPolicy(
        {
          type: "veto",
          requiredApprovals: 2,
        },
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
          {
            worker: "bob",
            decision: "rejected",
            timestamp: 2000,
          },
        ]
      )
    ).toBe("rejected");
  });

    it("approves veto policy when enough approvals exist and no rejection exists", () => {
    expect(
      evaluateApprovalPolicy(
        {
          type: "veto",
          requiredApprovals: 2,
        },
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
          {
            worker: "bob",
            decision: "approved",
            timestamp: 2000,
          },
        ]
      )
    ).toBe("approved");
  });

  it("keeps veto policy pending when approvals are insufficient and no rejection exists", () => {
    expect(
      evaluateApprovalPolicy(
        {
          type: "veto",
          requiredApprovals: 2,
        },
        [
          {
            worker: "alice",
            decision: "approved",
            timestamp: 1000,
          },
        ]
      )
    ).toBe("pending");
  });
  
});