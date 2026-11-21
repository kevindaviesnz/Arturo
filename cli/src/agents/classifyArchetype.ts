import {
  generateWithOllama,
} from "../llm/ollamaClient";

import type {
  AgentArchetype,
} from "./agentArchetype";

import type {
  ArchetypeClassification,
} from "./archetypeClassification";

import {
  archetypeRegistry,
} from "./archetypeRegistry";

import {
  buildArchetypeClassificationPrompt,
} from "./classifyArchetypePrompt";

/**
 * Checks whether a value is a known archetype.
 *
 * @param value Unknown value.
 * @returns True when value is a valid archetype.
 *
 * PURE: No side effects.
 */
export function isAgentArchetype(
  value: unknown
): value is AgentArchetype {
  return (
    typeof value === "string" &&
    value in archetypeRegistry
  );
}

/**
 * Parses and validates classifier JSON.
 *
 * @param raw Raw Ollama response.
 * @returns Valid archetype classification.
 *
 * PURE: No side effects.
 */
export function parseArchetypeClassification(
  raw: string
): ArchetypeClassification {
  const parsed =
    JSON.parse(raw);

  if (
    !isAgentArchetype(
      parsed.archetype
    )
  ) {
    throw new Error(
      "Invalid archetype classification"
    );
  }

  return {
    archetype:
      parsed.archetype,
    confidence:
      Number(parsed.confidence ?? 0),
    reason:
      String(parsed.reason ?? ""),
  };
}

/**
 * Uses Ollama to determine the best archetype for a user request.
 *
 * @param request User request.
 * @param model Ollama model name.
 * @returns Archetype classification.
 *
 * SIDE EFFECT: Calls Ollama.
 */
export async function classifyArchetype(
  request: string,
  model = "llama3.2:latest"
): Promise<ArchetypeClassification> {
  const prompt =
    buildArchetypeClassificationPrompt(
      request
    );

  const result =
    await generateWithOllama({
      model,
      prompt,
    });

  return parseArchetypeClassification(
    result.response
  );
}