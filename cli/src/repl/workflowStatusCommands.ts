import {
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  getWorkflowRun,
} from "../runtime/workflowRunStore";

/**
 * Purpose: Formats a workflow status summary.
 *
 * Params:
 * - workflowRunId: Workflow run id.
 *
 * Returns:
 * - Human-readable workflow status.
 *
 * SIDE EFFECT:
 * - Reads workflow run and task stores.
 */
export function formatWorkflowStatus(
  workflowRunId: string
): string {
  const run =
    getWorkflowRun(
      workflowRunId
    );

  if (!run) {
    return `workflow run not found: ${workflowRunId}`;
  }

  const tasks =
    listBusinessFunctions().filter(
      (task) =>
        task.id.startsWith(
          `${workflowRunId}:`
        )
    );

  const completedSteps =
    run.steps.filter(
      (step) =>
        step.status === "completed"
    ).length;

  return [
    `Workflow: ${run.id}`,
    `Objective: ${run.workflow}`,
    "",
    `Status: ${run.status}`,
    "",
    "Progress:",
    `completed steps: ${completedSteps} / ${tasks.length}`,
    `tasks drafted: ${tasks.length}`,
    `tasks created: ${run.steps.length}`,
    "",
    "Tasks:",
    tasks.length > 0
      ? tasks
          .map(
            (task, index) =>
              `${index + 1}. ${task.label} — ${task.state}`
          )
          .join("\n")
      : "none",
  ].join("\n");
}

/**
 * Purpose: Handles /status command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads workflow run and task stores.
 * - Writes terminal output.
 */
export function handleWorkflowStatusCommand(
  args: readonly string[]
): void {
  const [
    workflowRunId,
  ] = args;

  if (!workflowRunId) {
    console.log(
      "Usage: /status <run-id>"
    );
    return;
  }

  console.log(
    formatWorkflowStatus(
      workflowRunId
    )
  );
}
