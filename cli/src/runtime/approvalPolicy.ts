import type {
  ApprovalDecision,
} from "./approvalChainStore";

export type ApprovalPolicy =
  | {
      type: "threshold";
      requiredApprovals: number;
    }
  | {
      type: "unanimous";
      requiredWorkers: string[];
    }
  | {
      type: "veto";
      requiredApprovals: number;
    };

export type ApprovalPolicyResult =
  | "approved"
  | "rejected"
  | "pending";

/** A verified person cannot count twice by acting through multiple Workers.
 * Historical trusted-host decisions without userId retain their Worker identity.
 */
export function uniqueApprovedDecisions(decisions: readonly ApprovalDecision[]): ApprovalDecision[] {
  const workers = new Set<string>();
  const users = new Set<string>();
  return decisions.filter(decision => {
    if (decision.decision !== "approved" || workers.has(decision.worker) ||
        (decision.userId !== undefined && users.has(decision.userId))) return false;
    workers.add(decision.worker);
    if (decision.userId !== undefined) users.add(decision.userId);
    return true;
  });
}

/**
 * Counts approved decisions.
 *
 * @param decisions Approval decisions to inspect.
 * @returns Number of approved decisions.
 *
 * PURE: No side effects.
 */
export function countApprovedDecisions(
  decisions: ApprovalDecision[]
): number {
  return uniqueApprovedDecisions(decisions).length;
}

/**
 * Checks whether any decision rejected.
 *
 * @param decisions Approval decisions to inspect.
 * @returns True when any decision rejected.
 *
 * PURE: No side effects.
 */
export function hasRejectedDecision(
  decisions: ApprovalDecision[]
): boolean {
  return decisions.some(
    (decision) =>
      decision.decision === "rejected"
  );
}

/**
 * Evaluates threshold approval policy.
 *
 * @param requiredApprovals Required approval count.
 * @param decisions Approval decisions.
 * @returns Approval policy result.
 *
 * PURE: No side effects.
 */
export function evaluateThresholdPolicy(
  requiredApprovals: number,
  decisions: ApprovalDecision[]
): ApprovalPolicyResult {
  if (
    countApprovedDecisions(
      decisions
    ) >= requiredApprovals
  ) {
    return "approved";
  }

  return "pending";
}

/**
 * Evaluates unanimous approval policy.
 *
 * @param requiredWorkers Workers who must approve.
 * @param decisions Approval decisions.
 * @returns Approval policy result.
 *
 * PURE: No side effects.
 */
export function evaluateUnanimousPolicy(
  requiredWorkers: string[],
  decisions: ApprovalDecision[]
): ApprovalPolicyResult {
  const approvedWorkers =
    new Set(
      uniqueApprovedDecisions(decisions)
        .map(
          (decision) =>
            decision.worker
        )
    );

  const allApproved =
    requiredWorkers.every(
      (worker) =>
        approvedWorkers.has(
          worker
        )
    );

  return allApproved
    ? "approved"
    : "pending";
}

/**
 * Evaluates approval policy.
 *
 * @param policy Approval policy.
 * @param decisions Approval decisions.
 * @returns Approval policy result.
 *
 * PURE: No side effects.
 */
export function evaluateApprovalPolicy(
  policy: ApprovalPolicy,
  decisions: ApprovalDecision[]
): ApprovalPolicyResult {
  if (
    policy.type === "veto" &&
    hasRejectedDecision(
      decisions
    )
  ) {
    return "rejected";
  }

  if (
    policy.type === "threshold" ||
    policy.type === "veto"
  ) {
    return evaluateThresholdPolicy(
      policy.requiredApprovals,
      decisions
    );
  }

  return evaluateUnanimousPolicy(
    policy.requiredWorkers,
    decisions
  );
}