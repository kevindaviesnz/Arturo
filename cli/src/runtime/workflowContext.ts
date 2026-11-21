import {
  getJob,
} from "./jobQueue";

import type {
  WorkflowRun,
  WorkflowRunStep,
} from "./workflowRunStore";

/**
 * Returns the clean final output text for a workflow step.
 *
 * @param step Workflow run step.
 * @returns Step output or undefined.
 *
 * SIDE EFFECT: Reads job state.
 */
export function getWorkflowStepOutput(
  step: WorkflowRunStep
): string | undefined {
  const job =
    getJob(
      step.jobId
    );

  if (!job) {
    return undefined;
  }

  return (
    job.rawOutput ??
    job.output
  );
}

/**
 * Formats one workflow step for workflow context.
 *
 * @param step Workflow run step.
 * @returns Formatted context section or undefined.
 *
 * SIDE EFFECT: Reads job state.
 */
export function formatWorkflowContextStep(
  step: WorkflowRunStep
): string | undefined {
  const output =
    getWorkflowStepOutput(
      step
    );

  if (!output) {
    return undefined;
  }

  return [
    `Step ${step.index + 1} — ${step.worker ?? "Unknown worker"} (${step.capability})`,
    "",
    output,
  ].join("\n");
}

/**
 * Builds workflow context from completed prior steps,
 * excluding the immediate previous step.
 *
 * @param run Workflow run.
 * @param beforeStepIndex Current workflow step index.
 * @returns Workflow context text.
 *
 * SIDE EFFECT: Reads job state.
 */
export function buildWorkflowContext(
  run: WorkflowRun,
  beforeStepIndex: number
): string {
  return run.steps
    .filter((step) =>
      step.index < beforeStepIndex - 1 &&
      step.status === "completed"
    )
    .map(
      formatWorkflowContextStep
    )
    .filter(
      (section): section is string =>
        Boolean(section)
    )
    .join("\n\n---\n\n");
}