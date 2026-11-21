import crypto from "crypto";

import type {
  ApprovalDecision,
} from "./approvalChainStore";

export type SignedApprovalDecision =
  ApprovalDecision & {
    signature: string;
  };

/**
 * Creates deterministic approval decision signing payload.
 *
 * The payload binds the decision to the specific job it authorizes so a
 * legitimately signed decision cannot be transplanted onto a different job's
 * approval chain.
 *
 * @param decision Approval decision.
 * @param jobId Job the decision authorizes.
 * @returns Stable serialized payload.
 *
 * PURE: No side effects.
 */
export function createApprovalDecisionPayload(
  decision: ApprovalDecision,
  jobId: string
): string {
  return JSON.stringify({
    jobId,
    ...(decision.userId !== undefined ? { userId: decision.userId } : {}),
    // Signed, so a go-ahead cannot later be relabelled a sign-off. Left out
    // when absent so decisions signed before it existed still verify.
    ...(decision.kind !== undefined ? { kind: decision.kind } : {}),
    worker:
      decision.worker,
    decision:
      decision.decision,
    reason:
      decision.reason ??
      null,
    timestamp:
      decision.timestamp,
  });
}

/**
 * Signs approval decision payload.
 *
 * @param decision Approval decision.
 * @param jobId Job the decision authorizes.
 * @param secret Secret signing key.
 * @returns Hex signature.
 *
 * PURE: No side effects.
 */
export function signApprovalDecision(
  decision: ApprovalDecision,
  jobId: string,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      createApprovalDecisionPayload(
        decision,
        jobId
      )
    )
    .digest(
      "hex"
    );
}

/**
 * Attaches signature to approval decision.
 *
 * @param decision Approval decision.
 * @param jobId Job the decision authorizes.
 * @param secret Secret signing key.
 * @returns Signed approval decision.
 *
 * PURE: No side effects.
 */
export function createSignedApprovalDecision(
  decision: ApprovalDecision,
  jobId: string,
  secret: string
): SignedApprovalDecision {
  return {
    ...decision,
    signature:
      signApprovalDecision(
        decision,
        jobId,
        secret
      ),
  };
}

/**
 * Verifies approval decision signature integrity.
 *
 * @param signed Signed approval decision.
 * @param jobId Job the decision must be bound to (the authoritative job id
 * taken from the approval chain, not from the decision itself).
 * @param secret Secret signing key.
 * @returns True when signature is valid.
 *
 * PURE: No side effects.
 */
export function verifyApprovalDecisionSignature(
  signed: SignedApprovalDecision,
  jobId: string,
  secret: string
): boolean {
  const expected =
    signApprovalDecision(
      signed,
      jobId,
      secret
    );

  const expectedBuffer =
    Buffer.from(
      expected
    );

  const actualBuffer =
    Buffer.from(
      signed.signature
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