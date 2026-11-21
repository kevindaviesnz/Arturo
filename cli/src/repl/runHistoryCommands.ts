import {
  getRun,
  listRuns,
} from "../control/runStore";

import {
  runDeterministicWorkflow,
} from "../workflows/runDeterministicWorkflow";

/**
 * Handles the /demo command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Runs the deterministic demo workflow.
 * - Writes CLI output.
 */
export function handleDemoCommand(): void {
  const run =
    runDeterministicWorkflow(
      "Summarize runtime architecture"
    );

  console.log(
    JSON.stringify(
      run,
      null,
      2
    )
  );
}

/**
 * Handles the /runs command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads run history state.
 * - Writes CLI output.
 */
export function handleRunsCommand(): void {
  const runs =
    listRuns();

  if (!runs.length) {
    console.log(
      "(no runs)"
    );

    return;
  }

  for (const run of runs) {
    console.log(
      `#${run.id} workflow=${run.workflow}`
    );
  }
}

/**
 * Handles the /run-log command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads run history state.
 * - Writes CLI output.
 */
export function handleRunLogCommand(
  args: readonly string[]
): void {
  const id =
    Number(
      args[0]
    );

  if (!id) {
    console.log(
      "Usage: /run-log <id>"
    );

    return;
  }

  const run =
    getRun(
      id
    );

  if (!run) {
    console.log(
      `run not found: ${id}`
    );

    return;
  }

  console.log(
    `\nRun #${run.id} (workflow: ${run.workflow})\n`
  );

  for (const event of run.events) {
    console.log(
      event.message
    );
  }
}