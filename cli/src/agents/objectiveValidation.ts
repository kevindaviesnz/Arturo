import {
  OBJECTIVE_LIFETIMES,
  OBJECTIVE_TYPES,
  type ObjectiveClassification,
  type ObjectiveLifetime,
  type ObjectiveType,
} from "./objective";

/**
 * Purpose: Checks whether a value is an allowed objective type.
 *
 * Params:
 * - value: Candidate value.
 *
 * Returns:
 * - True when value is an ObjectiveType.
 *
 * PURE: No side effects.
 */
export function isObjectiveType(
  value: unknown
): value is ObjectiveType {
  return (
    typeof value === "string" &&
    (OBJECTIVE_TYPES as readonly string[]).includes(
      value
    )
  );
}

/**
 * Purpose: Checks whether a value is an allowed objective lifetime.
 *
 * Params:
 * - value: Candidate value.
 *
 * Returns:
 * - True when value is an ObjectiveLifetime.
 *
 * PURE: No side effects.
 */
export function isObjectiveLifetime(
  value: unknown
): value is ObjectiveLifetime {
  return (
    typeof value === "string" &&
    (OBJECTIVE_LIFETIMES as readonly string[]).includes(
      value
    )
  );
}

/**
 * Purpose: Parses and validates objective classification JSON.
 *
 * Params:
 * - raw: Raw model output.
 *
 * Returns:
 * - Valid objective classification.
 *
 * PURE: Throws when JSON is invalid or schema is unsupported.
 */
export function parseObjectiveClassification(
  raw: string
): ObjectiveClassification {
  const parsed =
    JSON.parse(
      raw
    ) as Record<string, unknown>;

  if (typeof parsed.description !== "string") {
    throw new Error(
      "Invalid objective classification: description must be a string"
    );
  }

  if (!isObjectiveType(parsed.type)) {
    throw new Error(
      "Invalid objective classification: type is unsupported"
    );
  }

  if (!isObjectiveLifetime(parsed.lifetime)) {
    throw new Error(
      "Invalid objective classification: lifetime is unsupported"
    );
  }

  if (typeof parsed.businessPattern !== "string") {
    throw new Error(
      "Invalid objective classification: businessPattern must be a string"
    );
  }

  if (typeof parsed.supported !== "boolean") {
    throw new Error(
      "Invalid objective classification: supported must be a boolean"
    );
  }

  // The prompt asks for a reason only when supported is false ("When supported
  // is false, reason must be a complete sentence explaining ..."), so a model
  // that returns supported: true and omits it is doing as it was told. Requiring
  // it unconditionally made obedience a hard failure, and /ask died with
  // "Invalid objective classification: reason must be a string" before it had
  // judged anything about the request.
  if (
    parsed.reason !== undefined &&
    typeof parsed.reason !== "string"
  ) {
    throw new Error(
      "Invalid objective classification: reason must be a string"
    );
  }

  if (
    parsed.supported === false &&
    typeof parsed.reason !== "string"
  ) {
    throw new Error(
      "Invalid objective classification: an unsupported request must say why"
    );
  }

  return {
    description:
      parsed.description,
    type:
      parsed.type,
    lifetime:
      parsed.lifetime,
    businessPattern:
      parsed.businessPattern,
    supported:
      parsed.supported,
    reason:
      typeof parsed.reason === "string"
        ? parsed.reason
        : "",
  };
}