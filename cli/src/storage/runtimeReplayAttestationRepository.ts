import fs from "fs";
import path from "path";
import { writePrivateFileAtomic } from "./atomicFile";

import type {
  RuntimeReplayAttestation,
} from "../runtime/runtimeReplayAttestation";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const RUNTIME_REPLAY_ATTESTATIONS_PATH =
  path.join(
    DATA_DIR,
    "runtime-replay-attestations.json"
  );

/**
 * Ensures replay attestation data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT: Creates directory on disk when missing.
 */
export function ensureReplayAttestationDataDir():
  void {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true,
      mode: 0o700,
    }
  );
}

/**
 * Serializes replay attestations.
 *
 * @param attestations Replay attestations.
 * @returns Serialized replay attestations.
 *
 * PURE: No side effects.
 */
export function serializeRuntimeReplayAttestations(
  attestations: RuntimeReplayAttestation[]
): string {
  return JSON.stringify(
    attestations,
    null,
    2
  );
}

/**
 * Parses replay attestations.
 *
 * @param value Serialized replay attestations.
 * @returns Parsed replay attestations.
 *
 * PURE: No side effects.
 */
export function parseRuntimeReplayAttestations(
  value: string
): RuntimeReplayAttestation[] {
  const trimmed =
    value.trim();

  if (
    trimmed.length === 0
  ) {
    return [];
  }

  return JSON.parse(
    trimmed
  ) as RuntimeReplayAttestation[];
}

/**
 * Saves replay attestations to disk.
 *
 * @param attestations Replay attestations.
 * @returns Replay attestations.
 *
 * SIDE EFFECT: Writes replay attestations to disk.
 */
export function saveRuntimeReplayAttestations(
  attestations: RuntimeReplayAttestation[]
): RuntimeReplayAttestation[] {
  ensureReplayAttestationDataDir();

  writePrivateFileAtomic(
    RUNTIME_REPLAY_ATTESTATIONS_PATH,
    serializeRuntimeReplayAttestations(attestations)
  );

  return attestations;
}

/**
 * Loads replay attestations from disk.
 *
 * @returns Persisted replay attestations.
 *
 * SIDE EFFECT: Reads replay attestations from disk.
 */
export function loadRuntimeReplayAttestations():
  RuntimeReplayAttestation[] {
  if (
    !fs.existsSync(
      RUNTIME_REPLAY_ATTESTATIONS_PATH
    )
  ) {
    return [];
  }

  return parseRuntimeReplayAttestations(
    fs.readFileSync(
      RUNTIME_REPLAY_ATTESTATIONS_PATH,
      "utf8"
    )
  );
}

/**
 * Adds replay attestation to persisted store.
 *
 * @param attestation Replay attestation.
 * @returns Updated replay attestations.
 *
 * SIDE EFFECT:
 * - Reads replay attestations from disk.
 * - Writes replay attestations to disk.
 */
export function addRuntimeReplayAttestation(
  attestation: RuntimeReplayAttestation
): RuntimeReplayAttestation[] {
  return saveRuntimeReplayAttestations([
    ...loadRuntimeReplayAttestations(),
    attestation,
  ]);
}

/**
 * Clears persisted replay attestations.
 *
 * @returns void
 *
 * SIDE EFFECT: Deletes replay attestations file when present.
 */
export function clearRuntimeReplayAttestations():
  void {
  if (
    fs.existsSync(
      RUNTIME_REPLAY_ATTESTATIONS_PATH
    )
  ) {
    fs.unlinkSync(
      RUNTIME_REPLAY_ATTESTATIONS_PATH
    );
  }
}
