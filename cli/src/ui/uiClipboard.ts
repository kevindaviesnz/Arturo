import {
  spawnSync,
} from "child_process";

/**
 * Purpose: Normalizes clipboard text for single input-box insertion.
 *
 * Params:
 * - value: Raw clipboard text.
 *
 * Returns:
 * - Normalized clipboard text.
 *
 * PURE: No side effects.
 */
export function sanitizeClipboardText(
  value: string
): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trimEnd();
}

/**
 * Purpose: Reads text from the macOS clipboard.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Clipboard text, or an empty string when unavailable.
 *
 * SIDE EFFECT:
 * - Executes pbpaste.
 * - Reads operating-system clipboard.
 */
export function readClipboardText(): string {
  const result =
    spawnSync(
      "pbpaste",
      [],
      {
        encoding: "utf8",
      }
    );

  if (
    result.error ||
    result.status !== 0
  ) {
    return "";
  }

  return sanitizeClipboardText(
    result.stdout ?? ""
  );
}
