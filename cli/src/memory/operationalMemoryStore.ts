import {
  createOperationalMemoryEntry,
  type OperationalMemoryEntry,
} from "./operationalMemory";

import {
  clearPersistedOperationalMemory,
  deletePersistedOperationalMemoryEntry,
  loadOperationalMemoryEntries,
  saveOperationalMemoryEntry,
} from "../storage/operationalMemoryRepository";

const operationalMemory: Record<string, OperationalMemoryEntry> =
  Object.fromEntries(
    loadOperationalMemoryEntries()
      .filter(
        (entry) => entry.source !== "chapter-8-seed"
      )
      .map(
      (entry) => [
        entry.id,
        entry,
      ]
    )
  );

export const DEFAULT_OPERATIONAL_MEMORY_SCOPE =
  "global";

/** Returns whether provenance permits a memory entry to influence execution. */
export function isOperationalMemoryEligibleForExecution(
  entry: OperationalMemoryEntry
): boolean {
  return entry.source === "manual" ||
    entry.source?.startsWith("verified:") === true ||
    entry.source?.startsWith("human-approved:") === true;
}

/** Returns whether an eligible entry represents a verified learned lesson. */
export function isRetainedOperationalLesson(
  entry: OperationalMemoryEntry
): boolean {
  return entry.source?.startsWith("verified:") === true ||
    entry.source?.startsWith("human-approved:") === true;
}

/**
 * Purpose: Clears all Operational Memory.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates in-memory Operational Memory.
 * - Clears persisted Operational Memory.
 */
export function clearOperationalMemory(): void {
  Object.keys(
    operationalMemory
  ).forEach(
    (id) => {
      delete operationalMemory[id];
    }
  );

  clearPersistedOperationalMemory();
}

/**
 * Purpose: Lists Operational Memory entries for a scope.
 *
 * Params:
 * - scopeId: Memory scope id.
 *
 * Returns:
 * - Operational Memory entries for the scope.
 *
 * SIDE EFFECT:
 * - Reads in-memory Operational Memory.
 */
export function listOperationalMemory(
  scopeId: string = DEFAULT_OPERATIONAL_MEMORY_SCOPE
): readonly OperationalMemoryEntry[] {
  return Object.values(
    operationalMemory
  ).filter(
    (entry) =>
      entry.scopeId === scopeId
  );
}

/** Lists Operational Memory across all Business Function scopes. */
export function listAllOperationalMemory(): readonly OperationalMemoryEntry[] {
  return Object.values(operationalMemory)
    .slice()
    .sort((left, right) => left.createdAt - right.createdAt);
}

/**
 * Purpose: Saves an Operational Memory entry.
 *
 * Params:
 * - entry: Operational Memory entry.
 *
 * Returns:
 * - Saved Operational Memory entry.
 *
 * SIDE EFFECT:
 * - Mutates in-memory Operational Memory.
 * - Persists Operational Memory.
 */
export function saveOperationalMemory(
  entry: OperationalMemoryEntry
): OperationalMemoryEntry {
  operationalMemory[entry.id] =
    entry;

  saveOperationalMemoryEntry(
    entry
  );

  return entry;
}

/** Removes one Operational Memory entry from active and persisted state. */
export function removeOperationalMemory(id: string): boolean {
  if (!operationalMemory[id]) return false;
  delete operationalMemory[id];
  deletePersistedOperationalMemoryEntry(id);
  return true;
}

/**
 * Purpose: Adds an Operational Memory entry.
 *
 * Params:
 * - input: Memory creation input.
 *
 * Returns:
 * - Created Operational Memory entry.
 *
 * SIDE EFFECT:
 * - Mutates in-memory Operational Memory.
 * - Persists Operational Memory.
 */
export function addOperationalMemory(
  input: {
    readonly scopeId?: string;
    readonly content: string;
    readonly source?: string;
    readonly now?: number;
  }
): OperationalMemoryEntry {
  const entry =
    createOperationalMemoryEntry({
      id:
        crypto.randomUUID(),
      scopeId:
        input.scopeId ?? DEFAULT_OPERATIONAL_MEMORY_SCOPE,
      content:
        input.content,
      source:
        input.source,
      now:
        input.now,
    });

  return saveOperationalMemory(
    entry
  );
}

/**
 * Purpose: Reads Chapter 8 Operational Memory without fabricating examples.
 *
 * Params:
 * - scopeId: Memory scope id.
 *
 * Returns:
 * - Operational Memory entries after seeding.
 *
 * SIDE EFFECT:
 * - Reads Operational Memory.
 */
export function ensureChapterEightOperationalMemory(
  scopeId: string = DEFAULT_OPERATIONAL_MEMORY_SCOPE
): readonly OperationalMemoryEntry[] {
  return listOperationalMemory(
    scopeId
  );
}
