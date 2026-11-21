import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import {
  blockHumanTask,
  completeHumanTask,
  getHumanTask,
  requestHumanTaskRevision,
} from "./humanTaskStore";

import {
  completeJobFromHumanTask,
  enqueueJob,
  getJob,
  requestJobRevision,
} from "./jobQueue";

import {
  queueNextWorkflowStep,
  wakeWorkerRuntime,
} from "./workerRuntime";

import {
  appendRunStep,
  refreshWorkflowRunStatus,
  updateRunStepStatusByJobId,
} from "./workflowRunStore";

/**
 * Finds the previous workflow step for a human task source job.
 *
 * @param job Source job linked to the human task.
 * @returns Previous workflow step or undefined.
 *
 * PURE: No side effects.
 */
export function findPreviousWorkflowStepForJob(
  job: ReturnType<typeof getJob>
):
  | {
      readonly workerName: string;
      readonly instruction: string;
    }
  | undefined {
  if (
    !job ||
    job.workflowStepIndex === undefined ||
    job.workflowStepIndex <= 0
  ) {
    return undefined;
  }

  return job.workflowPlan?.steps[
    job.workflowStepIndex - 1
  ];
}

/**
 * Creates a prompt asking an upstream worker to revise its output.
 *
 * @param humanTaskId Human task requesting the revision.
 * @param originalTask Original upstream worker instruction.
 * @param currentHumanTaskInput Current human task input.
 * @param revisionInstructions Human revision instructions.
 * @returns Revision prompt for the upstream worker.
 *
 * PURE: No side effects.
 */
export function createHumanTaskRevisionPrompt(
  humanTaskId: string,
  originalTask: string,
  currentHumanTaskInput: string,
  revisionInstructions: string
): string {
  return renderEnterprisePrompt("Human Requested Revision", {
    HUMAN_TASK_ID: humanTaskId,
    ORIGINAL_TASK: originalTask,
    HANDOFF_INPUT: currentHumanTaskInput,
    REVISION_INSTRUCTIONS: revisionInstructions
  });
}

/**
 * Completes a human task and resumes its workflow when linked to a job.
 *
 * @param id Human task id.
 * @param notes Completion notes.
 * @returns Completed human task.
 *
 * SIDE EFFECT:
 * - Mutates human task, job, and workflow state.
 * - Wakes the worker runtime.
 */
export function completeHumanTaskWorkflow(
  id: string,
  notes: string,
  completedBy?: string,
  outputArtefactRefs?: readonly string[]
) {
  const task =
    completeHumanTask(
      id,
      notes,
      completedBy,
      outputArtefactRefs
    );

  if (!task) {
    throw new Error(
      `human task not found: ${id}`
    );
  }

  if (!task.sourceJobId) {
    return task;
  }

  const completedJob =
    completeJobFromHumanTask(
      task.sourceJobId,
      notes
    );

  updateRunStepStatusByJobId(
    completedJob.id,
    "completed"
  );

  if (
    completedJob.humanTaskRevision
      ?.sourceHumanJobId
  ) {
    updateRunStepStatusByJobId(
      completedJob.humanTaskRevision
        .sourceHumanJobId,
      "superseded"
    );
  }

  if (completedJob.workflowRunId) {
    refreshWorkflowRunStatus(
      completedJob.workflowRunId
    );

    queueNextWorkflowStep(
      completedJob
    );
  }

  wakeWorkerRuntime();

  return task;
}

/**
 * Blocks a human task.
 *
 * @param id Human task id.
 * @param reason Block reason.
 * @returns Blocked human task.
 *
 * SIDE EFFECT:
 * - Mutates human task state.
 */
export function blockHumanTaskWorkflow(
  id: string,
  reason: string
) {
  const task =
    blockHumanTask(
      id,
      reason
    );

  if (!task) {
    throw new Error(
      `human task not found: ${id}`
    );
  }

  return task;
}

export type HumanTaskRevisionWorkflowResult = {
  readonly revisionJobId: string;
  readonly workerName: string;
};

/**
 * Requests revision for a human task and queues upstream revision work.
 *
 * @param id Human task id.
 * @param revisionInstructions Revision instructions.
 * @returns Revision job id and worker name.
 *
 * SIDE EFFECT:
 * - Mutates human task, job, and workflow state.
 * - Enqueues revision job.
 * - Wakes the worker runtime.
 */
export function requestHumanTaskRevisionWorkflow(
  id: string,
  revisionInstructions: string
): HumanTaskRevisionWorkflowResult {
  const task =
    getHumanTask(
      id
    );

  if (!task) {
    throw new Error(
      `human task not found: ${id}`
    );
  }

  if (
    task.status !== "open"
  ) {
    throw new Error(
      `human task is not open: ${id}`
    );
  }

  if (!task.sourceJobId) {
    throw new Error(
      `human task has no source Task: ${id}`
    );
  }

  const sourceJob =
    getJob(
      task.sourceJobId
    );

  if (!sourceJob) {
    throw new Error(
      `source Task not found: ${task.sourceJobId}`
    );
  }

  const previousStep =
    findPreviousWorkflowStepForJob(
      sourceJob
    );

  if (!previousStep) {
    throw new Error(
      `previous workflow step not found for human task: ${id}`
    );
  }

  const updatedTask =
    requestHumanTaskRevision(
      id,
      revisionInstructions
    );

  if (!updatedTask) {
    throw new Error(
      `human task not found: ${id}`
    );
  }

  const revisionJob =
    enqueueJob(
      createHumanTaskRevisionPrompt(
        id,
        previousStep.instruction,
        task.inputArtifact ??
          task.instructions,
        revisionInstructions
      ),
      previousStep.workerName,
      {
        selectedWorker:
          previousStep.workerName,
        routingReason:
          `Human task ${id} requested revision from upstream worker`,
        workflowRunId:
          sourceJob.workflowRunId,
        workflowName:
          sourceJob.workflowName,
        workflowStepIndex:
          sourceJob.workflowStepIndex === undefined
            ? undefined
            : sourceJob.workflowStepIndex - 1,
        workflowStepCount:
          sourceJob.workflowStepCount,
        workflowBaseTask:
          sourceJob.workflowBaseTask,
        workflowPlan:
          sourceJob.workflowPlan,
        humanTaskRevision: {
          sourceHumanTaskId:
            id,
          sourceHumanJobId:
            sourceJob.id,
          revisionInstructions,
        },
      }
    );

  requestJobRevision(
    sourceJob.id,
    revisionInstructions
  );

  if (sourceJob.workflowRunId) {
    appendRunStep(
      sourceJob.workflowRunId,
      {
        index:
          sourceJob.workflowStepIndex === undefined
            ? 0
            : Math.max(
                0,
                sourceJob.workflowStepIndex - 1
              ),
        capability:
          previousStep.workerName,
        task:
          revisionJob.task,
        jobId:
          revisionJob.id,
        worker:
          previousStep.workerName,
        status:
          "queued",
      }
    );

    updateRunStepStatusByJobId(
      sourceJob.id,
      "awaiting_revision"
    );

    refreshWorkflowRunStatus(
      sourceJob.workflowRunId
    );
  }

  wakeWorkerRuntime();

  return {
  revisionJobId:
    revisionJob.id,
  workerName:
    previousStep.workerName,
};
}
