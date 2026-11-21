import type {
  OperationalMemoryEntry,
} from "../memory/operationalMemory";

import {
  runtimeDb,
} from "./runtimeDatabase";

/**
 * Purpose: Converts an Operational Memory entry into a SQLite-safe row.
 *
 * Params:
 * - entry: Operational Memory entry.
 *
 * Returns:
 * - SQLite row.
 *
 * PURE: No side effects.
 */
export function toOperationalMemoryRow(
  entry: OperationalMemoryEntry
) {
  return {
    id:
      entry.id,
    scopeId:
      entry.scopeId,
    content:
      entry.content,
    source:
      entry.source ?? null,
    createdAt:
      entry.createdAt,
    updatedAt:
      entry.updatedAt,
  };
}

/**
 * Purpose: Converts a SQLite row into an Operational Memory entry.
 *
 * Params:
 * - row: SQLite row.
 *
 * Returns:
 * - Operational Memory entry.
 *
 * PURE: No side effects.
 */
export function fromOperationalMemoryRow(
  row: any
): OperationalMemoryEntry {
  return {
    id:
      row.id,
    scopeId:
      row.scopeId,
    content:
      row.content,
    source:
      row.source ?? undefined,
    createdAt:
      row.createdAt,
    updatedAt:
      row.updatedAt,
  };
}

/**
 * Purpose: Saves an Operational Memory entry.
 *
 * Params:
 * - entry: Operational Memory entry.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Writes Operational Memory to SQLite.
 */
export function saveOperationalMemoryEntry(
  entry: OperationalMemoryEntry
): void {
  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO operational_memory (
        id,
        scope_id,
        content,
        source,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @scopeId,
        @content,
        @source,
        @createdAt,
        @updatedAt
      )
    `)
    .run(
      toOperationalMemoryRow(
        entry
      )
    );
}

/**
 * Purpose: Loads all persisted Operational Memory entries.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Operational Memory entries.
 *
 * SIDE EFFECT:
 * - Reads Operational Memory from SQLite.
 */
export function loadOperationalMemoryEntries(): readonly OperationalMemoryEntry[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          scope_id as scopeId,
          content,
          source,
          created_at as createdAt,
          updated_at as updatedAt
        FROM operational_memory
        ORDER BY created_at ASC
      `)
      .all();

  return rows.map(
    fromOperationalMemoryRow
  );
}

/**
 * Purpose: Clears persisted Operational Memory entries.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Deletes Operational Memory rows from SQLite.
 */
export function clearPersistedOperationalMemory(): void {
  runtimeDb
    .prepare(
      "DELETE FROM operational_memory"
    )
    .run();
}

/** Deletes one persisted Operational Memory entry. */
export function deletePersistedOperationalMemoryEntry(id: string): void {
  runtimeDb.prepare("DELETE FROM operational_memory WHERE id = ?").run(id);
}
