import {
  getWorkflowRun,
  listWorkflowRuns,
} from "../runtime/workflowRunStore";

import {
  formatWorkflowTimeline,
} from "../runtime/workflowTimeline";

/**
 * Handles the /workflow-runs command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads workflow run state.
 * - Writes CLI output.
 */
export function handleWorkflowRunsCommand(): void {
  const workflowRuns =
    listWorkflowRuns();

  if (!workflowRuns.length) {
    console.log(
      "(no workflow runs)"
    );

    return;
  }

  for (const run of workflowRuns) {
    console.log(
      `${run.id} ${run.status} ${run.workflow} steps=${run.steps.length}`
    );
  }
}

/**
 * Handles the /workflow-run command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads workflow run state.
 * - Writes CLI output.
 */
export function handleWorkflowRunCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /workflow-run <run-id>"
    );

    return;
  }

  const run =
    getWorkflowRun(
      id
    );

  if (!run) {
    console.log(
      `workflow run not found: ${id}`
    );

    return;
  }

  console.log(
    JSON.stringify(
      run,
      null,
      2
    )
  );
}

/**
 * Handles the /planner-plan command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads workflow run state.
 * - Writes CLI output.
 */
export function handlePlannerPlanCommand(
  args: readonly string[]
): void {
  const runId =
    args[0];

  if (!runId) {
    console.log(
      "Usage: /planner-plan <run-id>"
    );

    return;
  }

  const run =
    getWorkflowRun(
      runId
    );

  if (!run) {
    console.log(
      `workflow run not found: ${runId}`
    );

    return;
  }

  console.log("");
  console.log("Objective:");
  console.log(run.workflow);

  console.log("");
  console.log("Planner explanation:");
  console.log(
    run.plannerExplanation ??
      "(no planner explanation stored)"
  );

  console.log("");
  console.log("Steps:");

  for (const step of run.steps) {
    console.log("");
    console.log(
      `${step.index + 1}. ${step.capability}`
    );

    if (step.worker) {
      console.log(
        `   worker: ${step.worker}`
      );
    }

    console.log(
      `   status: ${step.status}`
    );

    console.log(
      `   job: ${step.jobId}`
    );
  }
}

/**
 * Handles the /timeline command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads workflow run state.
 * - Writes CLI output.
 */
export function handleTimelineCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /timeline <run-id>"
    );

    return;
  }

  const run =
    getWorkflowRun(
      id
    );

  if (!run) {
    console.log(
      `workflow run not found: ${id}`
    );

    return;
  }

  console.log(
    formatWorkflowTimeline(
      run
    )
  );
}