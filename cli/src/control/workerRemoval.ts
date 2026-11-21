import {
  endWorkerChat,
  getActiveWorkerChat,
} from "../chat/workerChat";

import {
  getWorker,
  removeWorker,
  type Worker,
} from "./workers";

import {
  listWorkflows,
  type Workflow,
} from "./workflows";

import {
  listJobs,
  type Job,
} from "../runtime/jobQueue";

import {
  listHumanTasks,
  type HumanTask,
} from "../runtime/humanTaskStore";

import {
  removeStaffingAssignmentsForWorker,
} from "../staffing/staffingStore";

const ACTIVE_JOB_STATUSES =
  new Set<Job["status"]>([
    "scheduled",
    "queued",
    "running",
    "awaiting_review",
    "awaiting_approval",
    "awaiting_human_task",
    "awaiting_artefact_approval",
    "awaiting_revision",
  ]);

const ACTIVE_HUMAN_TASK_STATUSES =
  new Set<HumanTask["status"]>([
    "open",
    "needs_revision",
  ]);

export type WorkerRemovalResult = {
  readonly worker:
    Worker<any, any>;
  readonly staffingAssignmentsRemoved:
    number;
  readonly historicalJobsRetained:
    number;
  readonly savedWorkflowReferences:
    number;
  readonly activeChatEnded:
    boolean;
};

/** Returns true when a Job or its still-running Workflow names the Worker. */
export function activeJobReferencesWorker(
  job: Job,
  worker:
    Worker<any, any>
): boolean {
  const names =
    new Set([
      worker.name,
      worker.displayName ??
        worker.name,
    ]);

  return (
    (
      job.worker &&
      names.has(
        job.worker
      )
    ) ||
    (
      job.selectedWorker &&
      names.has(
        job.selectedWorker
      )
    ) ||
    Boolean(
      job.workflowPlan
        ?.steps.some(
          (step) =>
            names.has(
              step.workerName
            )
        )
    ) ||
    Boolean(
      job.reviewLoop &&
      [
        job.reviewLoop
          .draftWorkerName,
        job.reviewLoop
          .criticWorkerName,
        job.reviewLoop
          .decisionWorkerName,
      ].some(
        (name) =>
          names.has(
            name
          )
      )
    )
  );
}

/** Returns true when an unfinished Human Task is assigned to the Worker. */
export function activeHumanTaskReferencesWorker(
  task: HumanTask,
  worker:
    Worker<any, any>
): boolean {
  const names =
    new Set([
      worker.name,
      worker.displayName ??
        worker.name,
    ]);

  return (
    Boolean(
      task.owner &&
      names.has(
        task.owner
      )
    ) ||
    Boolean(
      task.toWorker &&
      names.has(
        task.toWorker
      )
    ) ||
    Boolean(
      task.fromWorker &&
      names.has(
        task.fromWorker
      )
    )
  );
}

/** Returns true when one saved Workflow definition names the Worker. */
export function savedWorkflowReferencesWorker(
  workflow: Workflow,
  worker:
    Worker<any, any>
): boolean {
  const names =
    new Set([
      worker.name,
      worker.displayName ??
        worker.name,
    ]);

  if (
    workflow.mode !==
    "worker"
  ) {
    return false;
  }

  return workflow
    .steps.some(
      (name) =>
        names.has(
          name
        )
    );
}

/**
 * Safely removes one Worker while retaining historical evidence.
 *
 * System Workers and Workers referenced by unfinished work are protected.
 * Current staffing coverage is removed. Completed Jobs, Events, chat history,
 * approval records, and other audit evidence remain intact.
 */
export function safelyRemoveWorker(
  name: string
): WorkerRemovalResult {
  const worker =
    getWorker(
      name
    );
  if (!worker) {
    throw new Error(
      `worker not found: ${name}`
    );
  }
  if (worker.system) {
    throw new Error(
      `System Worker cannot be removed: ${worker.displayName ?? worker.name}`
    );
  }

  const activeJobs =
    listJobs().filter(
      (job) =>
        ACTIVE_JOB_STATUSES.has(
          job.status
        ) &&
        activeJobReferencesWorker(
          job,
          worker
        )
    );
  if (
    activeJobs.length >
    0
  ) {
    throw new Error(
      `Worker cannot be removed while active work references it: ${activeJobs.map((job) => job.id).join(", ")}`
    );
  }

  const activeHumanTasks =
    listHumanTasks().filter(
      (task) =>
        ACTIVE_HUMAN_TASK_STATUSES.has(
          task.status
        ) &&
        activeHumanTaskReferencesWorker(
          task,
          worker
        )
    );
  if (
    activeHumanTasks.length >
    0
  ) {
    throw new Error(
      `Worker cannot be removed while Human Tasks are assigned to it: ${activeHumanTasks.map((task) => task.id).join(", ")}`
    );
  }

  const historicalJobsRetained =
    listJobs().filter(
      (job) =>
        activeJobReferencesWorker(
          job,
          worker
        )
    ).length;
  const savedWorkflowReferences =
    listWorkflows().filter(
      (workflow) =>
        savedWorkflowReferencesWorker(
          workflow,
          worker
        )
    ).length;
  const staffingAssignmentsRemoved =
    removeStaffingAssignmentsForWorker(
      worker.name
    );
  const activeChatEnded =
    getActiveWorkerChat() ===
      worker.name;

  if (activeChatEnded) {
    endWorkerChat();
  }

  const removed =
    removeWorker(
      worker.name
    );
  if (!removed) {
    throw new Error(
      `worker not found: ${name}`
    );
  }

  return {
    worker:
      removed,
    staffingAssignmentsRemoved,
    historicalJobsRetained,
    savedWorkflowReferences,
    activeChatEnded,
  };
}
