import type {
  CapabilitySchema,
} from "./capabilitySchema";

import {
  createCapabilitySchema,
} from "./capabilitySchema";

export type CapabilityRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type CapabilityDefinition = {
  id: string;
  description: string;
  riskLevel: CapabilityRiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  version: string;
  inputSchema: CapabilitySchema;
  outputSchema: CapabilitySchema;
};

export type CapabilityDefinitionInput = {
  id: string;
  description: string;
  riskLevel: CapabilityRiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  version: string;
  inputSchema?: CapabilitySchema;
  outputSchema?: CapabilitySchema;
};

/**
 * Creates a capability definition.
 *
 * @param definition Capability definition input.
 * @returns Capability definition with default schemas.
 *
 * PURE: No side effects.
 */
export function createCapabilityDefinition(
  definition: CapabilityDefinitionInput
): CapabilityDefinition {
  return {
    ...definition,
    inputSchema:
      definition.inputSchema ??
      createCapabilitySchema("any"),
    outputSchema:
      definition.outputSchema ??
      createCapabilitySchema("any"),
  };
}