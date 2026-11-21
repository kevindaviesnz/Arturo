import { authenticatedUserId } from "../identity/authenticatedContext";
import {
  addApprovalDecision,
  countApprovals,
  createApprovalChain,
  getApprovalChain,
  storeApprovalChain,
  type ApprovalChain,
  type ApprovalDecisionKind,
} from "./approvalChainStore";

import {
  createSignedApprovalDecision,
} from "./approvalDecisionSigning";

import {
  withRequirementsSignature,
} from "./approvalRequirementsSigning";

import type {
  ApprovalPolicy,
} from "./approvalPolicy";

import {
  getLocalApprovalSigningSecret,
} from "./runtimeSecrets";

/**
 * Gets the approval signing secret at decision-signing time.
 *
 * @returns Approval signing secret.
 *
 * SIDE EFFECT: Reads process.env.
 */
export function getRuntimeApprovalSigningSecret(): string {
  return getLocalApprovalSigningSecret();
}

/**
 * Creates and stores an approval chain for a job.
 *
 * @param jobId Job id.
 * @param requiredApprovals Required approval count.
 * @param policy Optional approval policy.
 * @returns Stored approval chain.
 *
 * SIDE EFFECT: Mutates approval chain store.
 */
export function createJobApprovalChain(
  jobId: string,
  requiredApprovals: number,
  policy?: ApprovalPolicy,
  governancePolicyId?: string
): ApprovalChain {
  return storeApprovalChain(
    withRequirementsSignature(
      createApprovalChain(
        jobId,
        requiredApprovals,
        policy,
        governancePolicyId
      ),
      getRuntimeApprovalSigningSecret()
    )
  );
}

/**
 * Says why a chain must not release its work yet, or undefined if it may.
 *
 * `approveJobInChain` records a decision; it does not decide that the work may
 * run. Those are different questions and the callers were conflating them: both
 * `/approve` and the review link took "the decision was recorded" as "the work
 * is approved", and released it. A chain already rejected by someone else came
 * back from the store unchanged — correctly, the store refuses to add to a
 * settled chain — and the caller queued the Task anyway, recorded the Artefact
 * decision as approved, completed the run step, queued the next Workflow step
 * and announced "The work will run now" directly under "Approval status:
 * rejected". A chain still short of its required approvals released on the
 * first one.
 *
 * The executor does fail closed on a rejected chain, so the Task itself errored
 * rather than running. That is the last line of defence, not the only one, and
 * nothing downstream of it was protected.
 *
 * Both decision surfaces call this before any release effect, so the answer
 * cannot differ between them.
 *
 * PURE: No side effects.
 */
export function refuseApprovalRelease(
  chain: ApprovalChain
): string | undefined {
  if (chain.status === "approved") return undefined;

  if (chain.status === "rejected") {
    return `Task ${chain.jobId} has already been rejected. That decision stands and the work will not run.`;
  }

  const outstanding = Math.max(
    1,
    chain.requiredApprovals
  ) - countApprovals(chain);

  // A policy-governed chain counts named approvers rather than a bare total, so
  // a subtraction would be a guess. Say what is true either way: not yet.
  if (chain.policy || outstanding < 1) {
    return `Task ${chain.jobId} is not fully approved yet. The decision is recorded; the work stays held until the approval policy is satisfied.`;
  }

  return `Task ${chain.jobId} still needs ${outstanding} more approval${
    outstanding === 1 ? "" : "s"
  }. The decision is recorded; the work stays held until then.`;
}

/**
 * Approves a job approval chain.
 *
 * @param jobId Job id.
 * @param worker Approving worker.
 * @param timestamp Decision timestamp.
 * @returns Updated approval chain.
 *
 * SIDE EFFECT:
 * - Reads approval signing secret from process.env.
 * - Mutates approval chain store.
 */
export function approveJobInChain(
  jobId: string,
  worker: string,
  timestamp = Date.now(),
  kind?: ApprovalDecisionKind
): ApprovalChain {
  const chain =
    getApprovalChain(
      jobId
    );

  if (!chain) {
    throw new Error(
      `Approval chain not found: ${jobId}`
    );
  }

  return storeApprovalChain(
    addApprovalDecision(
      chain,
      createSignedApprovalDecision(
        {
          worker,
          ...(authenticatedUserId() ? { userId: authenticatedUserId() } : {}),
          ...(kind ? { kind } : {}),
          decision: "approved",
          timestamp,
        },
        jobId,
        getRuntimeApprovalSigningSecret()
      )
    )
  );
}

/**
 * Rejects a job approval chain.
 *
 * @param jobId Job id.
 * @param worker Rejecting worker.
 * @param reason Rejection reason.
 * @param timestamp Decision timestamp.
 * @returns Updated approval chain.
 *
 * SIDE EFFECT:
 * - Reads approval signing secret from process.env.
 * - Mutates approval chain store.
 */
export function rejectJobInChain(
  jobId: string,
  worker: string,
  reason: string,
  timestamp = Date.now(),
  kind?: ApprovalDecisionKind
): ApprovalChain {
  const chain =
    getApprovalChain(
      jobId
    );

  if (!chain) {
    throw new Error(
      `Approval chain not found: ${jobId}`
    );
  }

  return storeApprovalChain(
    addApprovalDecision(
      chain,
      createSignedApprovalDecision(
        {
          worker,
          ...(authenticatedUserId() ? { userId: authenticatedUserId() } : {}),
          ...(kind ? { kind } : {}),
          decision: "rejected",
          reason,
          timestamp,
        },
        jobId,
        getRuntimeApprovalSigningSecret()
      )
    )
  );
}

/**
 * Gets approval chain status.
 *
 * @param jobId Job id.
 * @returns Approval status or undefined.
 *
 * SIDE EFFECT: Reads approval chain store.
 */
export function getApprovalStatus(
  jobId: string
):
  | ApprovalChain["status"]
  | undefined {
  return getApprovalChain(
    jobId
  )?.status;
}
