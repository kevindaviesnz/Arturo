import {
  describe,
  expect,
  it,
} from "vitest";

import {
  addApprovalDecision,
  countApprovals,
  createApprovalChain,
  hasRejection,
  resolveApprovalChainStatus,
} from "./approvalChainStore";

describe("approval chains", () => {
  it("creates pending approval chain", () => {
    expect(
      createApprovalChain(
        "job-1",
        2
      )
    ).toEqual({
      jobId: "job-1",
      requiredApprovals: 2,
      decisions: [],
      status: "pending",
    });
  });

  it("counts approvals", () => {
    const chain =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    expect(
      countApprovals(chain)
    ).toBe(1);
  });

  it("detects rejection", () => {
    const chain =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "rejected",
          reason: "Needs review",
          timestamp: 1000,
        }
      );

    expect(
      hasRejection(chain)
    ).toBe(true);
  });

  it("stays pending until quorum is reached", () => {
    const chain =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    expect(
      resolveApprovalChainStatus(chain)
    ).toBe("pending");
  });

  it("approves when quorum is reached", () => {
    const first =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    const second =
      addApprovalDecision(
        first,
        {
          worker: "bob",
          decision: "approved",
          timestamp: 2000,
        }
      );

    expect(second.status).toBe(
      "approved"
    );
  });

  it("rejects immediately on any rejection", () => {
    const first =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    const second =
      addApprovalDecision(
        first,
        {
          worker: "bob",
          decision: "rejected",
          reason: "Unsafe",
          timestamp: 2000,
        }
      );

    expect(second.status).toBe(
      "rejected"
    );
  });

  it("does not mutate original chain", () => {
    const original =
      createApprovalChain(
        "job-1",
        1
      );

    const updated =
      addApprovalDecision(
        original,
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    expect(original.decisions).toEqual([]);
    expect(updated.decisions).toHaveLength(1);
  });

  it("ignores duplicate decisions from same worker", () => {
  const first =
    addApprovalDecision(
      createApprovalChain(
        "job-1",
        2
      ),
      {
        worker: "alice",
        decision: "approved",
        timestamp: 1000,
      }
    );

  const second =
    addApprovalDecision(
      first,
      {
        worker: "alice",
        decision: "approved",
        timestamp: 2000,
      }
    );

  expect(second.decisions).toHaveLength(1);
  expect(second.status).toBe("pending");
  });
  
  it("requires distinct workers to reach quorum", () => {
  const first =
    addApprovalDecision(
      createApprovalChain("job-1", 2),
      {
        worker: "alice",
        decision: "approved",
        timestamp: 1000,
      }
    );

  const duplicate =
    addApprovalDecision(
      first,
      {
        worker: "alice",
        decision: "approved",
        timestamp: 2000,
      }
    );

  expect(duplicate.status).toBe("pending");

  const second =
    addApprovalDecision(
      duplicate,
      {
        worker: "bob",
        decision: "approved",
        timestamp: 3000,
      }
    );

  expect(second.status).toBe("approved");
  });
  

it("uses threshold policy when present", () => {
  const chain =
    addApprovalDecision(
      createApprovalChain(
        "job-1",
        99,
        {
          type: "threshold",
          requiredApprovals: 1,
        }
      ),
      {
        worker: "alice",
        decision: "approved",
        timestamp: 1000,
      }
    );

  expect(chain.status).toBe("approved");
});

it("uses veto policy when present", () => {
  const chain =
    addApprovalDecision(
      createApprovalChain(
        "job-1",
        2,
        {
          type: "veto",
          requiredApprovals: 2,
        }
      ),
      {
        worker: "alice",
        decision: "rejected",
        timestamp: 1000,
      }
    );

  expect(chain.status).toBe("rejected");
});

});