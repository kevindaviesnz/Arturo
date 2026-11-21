import {
  builtInWorkflowRegistry,
} from "../kernel/kernelWorkflowPrototype";

/**
 * Handles the /workflow-definition command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads built-in workflow registry.
 * - Writes CLI output.
 */
export function handleWorkflowDefinitionCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /workflow-definition <id>"
    );

    return;
  }

  const workflow =
    builtInWorkflowRegistry[
      id
    ];

  if (!workflow) {
    console.log(
      `workflow definition not found: ${id}`
    );

    return;
  }

  console.log(
    JSON.stringify(
      workflow,
      null,
      2
    )
  );
}