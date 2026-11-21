import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveApprovalGate,
} from "./approvalGate";

import type {
  Job,
} from "./jobQueue";

import type {
  ApprovalChain,
} from "./approvalChainStore";

import {
  createSignedApprovalDecision,
} from "./approvalDecisionSigning";
import {
  withRequirementsSignature,
} from "./approvalRequirementsSigning";
import { getApprovalSigningSecret } from "./runtimeSecrets";

const APPROVAL_SIGNING_SECRET =
  getApprovalSigningSecret(
    process.env
  );

/**
 * Creates test job.
 *
 * @param requiresApproval Whether job requires approval.
 * @returns Test job.
 *
 * PURE: No side effects.
 */
function createJob(
  requiresApproval: boolean
): Job {
  return {
    id: "job-1",
    task: "Deploy system",
    worker: "operator",
    requiredCapabilities:
      requiresApproval
        ? ["human-review"]
        : [],
    status: "queued",
    createdAt: 1,
  };
}

/**
 * Creates signed approval fixture.
 *
 * @param worker Approving worker.
 * @param timestamp Decision timestamp.
 * @returns Signed approval decision.
 *
 * PURE: No side effects.
 */
function createSignedApproval(
  worker: string,
  timestamp: number
) {
  return createSignedApprovalDecision(
    {
      worker,
      decision: "approved",
      timestamp,
    },
    "job-1",
    APPROVAL_SIGNING_SECRET
  );
}

/**
 * Creates approval chain fixture.
 *
 * @param status Approval status.
 * @returns Approval chain.
 *
 * PURE: No side effects.
 */
function createChain(
  status:
    | "pending"
    | "approved"
    | "rejected"
): ApprovalChain {
  if (status === "approved") {
    return withRequirementsSignature(
      {
        jobId: "job-1",
        requiredApprovals: 1,
        decisions: [
          createSignedApproval(
            "alice",
            1
          ),
        ],
        status,
      },
      APPROVAL_SIGNING_SECRET
    );
  }

  return withRequirementsSignature(
    {
      jobId: "job-1",
      requiredApprovals: 2,
      decisions: [],
      status,
    },
    APPROVAL_SIGNING_SECRET
  );
}

describe(
  "resolveApprovalGate",
  () => {
    it(
      "honours an external deterministic policy gate",
      () => {
        expect(
          resolveApprovalGate(
            createJob(false),
            createChain("pending"),
            true
          )
        ).toBe(
          "awaiting_approval"
        );
      }
    );

    it(
      "returns not_required for normal jobs",
      () => {
        expect(
          resolveApprovalGate(
            createJob(false)
          )
        ).toBe(
          "not_required"
        );
      }
    );

    it(
      "rejects tampered approval chains",
      () => {
        const result =
          resolveApprovalGate(
            createJob(true),
            {
              jobId: "job-1",
              requiredApprovals: 1,
              decisions: [
                {
                  worker: "alice",
                  decision:
                    "approved",
                  timestamp: 1000,
                  signature:
                    "tampered",
                } as any,
              ],
              status: "approved",
            }
          );

        expect(result).toBe(
          "rejected"
        );
      }
    );

    it(
      "returns awaiting_approval when chain missing",
      () => {
        expect(
          resolveApprovalGate(
            createJob(true)
          )
        ).toBe(
          "awaiting_approval"
        );
      }
    );

    it(
      "returns awaiting_approval for pending chains",
      () => {
        expect(
          resolveApprovalGate(
            createJob(true),
            createChain(
              "pending"
            )
          )
        ).toBe(
          "awaiting_approval"
        );
      }
    );

    it(
      "returns approved for approved chains",
      () => {
        expect(
          resolveApprovalGate(
            createJob(true),
            createChain(
              "approved"
            )
          )
        ).toBe(
          "approved"
        );
      }
    );

    it(
      "returns rejected for rejected chains",
      () => {
        expect(
          resolveApprovalGate(
            createJob(true),
            createChain(
              "rejected"
            )
          )
        ).toBe(
          "rejected"
        );
      }
    );

    it(
      "does not approve when status is forged 'approved' but there are no decisions",
      () => {
        // Attack: tamper the persisted chain to claim approval with an empty
        // decisions array. The gate must recompute from verified decisions and
        // refuse to approve, rather than trusting the unsigned status field.
        expect(
          resolveApprovalGate(
            createJob(true),
            {
              jobId: "job-1",
              requiredApprovals: 1,
              decisions: [],
              status: "approved",
            }
          )
        ).not.toBe("approved");
      }
    );

    it(
      "rejects an approval decision transplanted from another job's chain",
      () => {
        // Attack: take a legitimately signed approval for job-OTHER and place
        // it into job-1's chain. Because the signature is bound to the job id,
        // verification against job-1 must fail.
        const foreignDecision =
          createSignedApprovalDecision(
            {
              worker: "alice",
              decision: "approved",
              timestamp: 1,
            },
            "job-OTHER",
            APPROVAL_SIGNING_SECRET
          );

        expect(
          resolveApprovalGate(
            createJob(true),
            {
              jobId: "job-1",
              requiredApprovals: 1,
              decisions: [foreignDecision],
              status: "approved",
            }
          )
        ).toBe("rejected");
      }
    );

    it(
      "does not approve when requiredApprovals is downgraded after signing",
      () => {
        // Attack: a chain legitimately requires 2 approvals and holds 1 genuine
        // approval (status pending). The attacker edits requiredApprovals to 1 in
        // the store without re-signing the requirements. The gate must refuse.
        const signed =
          withRequirementsSignature(
            {
              jobId: "job-1",
              requiredApprovals: 2,
              decisions: [
                createSignedApproval(
                  "alice",
                  1
                ),
              ],
              status: "pending",
            },
            APPROVAL_SIGNING_SECRET
          );

        const tampered: ApprovalChain = {
          ...signed,
          requiredApprovals: 1,
          status: "approved",
        };

        expect(
          resolveApprovalGate(
            createJob(true),
            tampered
          )
        ).not.toBe("approved");
      }
    );

    it(
      "approves a genuine single-approval chain with a valid requirements signature",
      () => {
        expect(
          resolveApprovalGate(
            createJob(true),
            createChain("approved")
          )
        ).toBe("approved");
      }
    );
  }
);
