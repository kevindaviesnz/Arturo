import type {
  RuntimeEvent,
} from "../types/runtime";

import type {
  WorkflowExecutionPlan,
} from "../agents/workflowExecution";

export type WorkflowRunStatus =
  | "draft"
  | "running"
  | "awaiting_review"
  | "awaiting_approval"
  | "completed"
  | "failed";

export type WorkflowRunStepStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "awaiting_approval"
  | "awaiting_human_task"
  | "awaiting_revision"
  | "completed"
  | "failed"
  | "rejected"
  | "superseded";
    
export type WorkflowRunStep = {
  index: number;

  capability: string;

  task: string;

  jobId: string;

  worker?: string;

  status: WorkflowRunStepStatus;
};

export type WorkflowRun = {
  id: string;

  workflow: string;

  plannerObjective?: string;

  plannerExplanation?: string;

  status: WorkflowRunStatus;

  sequence: number;

  createdAt: number;

  updatedAt: number;

  events: RuntimeEvent[];

  steps: WorkflowRunStep[];

  executionPlan?: WorkflowExecutionPlan;

};

const runs = new Map<
  string,
  WorkflowRun
>();

let nextRunId = 1;

export function createWorkflowRun(
  workflow: string,
  plannerExplanation?: string,
  status: WorkflowRunStatus = "running",
  executionPlan?: WorkflowExecutionPlan
): WorkflowRun {
  const now = Date.now();

  const run: WorkflowRun = {
    id: `run-${nextRunId++}`,
    workflow,
    plannerExplanation,
    status,
    sequence: 0,
    createdAt: now,
    updatedAt: now,
    events: [],
    steps: [],
    executionPlan,
  };

  runs.set(run.id, run);

  return run;
}

export function appendRunStep(
  runId: string,
  step: WorkflowRunStep
): void {
  const run = runs.get(runId);

  if (!run) {
    throw new Error(
      `Run not found: ${runId}`
    );
  }

  run.steps = [
    ...run.steps,
    step,
  ];

  run.updatedAt = Date.now();
}

export function updateRunStepStatusByJobId(
  jobId: string,
  status: WorkflowRunStepStatus
): WorkflowRunStep | undefined {
  for (const run of runs.values()) {
    const existing =
      run.steps.find(
        (step) =>
          step.jobId === jobId
      );

    if (!existing) {
      continue;
    }

    const updated = {
      ...existing,
      status,
    };

    run.steps =
      run.steps.map((step) =>
        step.jobId === jobId
          ? updated
          : step
      );

    run.updatedAt = Date.now();

    return updated;
  }

  return undefined;
}

/**
 * Checks whether a workflow step status is terminal.
 *
 * Terminal steps no longer require runtime work.
 *
 * @param status Workflow step status.
 * @returns True when the status is terminal.
 *
 * PURE: No side effects.
 */
export function isTerminalWorkflowRunStepStatus(
  status: WorkflowRunStepStatus
): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "rejected" ||
    status === "superseded"
  );
}

/**
 * Refreshes a workflow run status from its step statuses.
 *
 * @param runId Workflow run id.
 * @returns Updated workflow run or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory workflow run store.
 */
export function refreshWorkflowRunStatus(
  runId: string
): WorkflowRun | undefined {
  const run =
    runs.get(runId);

  if (!run) {
    return undefined;
  }

  if (
    run.steps.some(
      (step) =>
        step.status === "failed"
    )
  ) {
    run.status = "failed";
    run.updatedAt = Date.now();

    return run;
  }

  if (
    run.steps.some(
      (step) =>
        step.status === "awaiting_review"
    )
  ) {
    run.status = "awaiting_review";
    run.updatedAt = Date.now();

    return run;
  }

  if (
    run.steps.some(
      (step) =>
        step.status === "awaiting_approval"
    )
  ) {
    run.status = "awaiting_approval";
    run.updatedAt = Date.now();

    return run;
  }

  if (
    run.steps.length > 0 &&
    run.steps.every(
      (step) =>
        isTerminalWorkflowRunStepStatus(
          step.status
        )
    )
  ) {
    run.status = "completed";
    run.updatedAt = Date.now();

    return run;
  }

  run.status = "running";
  run.updatedAt = Date.now();

  return run;
}

export function appendRunEvent(
  runId: string,
  event: RuntimeEvent
): void {
  const run = runs.get(runId);

  if (!run) {
    throw new Error(
      `Run not found: ${runId}`
    );
  }

  run.events = [
    ...run.events,
    event,
  ];

  run.sequence += 1;
  run.updatedAt = Date.now();
}

export function completeWorkflowRun(
  runId: string
): void {
  const run = runs.get(runId);

  if (!run) {
    throw new Error(
      `Run not found: ${runId}`
    );
  }

  run.status = "completed";
  run.updatedAt = Date.now();
}

export function failWorkflowRun(
  runId: string
): void {
  const run = runs.get(runId);

  if (!run) {
    throw new Error(
      `Run not found: ${runId}`
    );
  }

  run.status = "failed";
  run.updatedAt = Date.now();
}

export function getWorkflowRun(
  runId: string
) {
  return runs.get(runId);
}

export function listWorkflowRuns() {
  return [...runs.values()];
}

export function clearWorkflowRuns(): void {
  runs.clear();
  nextRunId = 1;
}