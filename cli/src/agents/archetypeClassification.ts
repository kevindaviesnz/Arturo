import type {
  AgentArchetype,
} from "./agentArchetype";

/**
 * Result returned by the coordinator
 * archetype classifier.
 *
 * PURE: Type-only module.
 */
export type ArchetypeClassification = {
  archetype: AgentArchetype;
  confidence: number;
  reason: string;
};