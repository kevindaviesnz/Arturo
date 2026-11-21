import type {
  AgentArchetype,
} from "./agentArchetype";

import type {
  WorkerCapability,
} from "../control/workers";

import {
  getArchetypeCapabilities as getRegistryArchetypeCapabilities,
} from "./archetypeRegistry";

/**
 * Returns default capabilities for an archetype.
 *
 * Compatibility wrapper around the archetype registry.
 *
 * @param archetype Agent archetype.
 * @returns Worker capabilities.
 *
 * PURE: No side effects.
 */
export function getArchetypeCapabilities(
  archetype: AgentArchetype
): WorkerCapability[] {
  return [
    ...getRegistryArchetypeCapabilities(
      archetype
    ),
  ];
}