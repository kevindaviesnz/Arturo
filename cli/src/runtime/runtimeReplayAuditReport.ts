import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import type {
  ReplayedRuntimeState,
} from "./runtimeReplay";

import type {
  HistoricalRuntimeState,
} from "./runtimeHistoricalReconstruction";

import type {
  ReplayVerificationResult,
} from "./runtimeReplayVerification";

import type {
  ReplayCheckpointVerification,
} from "./runtimeReplayCheckpoint";

export type RuntimeReplayAuditReport = {
  generatedAt: number;
  eventCount: number;
  replayVerified: boolean;
  checkpointVerified: boolean;
  replayAttestationVerified?: boolean;
  replayAttestationSignature?: string;
  jobCount: number;
  approvalCount: number;
  workflowCount: number;
  notificationCount: number;
  anomalies: string[];
};

/**
 * Converts failed verification result into anomaly message.
 *
 * @param label Verification label.
 * @param verification Verification result.
 * @returns Anomaly message or undefined.
 *
 * PURE: No side effects.
 */
export function createVerificationAnomaly(
  label: string,
  verification:
    | ReplayVerificationResult
    | ReplayCheckpointVerification
): string | undefined {
  if (verification.valid) {
    return undefined;
  }

  return `${label}: ${verification.error}`;
}

/**
 * Removes undefined values from anomaly list.
 *
 * @param values Possible anomaly values.
 * @returns Defined anomaly strings.
 *
 * PURE: No side effects.
 */
export function compactAnomalies(
  values: Array<string | undefined>
): string[] {
  return values.filter(
    (value): value is string =>
      value !== undefined
  );
}

/**
 * Creates deterministic runtime replay audit report.
 *
 * @param events Runtime events used for replay.
 * @param replayState Replayed runtime state.
 * @param historicalState Historical reconstructed runtime state.
 * @param replayVerification Replay state verification result.
 * @param checkpointVerification Replay checkpoint verification result.
 * @param generatedAt Report generation timestamp.
 * @returns Runtime replay audit report.
 *
 * PURE: No side effects.
 */
export function createRuntimeReplayAuditReport(
  events: RuntimeEventRecord[],
  replayState: ReplayedRuntimeState,
  historicalState: HistoricalRuntimeState,
  replayVerification: ReplayVerificationResult,
  checkpointVerification: ReplayCheckpointVerification,
  generatedAt: number
): RuntimeReplayAuditReport {
  return {
    generatedAt,
    eventCount:
      events.length,
    replayVerified:
      replayVerification.valid,
    checkpointVerified:
      checkpointVerification.valid,
    jobCount:
      Object.keys(
        replayState.jobs
      ).length,
    approvalCount:
      Object.keys(
        historicalState.approvals
      ).length,
    workflowCount:
      Object.keys(
        historicalState.workflows
      ).length,
    notificationCount:
      Object.keys(
        historicalState.notifications
      ).length,
    anomalies:
      compactAnomalies([
        createVerificationAnomaly(
          "Replay verification",
          replayVerification
        ),
        createVerificationAnomaly(
          "Checkpoint verification",
          checkpointVerification
        ),
      ]),
  };
}