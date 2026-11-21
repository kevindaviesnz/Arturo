import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

export type ReplayedJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type ReplayedJob = {
  id: string;
  status: ReplayedJobStatus;
  lastEventSequence: number;
};

export type ReplayedRuntimeState = {
  jobs: Record<string, ReplayedJob>;
  eventCount: number;
};

/**
 * Creates empty replayed runtime state.
 *
 * @returns Empty replayed runtime state.
 *
 * PURE: No side effects.
 */
export function createEmptyReplayedRuntimeState():
  ReplayedRuntimeState {
  return {
    jobs: {},
    eventCount: 0,
  };
}

/**
 * Extracts job id from runtime event payload or message.
 *
 * @param event Runtime event record.
 * @returns Job id or undefined.
 *
 * PURE: No side effects.
 */
export function getReplayJobId(
  event: RuntimeEventRecord
): string | undefined {
  const payload =
    event.payload as
      | {
          jobId?: string;
        }
      | undefined;

  if (payload?.jobId) {
    return payload.jobId;
  }

  const match =
    event.message.match(
      /Job (?:queued|started|completed|failed): ([0-9a-f-]{36})/
    );

  return match?.[1];
}

/**
 * Resolves replayed job status from runtime event type.
 *
 * @param eventType Runtime event type.
 * @returns Replayed job status or undefined.
 *
 * PURE: No side effects.
 */
export function getReplayJobStatus(
  eventType: string
): ReplayedJobStatus | undefined {
  if (eventType === "job.queued") {
    return "queued";
  }

  if (eventType === "job.started") {
    return "running";
  }

  if (eventType === "job.completed") {
    return "completed";
  }

  if (eventType === "job.failed") {
    return "failed";
  }

  return undefined;
}

/**
 * Applies one runtime event to replayed runtime state.
 *
 * @param state Current replayed runtime state.
 * @param event Runtime event record.
 * @returns Updated replayed runtime state.
 *
 * PURE: No side effects.
 */
export function applyRuntimeEventToReplayState(
  state: ReplayedRuntimeState,
  event: RuntimeEventRecord
): ReplayedRuntimeState {
  const jobId =
    getReplayJobId(event);

  const status =
    getReplayJobStatus(
      event.type
    );

  if (!jobId || !status) {
    return {
      ...state,
      eventCount:
        state.eventCount + 1,
    };
  }

  return {
    ...state,
    eventCount:
      state.eventCount + 1,
    jobs: {
      ...state.jobs,
      [jobId]: {
        id: jobId,
        status,
        lastEventSequence:
          event.sequence,
      },
    },
  };
}

/**
 * Replays runtime events into reconstructed runtime state.
 *
 * @param events Runtime event records.
 * @returns Reconstructed runtime state.
 *
 * PURE: No side effects.
 */
export function replayRuntimeEvents(
  events: RuntimeEventRecord[]
): ReplayedRuntimeState {
  return events.reduce(
    applyRuntimeEventToReplayState,
    createEmptyReplayedRuntimeState()
  );
}

export type ReplayValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Checks whether runtime event sequence numbers are contiguous.
 *
 * @param events Runtime event records.
 * @returns Validation result.
 *
 * PURE: No side effects.
 */
export function validateReplayEventSequence(
  events: RuntimeEventRecord[]
): ReplayValidationResult {
  const invalidEvent =
    events.find(
      (event, index) =>
        event.sequence !== index + 1
    );

  if (!invalidEvent) {
    return {
      valid: true,
    };
  }

  return {
    valid: false,
    error:
      `Invalid runtime event sequence at event ${invalidEvent.id}: expected ${events.indexOf(invalidEvent) + 1}, received ${invalidEvent.sequence}`,
  };
}

/**
 * Replays runtime events only when event sequence is valid.
 *
 * @param events Runtime event records.
 * @returns Reconstructed runtime state.
 *
 * PURE: No side effects.
 */
export function replayValidatedRuntimeEvents(
  events: RuntimeEventRecord[]
): ReplayedRuntimeState {
  const sequenceValidation =
    validateReplayEventSequence(
      events
    );

  if (
    !sequenceValidation.valid
  ) {
    throw new Error(
      sequenceValidation.error
    );
  }

  const metadataValidation =
    validateReplayMetadata(
      events
    );

  if (
    !metadataValidation.valid
  ) {
    throw new Error(
      metadataValidation.error
    );
  }

  return replayRuntimeEvents(
    events
  );
}

export type ReplayMetadataValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Validates runtime replay metadata integrity.
 *
 * Validation includes:
 * - Unique event ids
 * - Monotonic timestamps
 *
 * @param events Runtime event records.
 * @returns Validation result.
 *
 * PURE: No side effects.
 */
export function validateReplayMetadata(
  events: RuntimeEventRecord[]
): ReplayMetadataValidationResult {
  const ids =
    new Set<string>();

  for (
    let index = 0;
    index < events.length;
    index += 1
  ) {
    const current =
      events[index];

    if (
      ids.has(current.id)
    ) {
      return {
        valid: false,
        error:
          `Duplicate runtime event id detected: ${current.id}`,
      };
    }

    ids.add(current.id);

    const previous =
      events[index - 1];

    if (
      previous &&
      current.timestamp <
        previous.timestamp
    ) {
      return {
        valid: false,
        error:
          `Non-monotonic runtime event timestamp detected at event ${current.id}`,
      };
    }
  }

  return {
    valid: true,
  };
}