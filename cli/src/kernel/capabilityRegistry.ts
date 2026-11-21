import type {
  CapabilityDefinition,
} from "./capabilityDefinition";

/**
 * Creates an immutable capability registry.
 *
 * @param capabilities Capability definitions.
 * @returns Registry indexed by capability id.
 *
 * PURE: No side effects.
 */
export function createCapabilityRegistry(
  capabilities: CapabilityDefinition[]
): Record<string, CapabilityDefinition> {
  return Object.fromEntries(
    capabilities.map((capability) => [
      capability.id,
      capability,
    ])
  );
}

/**
 * Looks up a capability definition by id.
 *
 * @param registry Capability registry.
 * @param id Capability id.
 * @returns Capability definition or undefined.
 *
 * PURE: No side effects.
 */
export function getCapabilityDefinition(
  registry: Record<string, CapabilityDefinition>,
  id: string
): CapabilityDefinition | undefined {
  return registry[id];
}