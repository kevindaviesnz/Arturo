import {
  stableSerializeReplayState,
} from "./runtimeReplayVerification";

export type ReplayStateDiff = {
  identical: boolean;
  differences: string[];
};

/**
 * Gets all unique keys from two records.
 *
 * @param left First record.
 * @param right Second record.
 * @returns Sorted unique keys.
 *
 * PURE: No side effects.
 */
export function getUniqueSortedKeys(
  left: Record<string, unknown>,
  right: Record<string, unknown>
): string[] {
  return [
    ...new Set([
      ...Object.keys(left),
      ...Object.keys(right),
    ]),
  ].sort();
}

/**
 * Checks whether two values are deterministically equal.
 *
 * @param left First value.
 * @param right Second value.
 * @returns True when values serialize identically.
 *
 * PURE: No side effects.
 */
export function replayValuesEqual(
  left: unknown,
  right: unknown
): boolean {
  return (
    stableSerializeReplayState(left) ===
    stableSerializeReplayState(right)
  );
}

/**
 * Creates field difference messages for two records.
 *
 * @param label Record label.
 * @param left First record.
 * @param right Second record.
 * @returns Difference messages.
 *
 * PURE: No side effects.
 */
export function diffRecordFields(
  label: string,
  left: Record<string, unknown>,
  right: Record<string, unknown>
): string[] {
  return getUniqueSortedKeys(
    left,
    right
  ).flatMap((key) => {
    const leftHas =
      Object.prototype.hasOwnProperty.call(
        left,
        key
      );

    const rightHas =
      Object.prototype.hasOwnProperty.call(
        right,
        key
      );

    if (!leftHas) {
      return [
        `${label}.${key} missing from expected state`,
      ];
    }

    if (!rightHas) {
      return [
        `${label}.${key} missing from actual state`,
      ];
    }

    if (
      replayValuesEqual(
        left[key],
        right[key]
      )
    ) {
      return [];
    }

    return [
      `${label}.${key} differs`,
    ];
  });
}

/**
 * Diffs two replay states.
 *
 * @param expected Expected replay state.
 * @param actual Actual replay state.
 * @returns Replay state diff.
 *
 * PURE: No side effects.
 */
export function diffReplayStates(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>
): ReplayStateDiff {
  const differences =
    diffRecordFields(
      "state",
      expected,
      actual
    );

  return {
    identical:
      differences.length === 0,
    differences,
  };
}