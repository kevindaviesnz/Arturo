import {
  diffReplayStates,
  type ReplayStateDiff,
} from "./runtimeReplayDiff";

import {
  normalizeForStableSerialization,
  createCanonicalJson,
} from "./stableSerialization";

export type ReplayVerificationResult = {
  valid: boolean;
  error?: string;
  diff?: ReplayStateDiff;
};

/**
 * Serializes value with deterministic object key ordering.
 *
 * @param value Value to serialize.
 * @returns Stable JSON string.
 *
 * PURE: No side effects.
 */
export function stableSerializeReplayState(
  value: unknown
): string {
  return createCanonicalJson(
    value
  );
}

/**
 * Verifies that replayed runtime state matches expected state.
 *
 * @param expectedState Expected persisted or snapshot-derived state.
 * @param replayedState Replayed runtime state.
 * @returns Replay verification result with structural diff.
 *
 * PURE: No side effects.
 */
export function verifyReplayState(
  expectedState: unknown,
  replayedState: unknown
): ReplayVerificationResult {
  const expected =
    normalizeForStableSerialization(
      expectedState
    ) as Record<string, unknown>;

  const replayed =
    normalizeForStableSerialization(
      replayedState
    ) as Record<string, unknown>;

  const diff =
    diffReplayStates(
      expected,
      replayed
    );

  if (
    !diff.identical
  ) {
    return {
      valid: false,
      error:
        "Replay state mismatch",
      diff,
    };
  }

  return {
    valid: true,
    diff,
  };
}

export {
  isPlainObject,
  normalizeForStableSerialization,
} from "./stableSerialization";
