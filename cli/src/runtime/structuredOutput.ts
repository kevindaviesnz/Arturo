export type StructuredWorkerResult = {
  type: string;
  payload: unknown;
};

/**
 * Checks whether a value is a structured worker result.
 *
 * @param value Value to inspect.
 * @returns True when the value matches the structured worker result shape.
 *
 * PURE: No side effects.
 */
export function isStructuredWorkerResult(
  value: unknown
): value is StructuredWorkerResult {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const record =
    value as Record<string, unknown>;

  return (
    typeof record.type === "string" &&
    "payload" in record
  );
}

/**
 * Attempts to parse model output as a structured worker result.
 *
 * @param text Raw model output text.
 * @returns Parsed structured result, or undefined if parsing/validation fails.
 *
 * PURE: No side effects.
 */
export function tryParseStructuredOutput(
  text: string
): StructuredWorkerResult | undefined {
  try {
    const parsed =
      JSON.parse(text);

    if (
      !isStructuredWorkerResult(
        parsed
      )
    ) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}