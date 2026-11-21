import {
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  replayValidatedRuntimeEvents,
} from "./runtimeReplay";

import {
  reconstructHistoricalRuntimeState,
} from "./runtimeHistoricalReconstruction";

import {
  loadAndVerifyReplayCheckpoint,
} from "./runtimeReplayCheckpointStore";

import {
  verifyReplayState,
} from "./runtimeReplayVerification";

import type {
  HistoricalRuntimeState,
} from "./runtimeHistoricalReconstruction";

/** Projects the richer historical state into the independently rebuilt job replay shape. */
export function projectHistoricalJobReplay(
  state: HistoricalRuntimeState
) {
  return {
    eventCount: state.eventCount,
    jobs: Object.fromEntries(
      Object.entries(state.jobs).map(
        ([id, job]) => [
          id,
          {
            id: job.id,
            status:
              job.status === "started"
                ? "running"
                : job.status,
            lastEventSequence:
              job.lastEventSequence,
          },
        ]
      )
    ),
  };
}

import {
  createRuntimeReplayAuditReport,
  type RuntimeReplayAuditReport,
} from "./runtimeReplayAuditReport";

import {
  createSignedRuntimeReplayAttestation,
} from "./runtimeReplayAttestationStore";

import {
  verifyRuntimeReplayAttestationSignature,
} from "./runtimeReplayAttestation";

import {
  getRequiredRuntimeSecret,
} from "./runtimeSecrets";

/**
 * Gets the runtime replay attestation signing secret.
 *
 * @returns Runtime replay attestation signing secret.
 *
 * SIDE EFFECT:
 * - Reads process.env.
 */
export function getRuntimeReplayAttestationSecret():
  string {
  return getRequiredRuntimeSecret(
    process.env,
    "RUNTIME_REPLAY_ATTESTATION_SECRET"
  );
}

/**
 * Creates replay audit report from persisted runtime state.
 *
 * @param generatedAt Report generation timestamp.
 * @returns Runtime replay audit report.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Reads persisted replay checkpoint.
 * - Reads runtime replay attestation signing configuration.
 */
export function createPersistedRuntimeReplayAuditReport(
  generatedAt: number
): RuntimeReplayAuditReport {
  const secret =
    getRuntimeReplayAttestationSecret();

  const log =
    loadRuntimeEventLog();

  const replayState =
    replayValidatedRuntimeEvents(
      log.events
    );

  const historicalState =
    reconstructHistoricalRuntimeState(
      log.events
    );

  const replayAttestation =
    createSignedRuntimeReplayAttestation(
      secret,
      generatedAt
    );

  const replayAttestationVerified =
    verifyRuntimeReplayAttestationSignature(
      {
        replayHash:
          replayAttestation.replayHash,
        eventCount:
          replayAttestation.eventCount,
        generatedAt:
          replayAttestation.generatedAt,
      },
      secret,
      replayAttestation.signature
    );

  const report =
    createRuntimeReplayAuditReport(
      log.events,
      replayState,
      historicalState,
      verifyReplayState(
        replayState,
        projectHistoricalJobReplay(
          historicalState
        )
      ),
      loadAndVerifyReplayCheckpoint(),
      generatedAt
    );

  return {
    ...report,
    replayAttestationVerified,
    replayAttestationSignature:
      replayAttestation.signature,
    anomalies:
      replayAttestationVerified
        ? report.anomalies
        : [
            ...report.anomalies,
            "Replay attestation signature verification failed",
          ],
  };
}
