/**
 * Checks whether a value is a plain object.
 *
 * @param value Value to inspect.
 * @returns True when value is a non-array object.
 *
 * PURE: No side effects.
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Recursively sorts object keys for deterministic serialization.
 *
 * @param value Value to normalize.
 * @returns Value with object keys sorted recursively.
 *
 * PURE: No side effects.
 */
export function normalizeForStableSerialization(
  value: unknown
): unknown {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      normalizeForStableSerialization
    );
  }

  if (
    isPlainObject(value)
  ) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>(
        (acc, key) => ({
          ...acc,
          [key]:
            normalizeForStableSerialization(
              value[key]
            ),
        }),
        {}
      );
  }

  return value;
}

/**
 * Creates canonical JSON with deterministic recursive object key ordering.
 *
 * @param value Value to serialize.
 * @returns Stable JSON string.
 *
 * PURE: No side effects.
 */
export function createCanonicalJson(
  value: unknown
): string {
  return JSON.stringify(
    normalizeForStableSerialization(
      value
    )
  );
}