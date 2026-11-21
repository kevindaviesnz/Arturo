import fs from "fs";

import type {
  CapabilityAttestation,
} from "./capabilityAttestation";

/**
 * Serializes attestations.
 *
 * @param attestations Attestations to serialize.
 * @returns JSON string.
 *
 * PURE: No side effects.
 */
export function serializeCapabilityAttestations(
  attestations: CapabilityAttestation[]
): string {
  return JSON.stringify(
    attestations,
    null,
    2
  );
}

/**
 * Parses serialized attestations.
 *
 * @param value Serialized JSON.
 * @returns Parsed attestations.
 *
 * PURE: No side effects.
 */
export function parseCapabilityAttestations(
  value: string
): CapabilityAttestation[] {
  return JSON.parse(value);
}

/**
 * Saves attestations to disk.
 *
 * @param path Output path.
 * @param attestations Attestations to persist.
 * @returns void
 *
 * SIDE EFFECT: Writes file to disk.
 */
export function saveCapabilityAttestations(
  path: string,
  attestations: CapabilityAttestation[]
): void {
  fs.writeFileSync(
    path,
    serializeCapabilityAttestations(
      attestations
    ),
    "utf8"
  );
}

/**
 * Loads attestations from disk.
 *
 * @param path File path.
 * @returns Parsed attestations.
 *
 * SIDE EFFECT: Reads file from disk.
 */
export function loadCapabilityAttestations(
  path: string
): CapabilityAttestation[] {
  return parseCapabilityAttestations(
    fs.readFileSync(
      path,
      "utf8"
    )
  );
}