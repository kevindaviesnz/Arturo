import {
  startWorkflowRun,
} from "../runtime/startWorkflowRun";

import {
  getWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  wakeWorkerRuntime,
} from "../runtime/workerRuntime";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Purpose: Formats a successful workflow start result.
 *
 * Params:
 * - workflowRunId: Started workflow run id.
 * - jobIds: Created job ids.
 *
 * Returns:
 * - Human-readable start summary.
 *
 * PURE: No side effects.
 */
export function formatStartWorkflowResult(
  workflowRunId: string,
  jobIds: readonly string[]
): string {
  return [
    "Workflow started.",
    "",
    `Run: ${workflowRunId}`,
    `Tasks created: ${jobIds.length}`,
    "",
    "Use /tasks or /timeline to inspect progress.",
  ].join("\n");
}

/**
 * Purpose: Handles /start command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads workflow run store.
 * - Starts workflow execution.
 * - Wakes worker runtime.
 * - Broadcasts runtime event.
 * - Writes terminal output.
 */
export function handleStartWorkflowCommand(
  args: readonly string[]
): void {
  const [
    workflowRunId,
  ] = args;

  if (!workflowRunId) {
    console.log(
      "Usage: /start <run-id>"
    );
    return;
  }

  const run =
    getWorkflowRun(
      workflowRunId
    );

  if (!run?.executionPlan) {
    console.log(
      `workflow execution plan not found: ${workflowRunId}`
    );
    return;
  }

  const result =
    startWorkflowRun(
      workflowRunId,
      run.executionPlan
    );

  wakeWorkerRuntime();

  broadcastEvent(
    "workflow.started",
    "success",
    `Workflow started: ${workflowRunId}`
  );

  console.log(
    formatStartWorkflowResult(
      result.workflowRunId,
      result.jobIds
    )
  );
}
