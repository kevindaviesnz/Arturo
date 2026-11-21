import crypto from "crypto";

import type {
  CapabilityAttestation,
} from "./capabilityAttestation";

import {
  createCanonicalJson,
} from "./stableSerialization";

/**
 * Signs a capability attestation.
 *
 * @param attestation Attestation to sign.
 * @param secret Signing secret.
 * @returns HMAC signature.
 *
 * PURE: No side effects.
 */
export function signCapabilityAttestation(
  attestation: CapabilityAttestation,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      createCanonicalJson(
        attestation
      )
    )
    .digest("hex");
}

/**
 * Verifies a capability attestation signature.
 *
 * @param attestation Attestation to verify.
 * @param secret Signing secret.
 * @param signature Expected signature.
 * @returns True when signature is valid.
 *
 * PURE: No side effects.
 */
export function verifyCapabilityAttestationSignature(
  attestation: CapabilityAttestation,
  secret: string,
  signature: string
): boolean {
  return (
    signCapabilityAttestation(
      attestation,
      secret
    ) === signature
  );
}

export {
  createCanonicalJson,
};