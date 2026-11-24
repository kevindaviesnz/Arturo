import { refuseStartIfNotReady } from "../business/staffCheck";
import {
  enqueueJob,
  requestJobApproval,
} from "../runtime/jobQueue";

import {
  appendRunStep,
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import type {
  WorkflowExecutionPlan,
} from "./workflowExecution";
import { inferReviewLoopMetadata } from "./reviewLoopInference";

export type ReviewLoopMetadata = {
  readonly loopId: string;
  readonly draftWorkerName: string;
  readonly criticWorkerName: string;
  readonly decisionWorkerName: string;
  readonly attempt: number;
  readonly maxAttempts: number;
};

/**
 * Creates initial review-loop metadata for a workflow step.
 *
 * @param plan Workflow execution plan.
 * @param workflowRunId Workflow run id.
 * @param workerName Worker name for the job being queued.
 * @returns Review-loop metadata or undefined.
 *
 * PURE: No side effects.
 */
export function createInitialReviewLoopMetadataForStep(
  plan: WorkflowExecutionPlan,
  workflowRunId: string,
  workerName: string
): ReviewLoopMetadata | undefined {
  return inferReviewLoopMetadata(
    plan.steps,
    workflowRunId,
    workerName
  );
}

/**
 * Queues the first job for an existing workflow run.
 *
 * @param workflowRunId Existing workflow run id.
 * @param plan Resolved workflow execution plan.
 * @returns Queued job ids.
 *
 * SIDE EFFECT:
 * - Enqueues the first workflow job.
 * - May request operator approval.
 * - Appends the first workflow run step.
 */
export function queueWorkflowExecutionForRun(
  workflowRunId: string,
  plan: WorkflowExecutionPlan,
  inputArtefactRefs: readonly string[] = [],
  enterpriseId?: string
): readonly string[] {
  const firstStep =
    plan.steps[0];

  if (!firstStep) {
    throw new Error(
      "Workflow execution plan must contain at least one step"
    );
  }

  const isOperatorStep =
    firstStep.archetype === "operator";

  const startBlocked =
    refuseStartIfNotReady({
      enterpriseId,
    });
  if (startBlocked) {
    throw new Error(startBlocked);
  }

  const job =
    enqueueJob(
      firstStep.instruction,
      firstStep.workerName,
      {
        requiredCapabilities:
          isOperatorStep
            ? [
                "human-review",
              ]
            : undefined,

        selectedWorker:
          firstStep.workerName,

        routingReason:
          `Planner selected ${firstStep.workerName}`,

        workflowRunId,

        workflowName:
          plan.objective,

        workflowStepIndex:
          0,

        workflowStepCount:
          plan.steps.length,

        workflowBaseTask:
          plan.objective,

        workflowPlan:
          plan,

        enterpriseId,

        // A Workflow step never searches: a plan may be written by a model,
        // and only a person's own words may be searched (S4).

        reviewLoop:
          createInitialReviewLoopMetadataForStep(
            plan,
            workflowRunId,
            firstStep.workerName
          ),

        requiredApprovals:
          isOperatorStep
            ? 1
            : undefined,

        inputArtefactRefs:
          inputArtefactRefs.length
            ? [
                ...inputArtefactRefs,
              ]
            : undefined,
      }
    );

  if (isOperatorStep) {
    requestJobApproval(
      job.id
    );
  }

  appendRunStep(
    workflowRunId,
    {
      index:
        0,

      capability:
        firstStep.archetype,

      task:
        firstStep.instruction,

      jobId:
        job.id,

      worker:
        firstStep.workerName,

      status:
        isOperatorStep
          ? "awaiting_approval"
          : "queued",
    }
  );

  return [
    job.id,
  ];
}

/**
 * Queues the first job for a workflow execution plan.
 *
 * @param plan Resolved workflow execution plan.
 * @returns Workflow run id and queued job ids.
 *
 * SIDE EFFECT:
 * - Creates a workflow run.
 * - Enqueues the first workflow job.
 * - May request operator approval.
 * - Appends the first workflow run step.
 */
export function queueWorkflowExecution(
  plan: WorkflowExecutionPlan,
  inputArtefactRefs: readonly string[] = [],
  enterpriseId?: string
): {
  readonly workflowRunId: string;
  readonly jobIds: readonly string[];
} {
  const startBlocked =
    refuseStartIfNotReady({
      enterpriseId,
    });
  if (startBlocked) {
    throw new Error(startBlocked);
  }

  const run =
    createWorkflowRun(
      plan.objective,
      plan.explanation
    );

  return {
    workflowRunId:
      run.id,

    jobIds:
      queueWorkflowExecutionForRun(
        run.id,
        plan,
        inputArtefactRefs,
        enterpriseId
      ),
  };
}
