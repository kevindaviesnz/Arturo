import type {
  ApprovalPolicy,
} from "./approvalPolicy";

import {
  evaluateApprovalPolicy,
  countApprovedDecisions,
} from "./approvalPolicy";
import {
  clearPersistedApprovalChains,
  loadApprovalChains,
  saveApprovalChain,
} from "../storage/approvalChainRepository";

export type ApprovalDecisionValue =
  | "approved"
  | "rejected";

/**
 * What a decision was a decision about.
 *
 * - `release`: whether work Governance held may run. Given before any result
 *   exists, so it says nothing about what the work goes on to produce.
 * - `review`: a judgement on something a person was asked to review.
 *
 * One command records both, and the record used to say only "approved". A
 * lawyer who let a contract review run was shown as having approved the Task,
 * which reads as signing off a result he had not yet seen.
 */
export type ApprovalDecisionKind =
  | "release"
  | "review";

export type ApprovalDecision = {
  /** Verified User identity, absent on historical/local trusted decisions. */
  userId?: string;
  /** Absent on decisions recorded before the two were told apart. */
  kind?: ApprovalDecisionKind;
  worker: string;
  decision: ApprovalDecisionValue;
  reason?: string;
  timestamp: number;
};

export type ApprovalChainStatus =
  | "pending"
  | "approved"
  | "rejected";

export type ApprovalChain = {
  jobId: string;
  requiredApprovals: number;
  decisions: ApprovalDecision[];
  status: ApprovalChainStatus;
  policy?: ApprovalPolicy;
  governancePolicyId?: string;
  // HMAC over {jobId, requiredApprovals, policy, governancePolicyId} — binds the
  // approval *requirements* so they cannot be tampered (e.g. lowering the count)
  // once the chain is persisted. Set by the runtime when the chain is created.
  requirementsSignature?: string;
};

/**
 * Creates an approval chain.
 *
 * @param jobId Job id requiring approval.
 * @param requiredApprovals Number of approvals required.
 * @param policy Optional approval policy.
 * @returns Approval chain.
 *
 * PURE: No side effects.
 */
export function createApprovalChain(
  jobId: string,
  requiredApprovals: number,
  policy?: ApprovalPolicy,
  governancePolicyId?: string
): ApprovalChain {
  return {
    jobId,
    requiredApprovals,
    decisions: [],
    status: "pending",
    policy,
    governancePolicyId,
  };
}

export function hasDecisionFromWorker(
  chain: ApprovalChain,
  worker: string
): boolean {
  return chain.decisions.some(
    (decision) =>
      decision.worker === worker
  );
}

/**
 * Counts approvals in an approval chain.
 *
 * @param chain Approval chain.
 * @returns Number of approval decisions.
 *
 * PURE: No side effects.
 */
export function countApprovals(
  chain: ApprovalChain
): number {
  return countApprovedDecisions(chain.decisions);
}

/**
 * Checks whether an approval chain has a rejection.
 *
 * @param chain Approval chain.
 * @returns True when any decision rejected.
 *
 * PURE: No side effects.
 */
export function hasRejection(
  chain: ApprovalChain
): boolean {
  return chain.decisions.some(
    (decision) =>
      decision.decision === "rejected"
  );
}

/**
 * Resolves approval chain status from decisions and optional policy.
 *
 * @param chain Approval chain.
 * @returns Resolved approval chain status.
 *
 * PURE: No side effects.
 */
export function resolveApprovalChainStatus(
  chain: ApprovalChain
): ApprovalChainStatus {
  if (chain.policy) {
    const policyStatus =
      evaluateApprovalPolicy(
        chain.policy,
        chain.decisions
      );

    // Never treat a chain with no approvals as approved, even if a
    // degenerate policy (e.g. unanimous with an empty required-worker set)
    // is vacuously satisfied.
    if (
      policyStatus === "approved" &&
      countApprovals(chain) < 1
    ) {
      return "pending";
    }

    return policyStatus;
  }

  if (hasRejection(chain)) {
    return "rejected";
  }

  if (
    countApprovals(chain) >=
      Math.max(1, chain.requiredApprovals)
  ) {
    return "approved";
  }

  return "pending";
}

/**
 * Adds a decision to an approval chain.
 *
 * @param chain Approval chain.
 * @param decision Approval decision.
 * @returns Updated approval chain.
 *
 * PURE: No side effects.
 */
export function addApprovalDecision(
  chain: ApprovalChain,
  decision: ApprovalDecision
): ApprovalChain {
  if (
    chain.status === "approved" ||
    chain.status === "rejected"
  ) {
    return chain;
  }

  if (
    hasDecisionFromWorker(
      chain,
      decision.worker
    ) || (decision.userId !== undefined && chain.decisions.some(existing => existing.userId === decision.userId))
  ) {
    return chain;
  }

  const updated = {
    ...chain,
    decisions: [
      ...chain.decisions,
      decision,
    ],
  };

  return {
    ...updated,
    status:
      resolveApprovalChainStatus(
        updated
      ),
  };
}

let approvalChains:
  ApprovalChain[] = loadApprovalChains();

/**
 * Stores an approval chain.
 *
 * @param chain Approval chain to store.
 * @returns Stored approval chain.
 *
 * SIDE EFFECT: Mutates in-memory approval chain store.
 */
export function storeApprovalChain(
  chain: ApprovalChain
): ApprovalChain {
  approvalChains = [
    ...approvalChains.filter(
      (item) =>
        item.jobId !== chain.jobId
    ),
    chain,
  ];

  saveApprovalChain(chain);

  return chain;
}

/**
 * Gets approval chain by job id.
 *
 * @param jobId Job id.
 * @returns Approval chain or undefined.
 *
 * SIDE EFFECT: Reads in-memory approval chain store.
 */
export function getApprovalChain(
  jobId: string
): ApprovalChain | undefined {
  return approvalChains.find(
    (chain) =>
      chain.jobId === jobId
  );
}

/**
 * Lists approval chains.
 *
 * @returns Approval chains.
 *
 * SIDE EFFECT: Reads in-memory approval chain store.
 */
export function listApprovalChains():
  ApprovalChain[] {
  return [...approvalChains];
}

/**
 * Clears approval chains.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates in-memory approval chain store.
 */
export function clearApprovalChains():
  void {
  approvalChains = [];
  clearPersistedApprovalChains();
}
