import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

/**
 * Purpose: Formats one planned task for terminal output.
 *
 * Params:
 * - id: Task id to format.
 *
 * Returns:
 * - Human-readable task detail.
 *
 * SIDE EFFECT:
 * - Reads runtime task store.
 */
export function formatTaskDetail(
  id: string
): string {
  const task =
    getBusinessFunction(
      id
    );

  if (!task) {
    return `task not found: ${id}`;
  }

  return [
    task.label,
    "",
    `id: ${task.id}`,
    `status: ${task.state}`,
    `owner: ${task.ownerWorker}`,
    `tasks: ${task.jobIds.length}`,
    "",
    "Objective:",
    task.objective,
    "",
    "Refinements:",
    task.refinements.length > 0
      ? task.refinements
          .map(
            (refinement, index) =>
              `${index + 1}. ${refinement}`
          )
          .join("\n")
      : "none",
  ].join("\n");
}

/**
 * Purpose: Handles /task-detail command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads runtime task store.
 * - Writes terminal output.
 */
export function handleTaskDetailCommand(
  args: readonly string[]
): void {
  const [
    id,
  ] = args;

  if (!id) {
    console.log(
      "Usage: /task-detail <id>"
    );
    return;
  }

  console.log(
    formatTaskDetail(
      id
    )
  );
}
