import crypto from "crypto";

import type {
  ReplayStateHash,
} from "./runtimeReplayHash";

/**
 * Runtime replay integrity attestation.
 */
export interface RuntimeReplayAttestation {
  replayHash: string;
  eventCount: number;
  generatedAt: number;
}

/**
 * Creates replay attestation from replay hash.
 *
 * @param replayHash Replay hash.
 * @param generatedAt Timestamp.
 * @returns Replay attestation.
 *
 * PURE: No side effects.
 */
export function createRuntimeReplayAttestation(
  replayHash: ReplayStateHash,
  eventCount: number,
  generatedAt: number
): RuntimeReplayAttestation {
  return {
    replayHash,
    eventCount,
    generatedAt,
  };
}

/**
 * Creates canonical JSON for signing.
 *
 * @param value Value to canonicalize.
 * @returns Stable JSON string.
 *
 * PURE: No side effects.
 */
export function createCanonicalReplayJson(
  value: unknown
): string {
  return JSON.stringify(
    value,
    Object.keys(
      value as Record<
        string,
        unknown
      >
    ).sort()
  );
}

/**
 * Signs replay attestation.
 *
 * @param attestation Replay attestation.
 * @param secret Signing secret.
 * @returns Signature.
 *
 * PURE: No side effects.
 */
export function signRuntimeReplayAttestation(
  attestation: RuntimeReplayAttestation,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      createCanonicalReplayJson(
        attestation
      )
    )
    .digest("hex");
}

/**
 * Verifies replay attestation signature.
 *
 * @param attestation Replay attestation.
 * @param secret Signing secret.
 * @param signature Signature to verify.
 * @returns True when valid.
 *
 * PURE: No side effects.
 */
export function verifyRuntimeReplayAttestationSignature(
  attestation: RuntimeReplayAttestation,
  secret: string,
  signature: string
): boolean {
  return (
    signRuntimeReplayAttestation(
      attestation,
      secret
    ) === signature
  );
}