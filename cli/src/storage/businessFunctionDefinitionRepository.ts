import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import type {
  BusinessFunctionDefinition,
  BusinessFunctionDefinitionStatus,
  BusinessFunctionExecutionMode,
} from "../business/businessFunctionDefinition";

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
export function parseStringList(
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
 * Purpose: Parses persisted archetypes.
 *
 * Params:
 * - value: Persisted JSON value.
 *
 * Returns:
 * - Agent archetype list.
 *
 * PURE: No side effects.
 */
export function parseAgentArchetypes(
  value: unknown
): readonly AgentArchetype[] {
  return parseStringList(
    value
  ) as readonly AgentArchetype[];
}

/**
 * Purpose: Parses a persisted business function status.
 *
 * Params:
 * - value: Persisted status value.
 *
 * Returns:
 * - Business function definition status.
 *
 * PURE: No side effects.
 */
export function parseBusinessFunctionDefinitionStatus(
  value: unknown
): BusinessFunctionDefinitionStatus {
  return value === "active"
    ? "active"
    : "declared";
}

/**
 * Purpose: Parses a persisted execution mode.
 *
 * Params:
 * - value: Persisted execution mode.
 *
 * Returns:
 * - Business function execution mode.
 *
 * PURE: No side effects.
 */
export function parseBusinessFunctionExecutionMode(
  value: unknown
): BusinessFunctionExecutionMode {
  if (
    value === "manual" ||
    value === "scheduled" ||
    value === "continuous" ||
    value === "event-driven"
  ) {
    return value;
  }

  return "manual";
}

/**
 * Purpose: Converts a business function definition into a SQLite row.
 *
 * Params:
 * - definition: Business function definition.
 *
 * Returns:
 * - SQLite row.
 *
 * PURE: No side effects.
 */
export function toBusinessFunctionDefinitionRow(
  definition: BusinessFunctionDefinition
) {
  return {
    id:
      definition.id,
    enterpriseId:
      definition.enterpriseId,
    label:
      definition.label,
    objective:
      definition.objective,
    description:
      definition.description ?? null,
    executionMode:
      definition.executionMode,
    requiredArchetypes:
      JSON.stringify(
        definition.requiredArchetypes
      ),
    inputs:
      JSON.stringify(
        definition.inputs
      ),
    outputs:
      JSON.stringify(
        definition.outputs
      ),
    successCriteria:
      JSON.stringify(
        definition.successCriteria
      ),
    policies:
      JSON.stringify(
        definition.policies
      ),
    status:
      definition.status,
    runtimeId:
      definition.runtimeId ?? null,
    createdAt:
      definition.createdAt,
    updatedAt:
      definition.updatedAt,
  };
}

/**
 * Purpose: Converts a SQLite row into a business function definition.
 *
 * Params:
 * - row: SQLite row.
 *
 * Returns:
 * - Business function definition.
 *
 * PURE: No side effects.
 */
export function fromBusinessFunctionDefinitionRow(
  row: any
): BusinessFunctionDefinition {
  return {
    id:
      row.id,
    enterpriseId:
      row.enterpriseId,
    label:
      row.label,
    objective:
      row.objective ?? "",
    description:
      row.description ?? undefined,
    status:
      parseBusinessFunctionDefinitionStatus(
        row.status
      ),
    runtimeId:
      row.runtimeId ?? undefined,
    executionMode:
      parseBusinessFunctionExecutionMode(
        row.executionMode
      ),
    requiredArchetypes:
      parseAgentArchetypes(
        row.requiredArchetypes
      ),
    inputs:
      parseStringList(
        row.inputs
      ),
    outputs:
      parseStringList(
        row.outputs
      ),
    successCriteria:
      parseStringList(
        row.successCriteria
      ),
    policies:
      parseStringList(
        row.policies
      ),
    createdAt:
      row.createdAt,
    updatedAt:
      row.updatedAt,
  };
}

/**
 * Purpose: Saves a business function definition to persistent storage.
 *
 * Params:
 * - definition: Definition to save.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Writes definition to SQLite.
 */
export function savePersistedBusinessFunctionDefinition(
  definition: BusinessFunctionDefinition
): void {
  runtimeDb
    .prepare(`
      INSERT INTO business_function_definitions (
        id,
        enterprise_id,
        label,
        objective,
        description,
        execution_mode,
        required_archetypes,
        inputs,
        outputs,
        success_criteria,
        policies,
        status,
        runtime_id,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @enterpriseId,
        @label,
        @objective,
        @description,
        @executionMode,
        @requiredArchetypes,
        @inputs,
        @outputs,
        @successCriteria,
        @policies,
        @status,
        @runtimeId,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        enterprise_id=excluded.enterprise_id,
        label=excluded.label,
        objective=excluded.objective,
        description=excluded.description,
        execution_mode=excluded.execution_mode,
        required_archetypes=excluded.required_archetypes,
        inputs=excluded.inputs,
        outputs=excluded.outputs,
        success_criteria=excluded.success_criteria,
        policies=excluded.policies,
        status=excluded.status,
        runtime_id=excluded.runtime_id,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at
    `)
    .run(
      toBusinessFunctionDefinitionRow(
        definition
      )
    );
}

/**
 * Purpose: Loads persisted business function definitions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Business function definitions.
 *
 * SIDE EFFECT:
 * - Reads definitions from SQLite.
 */
export function loadBusinessFunctionDefinitions(): readonly BusinessFunctionDefinition[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          enterprise_id as enterpriseId,
          label,
          objective,
          description,
          execution_mode as executionMode,
          required_archetypes as requiredArchetypes,
          inputs,
          outputs,
          success_criteria as successCriteria,
          policies,
          status,
          runtime_id as runtimeId,
          created_at as createdAt,
          updated_at as updatedAt
        FROM business_function_definitions
        ORDER BY created_at ASC
      `)
      .all();

  return rows.map(
    fromBusinessFunctionDefinitionRow
  );
}

/**
 * Purpose: Clears persisted business function definitions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Deletes persisted definitions from SQLite.
 */
export function deletePersistedBusinessFunctionDefinition(
  id: string
): void {
  runtimeDb
    .prepare(
      "DELETE FROM business_function_definitions WHERE id = ?"
    )
    .run(id);
}

export function clearPersistedBusinessFunctionDefinitions(): void {
  runtimeDb
    .prepare(
      "DELETE FROM business_function_definitions"
    )
    .run();
}
