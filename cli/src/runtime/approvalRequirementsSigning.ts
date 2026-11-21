import crypto from "crypto";

import type {
  ApprovalPolicy,
} from "./approvalPolicy";

import type {
  ApprovalChain,
} from "./approvalChainStore";

/**
 * Produces a canonical, order-stable representation of an approval policy so the
 * requirements signature is deterministic regardless of object key or
 * required-worker ordering.
 *
 * PURE: No side effects.
 */
function normalizeApprovalPolicy(
  policy: ApprovalPolicy | undefined
): unknown {
  if (!policy) {
    return null;
  }

  if (policy.type === "unanimous") {
    return {
      type: "unanimous",
      requiredWorkers: [
        ...policy.requiredWorkers,
      ].sort(),
    };
  }

  return {
    type: policy.type,
    requiredApprovals: policy.requiredApprovals,
  };
}

/**
 * Builds the deterministic payload that binds a chain's approval *requirements*
 * (how many approvals, which policy, which governing rule) to its job.
 *
 * The per-decision signatures prove who approved; this payload prevents an
 * attacker from lowering the bar (e.g. requiredApprovals 3 -> 1) on a chain that
 * already holds a genuine approval.
 *
 * PURE: No side effects.
 */
export function createApprovalRequirementsPayload(
  jobId: string,
  requiredApprovals: number,
  policy: ApprovalPolicy | undefined,
  governancePolicyId: string | undefined
): string {
  return JSON.stringify({
    jobId,
    requiredApprovals,
    policy:
      normalizeApprovalPolicy(
        policy
      ),
    governancePolicyId:
      governancePolicyId ??
      null,
  });
}

/**
 * Signs a chain's approval requirements.
 *
 * PURE: No side effects.
 */
export function signApprovalRequirements(
  jobId: string,
  requiredApprovals: number,
  policy: ApprovalPolicy | undefined,
  governancePolicyId: string | undefined,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      createApprovalRequirementsPayload(
        jobId,
        requiredApprovals,
        policy,
        governancePolicyId
      )
    )
    .digest(
      "hex"
    );
}

/**
 * Returns a copy of the chain with a valid requirements signature attached.
 *
 * PURE: No side effects (returns a new object).
 */
export function withRequirementsSignature(
  chain: ApprovalChain,
  secret: string
): ApprovalChain {
  return {
    ...chain,
    requirementsSignature:
      signApprovalRequirements(
        chain.jobId,
        chain.requiredApprovals,
        chain.policy,
        chain.governancePolicyId,
        secret
      ),
  };
}

/**
 * Verifies that a chain's stored requirements match its signature. Returns false
 * when the signature is absent or does not match, so callers can fail closed.
 *
 * PURE: No side effects.
 */
export function verifyApprovalRequirementsSignature(
  chain: ApprovalChain,
  secret: string
): boolean {
  if (
    typeof chain.requirementsSignature !==
    "string"
  ) {
    return false;
  }

  const expected =
    signApprovalRequirements(
      chain.jobId,
      chain.requiredApprovals,
      chain.policy,
      chain.governancePolicyId,
      secret
    );

  const expectedBuffer =
    Buffer.from(
      expected
    );

  const actualBuffer =
    Buffer.from(
      chain.requirementsSignature
    );

  if (
    expectedBuffer.length !==
    actualBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    actualBuffer
  );
}
