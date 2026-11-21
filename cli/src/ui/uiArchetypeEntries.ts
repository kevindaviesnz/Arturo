import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  archetypeRegistry,
  listArchetypes,
  type ArchetypeDefinition,
} from "../agents/archetypeRegistry";

import type {
  WorkerCapability,
} from "../control/workers";

import type {
  WorkStreamEntry,
} from "./uiState";

export const ARCHETYPE_USES:
  Readonly<Record<AgentArchetype, string>> = {
  researcher: "Find information, assess evidence, and identify uncertainty.",
  creator: "Draft clear, useful, well-structured content.",
  reviewer: "Check work for quality, accuracy, gaps, and risk.",
  assistant: "Answer questions and help with general, bounded work.",
  analyst: "Find patterns and explain complex information.",
  converter: "Change existing material from one form into another.",
  advisor: "Recommend options while explaining trade-offs and risks.",
  planner: "Turn a goal into clear, ordered steps.",
  coordinator: "Route work and manage hand-offs between Workers.",
  operator: "Carry out precise work within explicit runtime authority.",
  observer: "Watch state, notice changes, and report important events.",
  simulator: "Explore what-if situations and state assumptions.",
  optimizer: "Improve cost, quality, speed, or performance within limits.",
  negotiator: "Seek acceptable terms without making unauthorized promises.",
  guardian: "Check safety and policy constraints before work proceeds.",
  coach: "Help a person improve through practical, supportive guidance.",
};

const CAPABILITY_LABELS:
  Readonly<Partial<Record<WorkerCapability, string>>> = {
  llm: "model reasoning",
  "human-contact": "an approved way of reaching a person",
  "human-review": "human review",
};

function formatCapability(
  capability: WorkerCapability
): string {
  return CAPABILITY_LABELS[capability]
    ? `${CAPABILITY_LABELS[capability]} (${capability})`
    : capability;
}

function formatArchetypeList(): string {
  const definitions =
    listArchetypes()
      .map((id) => archetypeRegistry[id]);

  const idWidth =
    Math.max(
      ...definitions.map((definition) => definition.id.length)
    );

  return [
    "Choose a role for an AI Worker",
    "",
    "A role decides what an AI Worker is good at and the rules it follows.",
    "It is not a permission, a qualification, or proof of expertise.",
    "",
    `${"ROLE".padEnd(idWidth)}  BEST FOR`,
    ...definitions.map((definition) =>
      `${definition.id.padEnd(idWidth)}  ${ARCHETYPE_USES[definition.id]}`
    ),
    "",
    "See one in detail:",
    "  /archetypes guardian",
    "",
    "Add an AI Worker with a role:",
    '  /add-ai-worker "Toy Safety Worker" --archetype guardian',
    "",
    "Usually you don't need this — /staff adds the right Workers for you.",
  ].join("\n");
}

function formatArchetypeDetail(
  definition: ArchetypeDefinition
): string {
  return [
    `Role: ${definition.label}`,
    `Best for: ${ARCHETYPE_USES[definition.id]}`,
    "",
    "What a Worker with this role can do:",
    ...definition.capabilities.map((capability) =>
      `  - ${formatCapability(capability)}`
    ),
    "",
    "How it is told to behave:",
    `  ${definition.instruction}`,
    "",
    "Built-in limits:",
    ...definition.guardrails.map((guardrail) =>
      `  - ${guardrail}`
    ),
    "",
    "Important:",
    "  These limits shape how the AI behaves. They do not replace Arturo's",
    "  rules, permissions, evidence checks, or a person's approval.",
    "",
    "Example:",
    `  /add-ai-worker "${definition.label} Worker" --archetype ${definition.id}`,
  ].join("\n");
}

/** Lists Worker archetypes or explains one archetype in detail. */
export function readArchetypeEntry(
  args: readonly string[]
): WorkStreamEntry {
  // Accept the subcommand grammar every other command uses ("inspect <name>",
  // and also "explain"/"list") as well as the bare "/archetypes <name>" form,
  // so a reader who guessed "/archetypes inspect operator" is not told the
  // verb is an unknown archetype.
  const leadingVerbs =
    ["list", "inspect", "explain", "show"];
  const requested =
    (leadingVerbs.includes(args[0]?.toLowerCase() ?? "")
      ? args[1]
      : args[0])
      ?.trim()
      .toLowerCase();

  if (!requested) {
    return {
      actor: "Arturo",
      label: "Worker archetypes",
      body: formatArchetypeList(),
    };
  }

  const definition =
    archetypeRegistry[
      requested as AgentArchetype
    ];

  if (!definition) {
    return {
      actor: "Arturo",
      label: "Archetype not found",
      body: [
        `Unknown archetype: ${requested}`,
        "",
        `Available archetypes: ${listArchetypes().join(", ")}`,
        "Use /archetypes to compare them.",
      ].join("\n"),
    };
  }

  return {
    actor: "Arturo",
    label: `${definition.label} archetype`,
    body: formatArchetypeDetail(definition),
  };
}
