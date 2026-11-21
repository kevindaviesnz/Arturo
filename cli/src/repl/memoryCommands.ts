import type {
  OperationalMemoryEntry,
} from "../memory/operationalMemory";

import {
  addOperationalMemory,
  listAllOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Purpose: Creates usage text for /memory.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Memory command usage text.
 *
 * PURE: No side effects.
 */
export function createMemoryUsageText(): string {
  return [
    "Usage:",
    "  /memory",
    '  /memory add "<entry>" --scope "<enterprise-or-function|global>"',
    "  /memory remove <memory-id>",
  ].join("\n");
}

/**
 * Purpose: Formats Operational Memory entries for Chapter 8 output.
 *
 * Params:
 * - entries: Operational Memory entries.
 *
 * Returns:
 * - Human-readable Operational Memory output.
 *
 * PURE: No side effects.
 */
export function formatOperationalMemory(
  entries: readonly OperationalMemoryEntry[]
): string {
  if (entries.length === 0) {
    return [
      "Operational Memory",
      "",
      "No operational memory.",
    ].join("\n");
  }

  return [
    "Operational Memory",
    "",
    entries
      .map(
        (entry) =>
          entry.content
      )
      .join("\n\n"),
  ].join("\n");
}

/**
 * Purpose: Formats successful Operational Memory addition output.
 *
 * Params:
 * - entry: Added Operational Memory entry.
 *
 * Returns:
 * - Human-readable success output.
 *
 * PURE: No side effects.
 */
export function formatOperationalMemoryAdded(
  entry: OperationalMemoryEntry
): string {
  return [
    "✓ Operational Memory added",
    "",
    entry.content,
  ].join("\n");
}

/**
 * Purpose: Handles /memory add.
 *
 * Params:
 * - args: Memory add command args.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Adds and persists Operational Memory.
 * - Writes CLI output.
 */
export function handleMemoryAddCommand(
  args: readonly string[]
): void {
  const content =
    args
      .join(" ")
      .trim();

  if (content.length === 0) {
    console.log(
      'Usage: /memory add "<entry>"'
    );

    return;
  }

  const entry =
    addOperationalMemory({
      content,
      source:
        "manual",
    });

  broadcastEvent(
  "memory.entry.added",
  "success",
  `Memory added: ${entry.content}`
  );
  
  console.log(
    formatOperationalMemoryAdded(
      entry
    )
  );
}

/**
 * Purpose: Handles the /memory command.
 *
 * Params:
 * - args: Memory command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - May read learned Operational Memory.
 * - May add Operational Memory.
 * - Writes CLI output.
 */
export function handleMemoryCommand(
  args: readonly string[] = []
): void {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "add") {
    handleMemoryAddCommand(
      subcommandArgs
    );

    return;
  }

  if (subcommand) {
    console.log(
      createMemoryUsageText()
    );

    return;
  }

  const entries =
    listAllOperationalMemory();

  console.log(
    formatOperationalMemory(
      entries
    )
  );
}
