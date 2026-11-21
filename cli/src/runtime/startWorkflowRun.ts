import {
  attachBusinessFunctionJob,
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  queueWorkflowExecutionForRun,
} from "../agents/queueWorkflowExecution";

import {
  getWorkflowRun,
} from "./workflowRunStore";

import type {
  WorkflowExecutionPlan,
} from "../agents/workflowExecution";

export type StartWorkflowRunResult = {
  readonly workflowRunId: string;
  readonly jobIds: readonly string[];
};

/**
 * Purpose: Starts a draft workflow run by queueing its first execution job.
 *
 * Params:
 * - workflowRunId: Draft workflow run id.
 * - plan: Resolved workflow execution plan.
 *
 * Returns:
 * - Started workflow run result.
 *
 * SIDE EFFECT:
 * - Reads and mutates workflow run state.
 * - Enqueues the first workflow job.
 * - Attaches created job id to the first stored task for the run.
 */
export function startWorkflowRun(
  workflowRunId: string,
  plan: WorkflowExecutionPlan
): StartWorkflowRunResult {
  const run =
    getWorkflowRun(
      workflowRunId
    );

  if (!run) {
    throw new Error(
      `workflow run not found: ${workflowRunId}`
    );
  }

  if (run.status !== "draft") {
    throw new Error(
      `workflow run is not draft: ${workflowRunId}`
    );
  }

  const jobIds =
    queueWorkflowExecutionForRun(
      workflowRunId,
      plan
    );

  const firstTask =
    listBusinessFunctions().find(
      (task) =>
        task.id.startsWith(
          `${workflowRunId}:`
        )
    );

  if (firstTask && jobIds[0]) {
    attachBusinessFunctionJob(
      firstTask.id,
      jobIds[0]
    );
  }

  run.status = "running";
  run.updatedAt = Date.now();

  return {
    workflowRunId,
    jobIds,
  };
}