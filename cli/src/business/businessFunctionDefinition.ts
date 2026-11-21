import type {
  AgentArchetype,
} from "../agents/agentArchetype";

export type BusinessFunctionExecutionMode =
  | "manual"
  | "scheduled"
  | "continuous"
  | "event-driven";

export type BusinessFunctionDefinitionStatus =
  | "declared"
  | "active";

export type BusinessFunctionDefinition = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly label: string;
  readonly objective: string;
  readonly description: string | undefined;
  readonly status: BusinessFunctionDefinitionStatus;
  readonly runtimeId: string | undefined;
  readonly executionMode: BusinessFunctionExecutionMode;
  readonly requiredArchetypes: readonly AgentArchetype[];
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly successCriteria: readonly string[];
  readonly policies: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
};

/**
 * Purpose: Creates a business function definition.
 *
 * Params:
 * - input: Business function definition creation input.
 *
 * Returns:
 * - Declared business function definition.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionDefinition(
  input: {
    readonly id: string;
    readonly enterpriseId: string;
    readonly label: string;
    readonly objective?: string;
    readonly description?: string;
    readonly status?: BusinessFunctionDefinitionStatus;
    readonly runtimeId?: string;
    readonly executionMode?: BusinessFunctionExecutionMode;
    readonly requiredArchetypes?: readonly AgentArchetype[];
    readonly inputs?: readonly string[];
    readonly outputs?: readonly string[];
    readonly successCriteria?: readonly string[];
    readonly policies?: readonly string[];
    readonly now?: number;
  }
): BusinessFunctionDefinition {
  const now =
    input.now ?? Date.now();

  return {
    id: input.id,
    enterpriseId: input.enterpriseId,
    label: input.label,
    objective:
      input.objective ?? "",
    description:
      input.description,
    status:
      input.status ?? "declared",
    runtimeId:
      input.runtimeId,
    executionMode:
      input.executionMode ?? "manual",
    requiredArchetypes:
      input.requiredArchetypes ?? [],
    inputs:
      input.inputs ?? [],
    outputs:
      input.outputs ?? [],
    successCriteria:
      input.successCriteria ?? [],
    policies:
      input.policies ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Purpose: Updates a business function description.
 *
 * Params:
 * - definition: Existing business function definition.
 * - description: New business function description.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Updated business function definition.
 *
 * PURE: No side effects.
 */
export function setBusinessFunctionDescription(
  definition: BusinessFunctionDefinition,
  description: string,
  now: number = Date.now()
): BusinessFunctionDefinition {
  return {
    ...definition,
    description,
    updatedAt: now,
  };
}

/**
 * Updates the durable objective of a business function.
 *
 * PURE: No side effects.
 */
export function setBusinessFunctionObjective(
  definition: BusinessFunctionDefinition,
  objective: string,
  now: number = Date.now()
): BusinessFunctionDefinition {
  return {
    ...definition,
    objective,
    updatedAt: now,
  };
}

/**
 * Purpose: Attaches a runtime to a business function definition.
 *
 * Params:
 * - definition: Existing business function definition.
 * - runtimeId: Runtime id to attach.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Active business function definition with attached runtime.
 *
 * PURE: No side effects.
 */
export function attachBusinessFunctionRuntime(
  definition: BusinessFunctionDefinition,
  runtimeId: string,
  now: number = Date.now()
): BusinessFunctionDefinition {
  return {
    ...definition,
    status: "active",
    runtimeId,
    updatedAt: now,
  };
}

/**
 * Purpose: Formats the runtime attachment state for a business function.
 *
 * Params:
 * - definition: Business function definition.
 *
 * Returns:
 * - Runtime display text.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctionRuntimeState(
  definition: BusinessFunctionDefinition
): string {
  return definition.runtimeId ?? "(none)";
}
