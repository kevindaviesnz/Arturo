// src/control/runWorkflow.ts

import {
  getWorkflow,
} from "./workflows";

import {
  getWorker,
  Worker,
} from "./workers";

import {
  createRun,
  appendEvent,
} from "./runStore";

/**
 * Purpose: Formats an unknown runtime value for workflow event logging.
 *
 * Params:
 * - value: Value to format.
 *
 * Returns:
 * - JSON-formatted string when possible, otherwise stringified value.
 *
 * PURE: No side effects.
 */
function format(
  value: unknown
): string {
  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(
      value
    );
  }
}

/**
 * Purpose: Builds a generator that runs a worker-based workflow dynamically.
 *
 * Params:
 * - workflowName: Name of the workflow being run.
 * - workers: Ordered workers to execute.
 *
 * Returns:
 * - Generator factory that runs the workflow for a given input.
 *
 * SIDE EFFECT:
 * - Creates a run record.
 * - Appends run events.
 * - Executes worker generator functions.
 */
function runDynamic(
  workflowName: string,
  workers: Worker<any, any>[]
) {
  return function* (
    input: any
  ) {
    const run =
      createRun(
        workflowName
      );

    let current =
      input;

    for (const w of workers) {
      const inputEvent = {
        type: "log" as const,
        message: `[${w.name}] input: ${format(
          current
        )}`,
      };

      appendEvent(
        run,
        inputEvent
      );

      yield inputEvent;

      const gen =
        w.run(
          current
        );

      let result =
        gen.next();

      while (!result.done) {
        appendEvent(
          run,
          result.value
        );

        yield result.value;

        result =
          gen.next();
      }

      current =
        result.value;

      const outputEvent = {
        type: "log" as const,
        message: `[${w.name}] output: ${format(
          current
        )}`,
      };

      appendEvent(
        run,
        outputEvent
      );

      yield outputEvent;
    }

    return current;
  };
}

/**
 * Purpose: Builds an executable runner for a saved worker-based workflow.
 *
 * Params:
 * - name: Workflow name.
 *
 * Returns:
 * - Generator factory for the workflow.
 *
 * SIDE EFFECT:
 * - Reads workflow registry.
 * - Reads worker registry.
 *
 * Throws:
 * - When the workflow does not exist.
 * - When the workflow is empty.
 * - When the workflow is not worker-based.
 * - When a referenced worker does not exist.
 */
export function buildWorkflowRunner(
  name: string
) {
  const workflow =
    getWorkflow(
      name
    );

  if (!workflow) {
    throw new Error(
      `Workflow not found: ${name}`
    );
  }

  if (
    workflow.mode === "planned"
  ) {
    throw new Error(
      "Planned workflow execution is not enabled yet. Use /workflow to generate and save the workflow, then implement planned workflow execution next."
    );
  }

  if (
    workflow.mode !== "worker"
  ) {
    throw new Error(
      `Workflow is not a worker workflow: ${name}`
    );
  }

  if (
    workflow.steps.length === 0
  ) {
    throw new Error(
      `Workflow is empty: ${name}`
    );
  }

  const workers: Worker<any, any>[] = [];

  for (const step of workflow.steps) {
    const worker =
      getWorker(
        step
      );

    if (!worker) {
      throw new Error(
        `Workflow build error: worker not found -> "${step}"`
      );
    }

    workers.push(
      worker
    );
  }

  return runDynamic(
    name,
    workers
  );
}