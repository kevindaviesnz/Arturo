import {
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  replayPersistedRuntimeEvents,
} from "../runtime/runtimeReplayStore";

import {
  createAndSaveReplayCheckpoint,
  loadAndVerifyReplayCheckpoint,
} from "../runtime/runtimeReplayCheckpointStore";

import {
  replayHistoricalRuntimeState,
} from "../runtime/runtimeHistoricalReplay";

/**
 * Formats a record count.
 *
 * @param label Count label.
 * @param count Count value.
 * @returns Human-readable count line.
 *
 * PURE: No side effects.
 */
export function formatReplayCount(
  label: string,
  count: number
): string {
  return `${label}: ${count}`;
}

/**
 * Formats replayed runtime state for user-facing CLI output.
 *
 * @param state Replayed runtime state.
 * @returns Human-readable replay summary.
 *
 * PURE: No side effects.
 */
export function formatReplayStateSummary(
  state: ReturnType<typeof replayPersistedRuntimeEvents>
): string {
  const jobs =
    Object.values(
      state.jobs
    );

  return [
    "Replay state",
    "",
    formatReplayCount(
      "Events",
      state.eventCount
    ),
    formatReplayCount(
      "Tasks observed",
      jobs.length
    ),
    "",
    ...(
      jobs.length
        ? [
            "Tasks:",
            ...jobs.map(
              (job) =>
                `- ${job.id} ${job.status} seq=${job.lastEventSequence}`
            ),
          ]
        : [
            "Tasks: none reconstructed",
          ]
    ),
  ].join("\n");
}

/**
 * Formats historical replay state for user-facing CLI output.
 *
 * @param state Historical runtime state.
 * @returns Human-readable historical replay summary.
 *
 * PURE: No side effects.
 */
export function formatReplayHistorySummary(
  state: ReturnType<typeof replayHistoricalRuntimeState>
): string {
  const jobs =
    Object.values(
      state.jobs
    );

  const workflows =
    Object.values(
      state.workflows
    );

  const approvals =
    Object.values(
      state.approvals
    );

  const notifications =
    Object.values(
      state.notifications
    );

  return [
    "Replay history",
    "",
    formatReplayCount(
      "Events",
      state.eventCount
    ),
    formatReplayCount(
      "Tasks observed",
      jobs.length
    ),
    formatReplayCount(
      "Workflows observed",
      workflows.length
    ),
    formatReplayCount(
      "Approvals observed",
      approvals.length
    ),
    formatReplayCount(
      "Notifications observed",
      notifications.length
    ),
    "",
    ...(
      jobs.length
        ? [
            "Tasks:",
            ...jobs.map(
              (job) =>
                `- ${job.id} ${job.status} seq=${job.lastEventSequence}`
            ),
            "",
          ]
        : [
            "Tasks: none reconstructed",
            "",
          ]
    ),
    ...(
      workflows.length
        ? [
            "Workflows:",
            ...workflows.map(
              (workflow) =>
                `- ${workflow.id} ${workflow.status} seq=${workflow.lastEventSequence}`
            ),
          ]
        : [
            "Workflows: none reconstructed",
          ]
    ),
  ].join("\n");
}

/**
 * Formats replay checkpoint output for user-facing CLI output.
 *
 * @param checkpoint Replay checkpoint.
 * @returns Human-readable checkpoint summary.
 *
 * PURE: No side effects.
 */
export function formatReplayCheckpointSummary(
  checkpoint: {
    readonly eventCount: number;
    readonly stateHash: string;
    readonly createdAt: number;
  }
): string {
  return [
    "Replay checkpoint created",
    "",
    `Events: ${checkpoint.eventCount}`,
    `State hash: ${checkpoint.stateHash}`,
    `Created at: ${new Date(checkpoint.createdAt).toISOString()}`,
  ].join("\n");
}

/**
 * Formats replay checkpoint verification output.
 *
 * @param result Verification result.
 * @returns Human-readable verification summary.
 *
 * PURE: No side effects.
 */
export function formatReplayCheckpointVerification(
  result: {
    readonly valid: boolean;
    readonly error?: string;
  }
): string {
  if (result.valid) {
    return [
      "Replay checkpoint verification",
      "",
      "Valid: true",
    ].join("\n");
  }

  return [
    "Replay checkpoint verification",
    "",
    "Valid: false",
    `Error: ${result.error ?? "Unknown error"}`,
  ].join("\n");
}

/**
 * Handles the /replay-events command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads runtime event store.
 * - Writes CLI output.
 */
export function handleReplayEventsCommand(): void {
  console.log(
    JSON.stringify(
      listRuntimeEventStore(),
      null,
      2
    )
  );
}

/**
 * Handles the /replay-state command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Replays persisted runtime events.
 * - Writes CLI output.
 */
export function handleReplayStateCommand(): void {
  console.log(
    formatReplayStateSummary(
      replayPersistedRuntimeEvents()
    )
  );
}

/**
 * Handles the /replay-checkpoint command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates and saves a replay checkpoint.
 * - Writes CLI output.
 */
export function handleReplayCheckpointCommand(): void {
  const checkpoint =
    createAndSaveReplayCheckpoint(
      Date.now()
    );

  console.log(
    formatReplayCheckpointSummary(
      checkpoint
    )
  );
}

/**
 * Handles the /replay-verify-checkpoint command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Loads and verifies replay checkpoint.
 * - Writes CLI output.
 */
export function handleReplayVerifyCheckpointCommand(): void {
  console.log(
    formatReplayCheckpointVerification(
      loadAndVerifyReplayCheckpoint()
    )
  );
}

/**
 * Handles the /replay-history command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Replays historical runtime state.
 * - Writes CLI output.
 */
export function handleReplayHistoryCommand(): void {
  console.log(
    formatReplayHistorySummary(
      replayHistoricalRuntimeState()
    )
  );
}
