import crypto from "node:crypto";

import type {
  PolicyRule,
} from "./policyRule";

import {
  createCanonicalJson,
} from "../runtime/stableSerialization";

export type SignedPolicyRule = PolicyRule & {
  readonly integritySignature: string;
};

/**
 * Creates the canonical policy-rule payload used for integrity signing.
 *
 * Position is included because policy evaluation is order-sensitive: moving an
 * allow rule above a deny rule can change the decision without editing either
 * rule's content.
 *
 * PURE: No side effects.
 */
export function createPolicyRuleSigningPayload(
  rule: PolicyRule,
  position: number
): string {
  return createCanonicalJson({
    id:
      rule.id,
    description:
      rule.description,
    effect:
      rule.effect,
    match:
      rule.match,
    position,
    requiredApprovals:
      rule.requiredApprovals ??
      null,
    scope:
      rule.scope ??
      null,
  });
}

/**
 * Signs a policy rule and its evaluation position.
 *
 * PURE: No side effects.
 */
export function signPolicyRule(
  rule: PolicyRule,
  position: number,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      createPolicyRuleSigningPayload(
        rule,
        position
      )
    )
    .digest(
      "hex"
    );
}

/**
 * Verifies a stored policy-rule integrity signature.
 *
 * PURE: No side effects.
 */
export function verifyPolicyRuleSignature(
  rule: PolicyRule,
  position: number,
  signature: string,
  secret: string
): boolean {
  const expected =
    signPolicyRule(
      rule,
      position,
      secret
    );

  const expectedBuffer =
    Buffer.from(
      expected
    );

  const actualBuffer =
    Buffer.from(
      signature
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
