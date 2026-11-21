import {
  attachBusinessFunctionRuntime,
  createBusinessFunctionDefinition,
  setBusinessFunctionDescription,
  setBusinessFunctionObjective,
  type BusinessFunctionDefinition,
  type BusinessFunctionExecutionMode,
} from "./businessFunctionDefinition";

import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  clearPersistedBusinessFunctionDefinitions,
  deletePersistedBusinessFunctionDefinition,
  loadBusinessFunctionDefinitions,
  savePersistedBusinessFunctionDefinition,
} from "../storage/businessFunctionDefinitionRepository";

const definitions: Record<string, BusinessFunctionDefinition> =
  Object.fromEntries(
    loadBusinessFunctionDefinitions().map(
      (definition) => [
        definition.id,
        definition,
      ]
    )
  );

/**
 * Purpose: Clears all stored business function definitions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory definition store.
 */
export function clearBusinessFunctionDefinitions(): void {
  Object.keys(
    definitions
  ).forEach(
    (id) => {
      delete definitions[id];
    }
  );

  clearPersistedBusinessFunctionDefinitions();
}

/**
 * Purpose: Removes one business function definition.
 *
 * Params:
 * - id: Definition identifier.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory definition store and its persistence.
 */
export function removeBusinessFunctionDefinition(
  id: string
): void {
  delete definitions[id];

  deletePersistedBusinessFunctionDefinition(
    id
  );
}

/**
 * Purpose: Saves a business function definition.
 *
 * Params:
 * - definition: Business function definition to save.
 *
 * Returns:
 * - Saved business function definition.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory definition store.
 */
export function saveBusinessFunctionDefinition(
  definition: BusinessFunctionDefinition
): BusinessFunctionDefinition {
  definitions[definition.id] =
    definition;

  savePersistedBusinessFunctionDefinition(
    definition
  );

  return definition;
}

/**
 * Purpose: Creates and stores a business function definition.
 *
 * Params:
 * - input: Business function definition creation input.
 *
 * Returns:
 * - Stored business function definition.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory definition store.
 */
export function createAndSaveBusinessFunctionDefinition(
  input: {
    readonly id: string;
    readonly enterpriseId: string;
    readonly label: string;
    readonly objective?: string;
    readonly description?: string;
    readonly executionMode?: BusinessFunctionExecutionMode;
    readonly requiredArchetypes?: readonly AgentArchetype[];
    readonly inputs?: readonly string[];
    readonly outputs?: readonly string[];
    readonly successCriteria?: readonly string[];
    readonly policies?: readonly string[];
    readonly now?: number;
  }
): BusinessFunctionDefinition {
  return saveBusinessFunctionDefinition(
    createBusinessFunctionDefinition(
      input
    )
  );
}

/**
 * Purpose: Finds a business function definition by id.
 *
 * Params:
 * - id: Business function definition id.
 *
 * Returns:
 * - Matching definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function getBusinessFunctionDefinition(
  id: string
): BusinessFunctionDefinition | undefined {
  return definitions[id];
}

/**
 * Purpose: Finds a business function definition by case-insensitive label.
 *
 * Params:
 * - label: Business function label.
 *
 * Returns:
 * - Matching definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function getBusinessFunctionDefinitionByLabel(
  label: string
): BusinessFunctionDefinition | undefined {
  const normalizedLabel =
    label.trim().toLowerCase();

  return Object.values(
    definitions
  ).find(
    (definition) =>
      definition.label.trim().toLowerCase() ===
      normalizedLabel
  );
}

/**
 * Purpose: Finds a business function definition by id or label.
 *
 * Params:
 * - idOrLabel: Business function id or label.
 *
 * Returns:
 * - Matching definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function getBusinessFunctionDefinitionByIdOrLabel(
  idOrLabel: string
): BusinessFunctionDefinition | undefined {
  return (
    getBusinessFunctionDefinition(
      idOrLabel
    ) ??
    getBusinessFunctionDefinitionByLabel(
      idOrLabel
    )
  );
}

/**
 * Purpose: Finds a business function definition by attached runtime id.
 *
 * Params:
 * - runtimeId: Runtime id.
 *
 * Returns:
 * - Matching definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function getBusinessFunctionDefinitionByRuntimeId(
  runtimeId: string
): BusinessFunctionDefinition | undefined {
  return Object.values(
    definitions
  ).find(
    (definition) =>
      definition.runtimeId === runtimeId
  );
}

/**
 * Purpose: Lists all business function definitions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Stored business function definitions.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function listBusinessFunctionDefinitions(): readonly BusinessFunctionDefinition[] {
  return Object.values(
    definitions
  );
}

/**
 * Purpose: Lists business function definitions belonging to an enterprise.
 *
 * Params:
 * - enterpriseId: Enterprise id.
 *
 * Returns:
 * - Stored definitions for the enterprise.
 *
 * SIDE EFFECT:
 * - Reads the in-memory definition store.
 */
export function listBusinessFunctionDefinitionsByEnterprise(
  enterpriseId: string
): readonly BusinessFunctionDefinition[] {
  return Object.values(
    definitions
  ).filter(
    (definition) =>
      definition.enterpriseId === enterpriseId
  );
}

/**
 * Purpose: Updates a stored business function description.
 *
 * Params:
 * - idOrLabel: Business function id or label.
 * - description: New description.
 *
 * Returns:
 * - Updated definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory definition store.
 */
export function updateBusinessFunctionDescription(
  idOrLabel: string,
  description: string
): BusinessFunctionDefinition | undefined {
  const definition =
    getBusinessFunctionDefinitionByIdOrLabel(
      idOrLabel
    );

  if (!definition) {
    return undefined;
  }

  const updated =
    setBusinessFunctionDescription(
      definition,
      description
    );

  return saveBusinessFunctionDefinition(
    updated
  );
}

/**
 * Updates one or both user-editable Business Function text fields.
 * At least one field must be supplied by the caller.
 *
 * SIDE EFFECT: Persists the updated definition.
 */
export function updateBusinessFunctionDetails(
  idOrLabel: string,
  changes: {
    readonly objective?: string;
    readonly description?: string;
  }
): BusinessFunctionDefinition | undefined {
  const definition =
    getBusinessFunctionDefinitionByIdOrLabel(idOrLabel);

  if (!definition) {
    return undefined;
  }

  const now = Date.now();
  const withObjective = changes.objective === undefined
    ? definition
    : setBusinessFunctionObjective(definition, changes.objective, now);
  const updated = changes.description === undefined
    ? withObjective
    : setBusinessFunctionDescription(withObjective, changes.description, now);

  return saveBusinessFunctionDefinition(updated);
}

/**
 * Turns a Function's follow-on work on or off.
 *
 * On is recorded as the "continuous" execution mode and off as "manual", the
 * mode every Function is created in.
 *
 * SIDE EFFECT: Reads and mutates the definition store.
 */
export function setBusinessFunctionFollowOn(
  idOrLabel: string,
  on: boolean
): BusinessFunctionDefinition | undefined {
  const definition =
    getBusinessFunctionDefinitionByIdOrLabel(idOrLabel);

  if (!definition) {
    return undefined;
  }

  return saveBusinessFunctionDefinition({
    ...definition,
    executionMode: on ? "continuous" : "manual",
    updatedAt: Date.now(),
  });
}

/**
 * Purpose: Attaches a runtime to a stored business function definition.
 *
 * Params:
 * - idOrLabel: Business function id or label.
 * - runtimeId: Runtime id.
 *
 * Returns:
 * - Updated definition or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory definition store.
 */
export function attachRuntimeToBusinessFunctionDefinition(
  idOrLabel: string,
  runtimeId: string
): BusinessFunctionDefinition | undefined {
  const definition =
    getBusinessFunctionDefinitionByIdOrLabel(
      idOrLabel
    );

  if (!definition) {
    return undefined;
  }

  const updated =
    attachBusinessFunctionRuntime(
      definition,
      runtimeId
    );

return saveBusinessFunctionDefinition(
  updated
);
}
