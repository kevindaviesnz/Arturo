import {
  archetypeRegistry,
  getArchetypeDefinition,
  listArchetypes,
} from "../agents/archetypeRegistry";

/**
 * Handles the /archetypes command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Writes CLI output.
 */
export function handleArchetypesCommand(): void {
  for (const archetype of listArchetypes()) {
    console.log(
      archetype
    );
  }
}

/**
 * Handles the /archetype command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads archetype registry.
 * - Writes CLI output.
 */
export function handleArchetypeCommand(
  args: readonly string[]
): void {
  const name =
    args[0] as keyof typeof archetypeRegistry | undefined;

  if (!name) {
    console.log(
      "Usage: /archetype <name>"
    );

    return;
  }

  const definition =
    getArchetypeDefinition(
      name
    );

  if (!definition) {
    console.log(
      `unknown archetype: ${name}`
    );

    console.log(
      `allowed archetypes: ${listArchetypes().join(", ")}`
    );

    return;
  }

  console.log(
    `Archetype: ${definition.id}`
  );

  console.log("");

  console.log("Instruction:");
  console.log(
    definition.instruction
  );

  console.log("");

  console.log("Guardrails:");

  for (const guardrail of definition.guardrails) {
    console.log(
      `- ${guardrail}`
    );
  }
}