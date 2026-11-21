import {
  addOperationalMemory,
  isOperationalMemoryEligibleForExecution,
  listAllOperationalMemory,
  removeOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  createMemoryUsageText,
  formatOperationalMemoryAdded,
} from "../repl/memoryCommands";

import type {
  WorkStreamEntry,
} from "./uiState";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";
import type { OperationalMemoryEntry } from "../memory/operationalMemory";
import { getBusinessFunctionDefinitionByRuntimeId } from "../business/businessFunctionDefinitionStore";
import { getBusinessFunctionDefinitionByIdOrLabel } from "../business/businessFunctionDefinitionStore";
import { getEnterpriseByIdOrName } from "../enterprise/enterpriseStore";

/** Formats memory with the provenance required for an accountable decision. */
export function formatOperationalMemoryWithProvenance(
  entries: readonly OperationalMemoryEntry[]
): string {
  if (!entries.length) return "Operational Memory\n\nNo operational memory.";
  return [
    "Operational Memory",
    "",
    ...entries.flatMap((entry, index) => {
      const definition = getBusinessFunctionDefinitionByRuntimeId(entry.scopeId);
      const enterprise = getEnterpriseByIdOrName(entry.scopeId);
      const evidence = entry.source === "manual"
        ? "A person typed this in. Nobody has checked it"
        : entry.source?.startsWith("runtime-outcome:")
          ? "An AI model worked this out from an earlier result — check it before relying on it"
          : "Where this came from was never recorded — check it before relying on it";
      return [
        `${index + 1}. ${entry.content}`,
        `   ID: ${entry.id}`,
        `   Scope: ${definition ? `${definition.label} (${entry.scopeId})` : enterprise ? `${enterprise.name} (${entry.scopeId})` : entry.scopeId}`,
        `   Source: ${entry.source ?? "unspecified"}`,
        `   Evidence: ${evidence}`,
        `   Given to Workers: ${isOperationalMemoryEligibleForExecution(entry) ? "Yes" : "No — held back until someone vouches for it"}`,
        `   Created: ${new Date(entry.createdAt).toISOString()}`,
        ...(index < entries.length - 1 ? [""] : []),
      ];
    }),
  ].join("\n");
}

/**
 * Purpose: Reads Operational Memory for terminal UI display.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry containing Operational Memory.
 *
 * SIDE EFFECT:
 * - Reads learned and manually curated Operational Memory.
 */
export function readOperationalMemoryEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Operational Memory",
    body: formatOperationalMemoryWithProvenance(
      listAllOperationalMemory()
    ),
  };
}

/**
 * Purpose: Creates a UI usage entry for /memory.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry containing /memory usage text.
 *
 * PURE: No side effects.
 */
export function createMemoryUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: createMemoryUsageText(),
  };
}

/**
 * Purpose: Adds Operational Memory from terminal UI arguments.
 *
 * Params:
 * - args: Memory entry text parts.
 *
 * Returns:
 * - Work stream entry describing the added memory.
 *
 * SIDE EFFECT:
 * - Adds and persists Operational Memory.
 */
export function addOperationalMemoryEntryFromArgs(
  args: readonly string[]
): WorkStreamEntry {
  const scopeIndex = args.indexOf("--scope");
  const scopeReference = scopeIndex >= 0 ? args[scopeIndex + 1]?.trim() : undefined;
  const content =
    (scopeIndex >= 0 ? args.slice(0, scopeIndex) : args)
      .join(" ")
      .trim();

  if (content.length === 0 || !scopeReference) {
    return createMemoryUsageEntry();
  }

  const enterprise = getEnterpriseByIdOrName(scopeReference);
  const definition = getBusinessFunctionDefinitionByIdOrLabel(scopeReference);
  const scopeId = scopeReference === "global"
    ? "global"
    : enterprise?.id ?? definition?.runtimeId ?? definition?.id;
  if (!scopeId) {
    return { actor: "Arturo", label: "Memory scope not found", body: `No Enterprise or Function found for scope: ${scopeReference}` };
  }

  const entry =
    addOperationalMemory({
      content,
      scopeId,
      source:
        "manual",
    });

  broadcastEvent(
  "memory.entry.added",
  "success",
  `Memory added: ${entry.id} · scope: ${entry.scopeId} · ${entry.content}`
  );
  
  return {
    actor: "Arturo",
    label: "Operational Memory added",
    body: formatOperationalMemoryAdded(
      entry
    ),
  };
}

/**
 * Purpose: Handles /memory commands for the terminal UI.
 *
 * Params:
 * - args: Memory command arguments.
 *
 * Returns:
 * - Work stream entry for memory display, add, or usage.
 *
 * SIDE EFFECT:
 * - May read or add Operational Memory.
 */
export function handleUiMemoryCommand(
  args: readonly string[]
): WorkStreamEntry {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (!subcommand) {
    return readOperationalMemoryEntry();
  }

  if (subcommand === "add") {
    return addOperationalMemoryEntryFromArgs(
      subcommandArgs
    );
  }

  if (subcommand === "remove") {
    const id = subcommandArgs[0];
    if (!id) return createMemoryUsageEntry();
    const entry = listAllOperationalMemory().find((candidate) => candidate.id === id);
    if (!entry || !removeOperationalMemory(id)) {
      return { actor: "Arturo", label: "Memory not found", body: `No Operational Memory found with ID: ${id}` };
    }
    broadcastEvent(
      "memory.entry.removed",
      "success",
      `Memory removed: ${entry.id} · scope: ${entry.scopeId} · ${entry.content}`
    );
    return { actor: "Arturo", label: "Operational Memory removed", body: `Removed memory ${id}.` };
  }

  return createMemoryUsageEntry();
}
