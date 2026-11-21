import type {
  BusinessFunctionId,
} from "../business/businessFunction";

import type {
  Enterprise,
  EnterpriseStatus,
} from "../enterprise/enterprise";

import {
  runtimeDb,
} from "./runtimeDatabase";

/**
 * Purpose: Parses a persisted JSON list of business function ids.
 *
 * Params:
 * - value: Persisted JSON value.
 *
 * Returns:
 * - Business function id list.
 *
 * PURE: No side effects.
 */
export function parseBusinessFunctionIds(
  value: unknown
): readonly BusinessFunctionId[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed as BusinessFunctionId[]
      : [];
  } catch {
    return [];
  }
}

/**
 * Purpose: Parses a persisted enterprise status.
 *
 * Params:
 * - value: Persisted status value.
 *
 * Returns:
 * - Enterprise status.
 *
 * PURE: No side effects.
 */
export function parseEnterpriseStatus(
  value: unknown
): EnterpriseStatus {
  if (
    value === "active" ||
    value === "running" ||
    value === "paused" ||
    value === "failed"
  ) {
    return value;
  }

  return "active";
}

/**
 * Purpose: Converts an Enterprise into a SQLite-safe row.
 *
 * Params:
 * - enterprise: Enterprise to persist.
 *
 * Returns:
 * - SQLite row.
 *
 * PURE: No side effects.
 */
export function toEnterpriseRow(
  enterprise: Enterprise
) {
  return {
    id:
      enterprise.id,
    name:
      enterprise.name,
    mission:
      enterprise.mission,
    description:
      enterprise.description ?? null,
    status:
      enterprise.status,
    businessFunctionIds:
      JSON.stringify(
        enterprise.businessFunctionIds
      ),
    createdAt:
      enterprise.createdAt,
    updatedAt:
      enterprise.updatedAt,
  };
}

/**
 * Purpose: Converts a SQLite row into an Enterprise.
 *
 * Params:
 * - row: SQLite row.
 *
 * Returns:
 * - Enterprise record.
 *
 * PURE: No side effects.
 */
export function fromEnterpriseRow(
  row: any
): Enterprise {
  return {
    id:
      row.id,
    name:
      row.name,
    mission:
      row.mission ?? "",
    description:
      row.description ?? undefined,
    status:
      parseEnterpriseStatus(
        row.status
      ),
    businessFunctionIds:
      parseBusinessFunctionIds(
        row.businessFunctionIds
      ),
    createdAt:
      row.createdAt,
    updatedAt:
      row.updatedAt,
  };
}

/**
 * Purpose: Saves an Enterprise to persistent storage.
 *
 * Params:
 * - enterprise: Enterprise to save.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Writes enterprise to SQLite.
 */
export function saveEnterprise(
  enterprise: Enterprise
): void {
  runtimeDb
    .prepare(`
      INSERT INTO enterprises (
        id,
        name,
        mission,
        description,
        status,
        business_function_ids,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @name,
        @mission,
        @description,
        @status,
        @businessFunctionIds,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        mission=excluded.mission,
        description=excluded.description,
        status=excluded.status,
        business_function_ids=excluded.business_function_ids,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at
    `)
    .run(
      toEnterpriseRow(
        enterprise
      )
    );
}

/**
 * Purpose: Loads persisted Enterprises.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Enterprise records.
 *
 * SIDE EFFECT:
 * - Reads enterprises from SQLite.
 */
export function loadEnterprises(): readonly Enterprise[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          name,
          mission,
          description,
          status,
          business_function_ids as businessFunctionIds,
          created_at as createdAt,
          updated_at as updatedAt
        FROM enterprises
        ORDER BY created_at ASC
      `)
      .all();

  return rows.map(
    fromEnterpriseRow
  );
}

/**
 * Purpose: Clears persisted Enterprises.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Deletes enterprise rows from SQLite.
 */
export function clearPersistedEnterprises(): void {
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb
    .prepare(
      "DELETE FROM enterprises"
    )
    .run();
}
