import type {
  CapabilityAttestation,
} from "./capabilityAttestation";

let attestations:
  CapabilityAttestation[] = [];

/**
 * Stores capability attestation.
 *
 * @param attestation Attestation to store.
 * @returns Stored attestation.
 *
 * SIDE EFFECT: Mutates in-memory attestation store.
 */
export function addCapabilityAttestation(
  attestation: CapabilityAttestation
): CapabilityAttestation {
  attestations = [
    ...attestations,
    attestation,
  ];

  return attestation;
}

/**
 * Lists capability attestations.
 *
 * @returns Immutable attestation list.
 *
 * SIDE EFFECT: Reads in-memory attestation store.
 */
export function listCapabilityAttestations():
  CapabilityAttestation[] {
  return [...attestations];
}

/**
 * Clears all capability attestations.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates in-memory attestation store.
 */
export function clearCapabilityAttestations():
  void {
  attestations = [];
}