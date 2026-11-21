import type {
  WorkflowRun,
  WorkflowRunStep,
} from "./workflowRunStore";

/**
 * Returns whether a workflow step is a revision step.
 *
 * A revision step reuses an earlier workflow index after that index has
 * already appeared in the timeline.
 *
 * @param step Workflow step to inspect.
 * @param previousSteps Steps already rendered before this step.
 * @returns True when the step is part of a revision pass.
 *
 * PURE: No side effects.
 */
export function isRevisionTimelineStep(
  step: WorkflowRunStep,
  previousSteps: readonly WorkflowRunStep[]
): boolean {
  return previousSteps.some(
    (previousStep) =>
      previousStep.index === step.index
  );
}

/**
 * Formats a workflow step status as a timeline symbol.
 *
 * @param status Workflow step status.
 * @param isRevision True when the step is part of a revision pass.
 * @returns Status symbol.
 *
 * PURE: No side effects.
 */
export function formatStepStatusSymbol(
  status: WorkflowRunStep["status"],
  isRevision: boolean
): string {
  if (status === "superseded") {
    return "↷";
  }

  if (
    isRevision &&
    status !== "failed" &&
    status !== "rejected"
  ) {
    return "↻";
  }

  if (status === "completed") {
    return "✓";
  }

  if (
    status === "failed" ||
    status === "rejected"
  ) {
    return "✗";
  }

  if (
    status === "awaiting_review" ||
    status === "awaiting_approval" ||
    status === "awaiting_human_task" ||
    status === "awaiting_revision"
  ) {
    return "⏳";
  }

  return "•";
}

/**
 * Formats a workflow step label.
 *
 * @param step Workflow run step.
 * @param isRevision True when the step is part of a revision pass.
 * @returns Human-readable step label.
 *
 * PURE: No side effects.
 */
export function formatTimelineStepLabel(
  step: WorkflowRunStep,
  isRevision: boolean
): string {
  if (isRevision) {
    return `revision of step ${step.index + 1}`;
  }

  return `${step.index + 1}.`;
}

/**
 * Formats a workflow step status for display.
 *
 * @param status Workflow step status.
 * @returns Human-readable status.
 *
 * PURE: No side effects.
 */
export function formatTimelineStatus(
  status: WorkflowRunStep["status"]
): string {
  if (status === "awaiting_human_task") {
    return "awaiting human task";
  }

  if (status === "awaiting_revision") {
    return "awaiting revision";
  }

  if (status === "awaiting_review") {
    return "awaiting review";
  }

  if (status === "awaiting_approval") {
    return "awaiting approval";
  }

  if (status === "superseded") {
    return "superseded by revision";
  }

  return status;
}

/**
 * Formats one workflow step for timeline display.
 *
 * @param step Workflow run step.
 * @param previousSteps Steps already rendered before this step.
 * @returns Timeline line.
 *
 * PURE: No side effects.
 */
export function formatTimelineStep(
  step: WorkflowRunStep,
  previousSteps: readonly WorkflowRunStep[] = []
): string {
  const isRevision =
    isRevisionTimelineStep(
      step,
      previousSteps
    );

  return [
    formatStepStatusSymbol(
      step.status,
      isRevision
    ),
    formatTimelineStepLabel(
      step,
      isRevision
    ),
    step.worker ?? "unknown-worker",
    formatTimelineStatus(
      step.status
    ),
    `(${step.capability})`,
  ].join(" ");
}

/**
 * Formats workflow steps for timeline display.
 *
 * @param steps Workflow run steps.
 * @returns Timeline lines.
 *
 * PURE: No side effects.
 */
export function formatTimelineSteps(
  steps: readonly WorkflowRunStep[]
): readonly string[] {
  return steps.map(
    (step, index) =>
      formatTimelineStep(
        step,
        steps.slice(
          0,
          index
        )
      )
  );
}

/**
 * Formats a workflow run as a human-readable timeline.
 *
 * @param run Workflow run.
 * @returns Timeline text.
 *
 * PURE: No side effects.
 */
export function formatWorkflowTimeline(
  run: WorkflowRun
): string {
  return [
    `Workflow: ${run.workflow}`,
    `Status: ${run.status}`,
    "",
    ...formatTimelineSteps(
      run.steps
    ),
  ].join("\n");
}