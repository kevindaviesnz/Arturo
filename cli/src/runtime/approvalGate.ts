import type {
  Job,
} from "./jobQueue";

import type {
  ApprovalChain,
} from "./approvalChainStore";

import {
  countApprovals,
  hasRejection,
  resolveApprovalChainStatus,
} from "./approvalChainStore";

import {
  verifyApprovalDecisionSignature,
} from "./approvalDecisionSigning";

import {
  verifyApprovalRequirementsSignature,
} from "./approvalRequirementsSigning";

import {
  getLocalApprovalSigningSecret,
} from "./runtimeSecrets";

export type ApprovalGateState =
  | "not_required"
  | "awaiting_approval"
  | "approved"
  | "rejected";

type ApprovalChainDecision =
  ApprovalChain["decisions"][number];

type SignedApprovalChainDecision =
  ApprovalChainDecision & {
    readonly signature: string;
  };

/**
 * Checks whether an approval decision has a usable signature.
 *
 * @param decision Approval chain decision.
 * @returns True when the decision has a string signature.
 *
 * PURE: No side effects.
 */
export function hasApprovalDecisionSignature(
  decision: ApprovalChainDecision
): decision is SignedApprovalChainDecision {
  return (
    typeof (
      decision as {
        readonly signature?: unknown;
      }
    ).signature === "string"
  );
}

/**
 * Verifies integrity of all signed approval decisions.
 *
 * @param chain Approval chain.
 * @returns True when all signatures are valid.
 *
 * SIDE EFFECT: Reads APPROVAL_SIGNING_SECRET from process.env.
 */
export function verifyApprovalChainIntegrity(
  chain: ApprovalChain
): boolean {
  const secret =
    getLocalApprovalSigningSecret();

  return chain.decisions.every(
    (decision) => {
      if (
        !hasApprovalDecisionSignature(
          decision
        )
      ) {
        return false;
      }

      return verifyApprovalDecisionSignature(
        decision,
        chain.jobId,
        secret
      );
    }
  );
}

/**
 * Resolves approval state for a job.
 *
 * @param job Job being evaluated.
 * @param chain Optional approval chain.
 * @returns Approval gate state.
 *
 * SIDE EFFECT: May verify approval decision signatures using process.env.
 */
export function resolveApprovalGate(
  job: Job,
  chain?: ApprovalChain,
  policyRequiresApproval = false
): ApprovalGateState {
  const requiresApproval =
    policyRequiresApproval ||
    (
      job.requiredCapabilities ??
      []
    ).includes(
      "human-review"
    );

  if (!requiresApproval) {
    return "not_required";
  }

  if (!chain) {
    return "awaiting_approval";
  }

  if (
    !verifyApprovalChainIntegrity(
      chain
    )
  ) {
    return "rejected";
  }

  // A stored "rejected" status is honoured directly: trusting it can only
  // deny work, which is the fail-closed direction.
  if (
    chain.status ===
      "rejected" ||
    hasRejection(chain)
  ) {
    return "rejected";
  }

  // The approval *requirements* (how many approvals, which policy) must also be
  // authentic. Without this, an attacker with store write who holds one genuine
  // approval could lower requiredApprovals (3 -> 1) or rewrite the policy to make
  // that single approval sufficient. A missing/invalid requirements signature is
  // fail-closed: it never grants approval.
  if (
    !verifyApprovalRequirementsSignature(
      chain,
      getLocalApprovalSigningSecret()
    )
  ) {
    return "awaiting_approval";
  }

  // Approval, by contrast, is never taken from the unsigned `status` field.
  // It is recomputed from the signature-verified decisions above, and only
  // granted when at least one authentic approval decision exists.
  const verifiedStatus =
    resolveApprovalChainStatus(
      chain
    );

  if (
    verifiedStatus ===
      "approved" &&
    countApprovals(chain) >= 1
  ) {
    return "approved";
  }

  return "awaiting_approval";
}
