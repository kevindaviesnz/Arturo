import { describe, expect, it } from "vitest";

import { createApprovalChain } from "./approvalChainStore";
import { refuseApprovalRelease } from "./approvalRuntime";

import type { ApprovalChain } from "./approvalChainStore";

/**
 * From scenario 016, where /approve on an already-rejected Task printed
 * "Approval status: rejected", then "Approved by ..." and "The work will run
 * now" underneath it — and queued the Task, recorded the Artefact decision as
 * approved, completed the run step and queued the next Workflow step. The chain
 * store had refused the decision correctly; every caller ignored that it had.
 */
describe("whether an approval releases the work", () => {
  const chainWith = (
    fields: Partial<ApprovalChain>
  ): ApprovalChain => ({
    ...createApprovalChain("task-1", 1),
    ...fields,
  });

  it("releases an approved chain", () => {
    expect(
      refuseApprovalRelease(chainWith({ status: "approved" }))
    ).toBeUndefined();
  });

  it("refuses a chain someone has already rejected", () => {
    const refusal = refuseApprovalRelease(
      chainWith({ status: "rejected" })
    );
    expect(refusal).toContain("already been rejected");
    expect(refusal).toContain("will not run");
  });

  it("names the Task, so the refusal is not ambiguous mid-session", () => {
    expect(
      refuseApprovalRelease(
        chainWith({ jobId: "task-9", status: "rejected" })
      )
    ).toContain("task-9");
  });

  it("holds a chain that is still short of its approvals", () => {
    const refusal = refuseApprovalRelease(
      chainWith({ requiredApprovals: 3, status: "pending" })
    );
    expect(refusal).toContain("3 more approvals");
    expect(refusal).toContain("stays held");
  });

  it("counts the approvals already given", () => {
    expect(
      refuseApprovalRelease(
        chainWith({
          requiredApprovals: 3,
          status: "pending",
          decisions: [
            {
              worker: "Quality Manager",
              decision: "approved",
              timestamp: 1,
            },
          ],
        })
      )
    ).toContain("2 more approvals");
  });

  it("says it in the singular for the last one outstanding", () => {
    expect(
      refuseApprovalRelease(
        chainWith({
          requiredApprovals: 2,
          status: "pending",
          decisions: [
            {
              worker: "Quality Manager",
              decision: "approved",
              timestamp: 1,
            },
          ],
        })
      )
    ).toContain("1 more approval.");
  });

  // A policy counts named approvers, not a total, so a subtraction there would
  // be a guess presented as a number.
  it("does not invent a count for a policy-governed chain", () => {
    const refusal = refuseApprovalRelease(
      chainWith({
        status: "pending",
        policy: {
          type: "unanimous",
          requiredWorkers: ["Quality Manager", "Plant Manager"],
        },
      })
    );
    expect(refusal).toContain("not fully approved yet");
    expect(refusal).not.toMatch(/\d+ more approval/);
  });
});
