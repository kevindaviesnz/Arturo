import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  addRuntimeReplayAttestation,
} from "../storage/runtimeReplayAttestationRepository";

import {
  replayValidatedRuntimeEvents,
} from "./runtimeReplay";

import {
  hashReplayState,
} from "./runtimeReplayHash";

import {
  createRuntimeReplayAttestation,
  signRuntimeReplayAttestation,
  type RuntimeReplayAttestation,
} from "./runtimeReplayAttestation";

export type SignedRuntimeReplayAttestation =
  RuntimeReplayAttestation & {
    signature: string;
  };

/**
 * Creates signed runtime replay attestation.
 *
 * @param secret Signing secret.
 * @param generatedAt Attestation timestamp.
 * @returns Signed runtime replay attestation.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 */
export function createSignedRuntimeReplayAttestation(
  secret: string,
  generatedAt: number
): SignedRuntimeReplayAttestation {
  const log =
    loadRuntimeEventLog();

  const replayState =
    replayValidatedRuntimeEvents(
      log.events
    );

  const attestation =
    createRuntimeReplayAttestation(
      hashReplayState(
        replayState
      ),
      log.events.length,
      generatedAt
    );

  return {
    ...attestation,
    signature:
      signRuntimeReplayAttestation(
        attestation,
        secret
      ),
  };
}

/**
 * Creates and persists signed runtime replay attestation.
 *
 * @param secret Signing secret.
 * @param generatedAt Attestation timestamp.
 * @returns Signed runtime replay attestation.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Writes replay attestation to disk.
 */
export function createAndSaveRuntimeReplayAttestation(
  secret: string,
  generatedAt: number
): SignedRuntimeReplayAttestation {
  const attestation =
    createSignedRuntimeReplayAttestation(
      secret,
      generatedAt
    );

  addRuntimeReplayAttestation(
    attestation
  );

  return attestation;
}