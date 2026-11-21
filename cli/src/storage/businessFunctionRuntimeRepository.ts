import type {
  BusinessFunctionRuntime,
  BusinessFunctionRuntimeState,
} from "../business/businessFunctionRuntime";

import {
  runtimeDb,
} from "./runtimeDatabase";

/**
 * Purpose: Parses a persisted JSON string list.
 *
 * Params:
 * - value: Persisted JSON value.
 *
 * Returns:
 * - String list.
 *
 * PURE: No side effects.
 */
export function parseRuntimeStringList(
  value: unknown
): readonly string[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Purpose: Parses a persisted runtime state.
 *
 * Params:
 * - value: Persisted runtime state value.
 *
 * Returns:
 * - Business function runtime state.
 *
 * PURE: No side effects.
 */
export function parseBusinessFunctionRuntimeState(
  value: unknown
): BusinessFunctionRuntimeState {
  if (
    value === "draft" ||
    value === "ready" ||
    value === "starting" ||
    value === "running" ||
    value === "paused" ||
    value === "waiting" ||
    value === "stopping" ||
    value === "stopped" ||
    value === "failed"
  ) {
    return value;
  }

  return "draft";
}

/**
 * Purpose: Converts a business function runtime into a SQLite row.
 *
 * Params:
 * - runtime: Business function runtime.
 *
 * Returns:
 * - SQLite row.
 *
 * PURE: No side effects.
 */
export function toBusinessFunctionRuntimeRow(
  runtime: BusinessFunctionRuntime
) {
  const now =
    Date.now();

  return {
    id:
      runtime.id,
    label:
      runtime.label,
    objective:
      runtime.objective,
    ownerWorker:
      runtime.ownerWorker,
    state:
      runtime.state,
    jobIds:
      JSON.stringify(
        runtime.jobIds
      ),
    refinements:
      JSON.stringify(
        runtime.refinements
      ),
    createdAt:
      now,
    updatedAt:
      now,
  };
}

/**
 * Purpose: Converts a SQLite row into a business function runtime.
 *
 * Params:
 * - row: SQLite row.
 *
 * Returns:
 * - Business function runtime.
 *
 * PURE: No side effects.
 */
export function fromBusinessFunctionRuntimeRow(
  row: any
): BusinessFunctionRuntime {
  return {
    id:
      row.id,
    label:
      row.label,
    objective:
      row.objective,
    ownerWorker:
      row.ownerWorker,
    refinements:
      parseRuntimeStringList(
        row.refinements
      ),
    state:
      parseBusinessFunctionRuntimeState(
        row.state
      ),
    jobIds:
      parseRuntimeStringList(
        row.jobIds
      ),
  };
}

/**
 * Purpose: Saves a business function runtime to persistent storage.
 *
 * Params:
 * - runtime: Runtime to save.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Writes runtime to SQLite.
 */
export function savePersistedBusinessFunctionRuntime(
  runtime: BusinessFunctionRuntime
): void {
  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO business_function_runtimes (
        id,
        label,
        objective,
        owner_worker,
        state,
        job_ids,
        refinements,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @label,
        @objective,
        @ownerWorker,
        @state,
        @jobIds,
        @refinements,
        @createdAt,
        @updatedAt
      )
    `)
    .run(
      toBusinessFunctionRuntimeRow(
        runtime
      )
    );
}

/**
 * Purpose: Loads persisted business function runtimes.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Business function runtimes.
 *
 * SIDE EFFECT:
 * - Reads runtimes from SQLite.
 */
export function loadBusinessFunctionRuntimes(): readonly BusinessFunctionRuntime[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          label,
          objective,
          owner_worker as ownerWorker,
          state,
          job_ids as jobIds,
          refinements
        FROM business_function_runtimes
        ORDER BY created_at ASC
      `)
      .all();

  return rows.map(
    fromBusinessFunctionRuntimeRow
  );
}

/**
 * Purpose: Clears persisted business function runtimes.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Deletes persisted runtimes from SQLite.
 */
export function clearPersistedBusinessFunctionRuntimes(): void {
  runtimeDb
    .prepare(
      "DELETE FROM business_function_runtimes"
    )
    .run();
}