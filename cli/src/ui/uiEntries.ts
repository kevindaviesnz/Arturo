import {
  parseUiInput,
  WorkStreamEntry,
} from "./uiState";

/**
 * Purpose: Converts submitted UI input into a work stream entry.
 *
 * Params:
 * - value: Raw submitted user input.
 *
 * Returns:
 * - Work stream entry describing the interpreted input.
 *
 * PURE: No side effects.
 */
export function createInputEchoEntry(
  value: string
): WorkStreamEntry {
  const parsed =
    parseUiInput(
      value
    );

  if (parsed.kind === "empty") {
    return {
      actor: "Arturo",
      label: "Ignored",
      body: "No input provided.",
    };
  }

  if (parsed.kind === "ask") {
    return {
      actor: "You",
      label: "Request",
      body: parsed.request,
    };
  }

return {
  actor: "You",
  label: parsed.command,
  body:
    parsed.args.length > 0
      ? parsed.args.join(" ")
      : "",
};
}

/**
 * Purpose: Creates the UI-only Arturo response shown after user input.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining that runtime execution is not connected yet.
 *
 * PURE: No side effects.
 */
export function createUiOnlyQueuedEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Queued",
    body: "This is currently UI-only. Command execution will be connected next.",
  };
}
