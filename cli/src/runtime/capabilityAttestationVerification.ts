import type {
  CapabilityAttestation,
} from "./capabilityAttestation";

import {
  hashValue,
} from "./capabilityAttestation";

export type CapabilityAttestationVerificationResult = {
  valid: boolean;

  errors: string[];
};

/**
 * Verifies a capability attestation.
 *
 * @param attestation Stored attestation.
 * @param task Original task input.
 * @param output Original output.
 * @returns Verification result.
 *
 * PURE: No side effects.
 */
export function verifyCapabilityAttestation(
  attestation: CapabilityAttestation,
  task: unknown,
  output?: unknown
): CapabilityAttestationVerificationResult {
  const errors: string[] = [];

  const expectedTaskHash =
    hashValue(task);

  if (
    attestation.taskHash !==
    expectedTaskHash
  ) {
    errors.push(
      "Task hash mismatch"
    );
  }

  if (
    output !== undefined
  ) {
    const expectedOutputHash =
      hashValue(output);

    if (
      attestation.outputHash !==
      expectedOutputHash
    ) {
      errors.push(
        "Output hash mismatch"
      );
    }
  }

  return {
    valid:
      errors.length === 0,
    errors,
  };
}