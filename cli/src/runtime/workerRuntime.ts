import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { refuseWorkUnderLocks } from "../work/workLocks";
import { readResultSetAsideStanding, recordSystemSetAside } from "./resultSetAside";
import { claimNextAction, finishNextAction, replayNextActions } from "./nextActions";
import { resolveJobEnterpriseId } from "./jobOrganisation";
import { isWorkerAvailableForNewTask } from "../control/workers";
import { getCapabilityTimeoutMs, resolveCapabilityDefinition } from "../capabilities/capabilityCatalog";
import {
  getWorker,
  selectAiWorkerForCapabilities,
  type Worker,
} from "../control/workers";

import {
  getEffectiveModelName,
} from "../llm/modelSelection";

import {
  buildHumanTaskUrl,
} from "./humanTaskLink";

import {
  settleDelegationForJob,
} from "../delegation/delegationRuntime";

import {
  publishConfiguredEventsForCompletedJob,
} from "../events/jobCompletionEventPublisher";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  resolveApprovalGate,
} from "./approvalGate";

import {
  getApprovalChain,
  storeApprovalChain,
} from "./approvalChainStore";

import {
  failJob,
  markJobFailed,
  nextJob,
  requestJobApproval,
  requestJobHumanTask,
  requestJobReview,
  replaceJob,
  startJob,
  cancelJob,
  enqueueJob,
  getJob,
  listJobs,
  type Job,
} from "./jobQueue";

import {
  executeWorkerJob,
  jobRequestsWebResearch,
  type WorkerJobExecutionOptions,
} from "./taskExecutor";

import {
  addNotification,
} from "./notificationStore";

import {
  printBackgroundOutput,
} from "../repl/backgroundOutput";

import {
  designatedApproversForFunction,
} from "../staffing/functionApprovers";

import {
  areReviewLinksServed,
} from "./reviewSurface";

import {
  appendRunEvent,
  appendRunStep,
  completeWorkflowRun,
  getWorkflowRun,
  refreshWorkflowRunStatus,
  updateRunStepStatusByJobId,
} from "./workflowRunStore";

import {
  tryParseStructuredOutput,
} from "./structuredOutput";

import {
  createCapabilityOutputValidationError,
  getRuntimeSchemaType,
  validateCapabilitySchemaValue,
} from "../kernel/capabilitySchema";

import {
  addCapabilityReceipt,
  createCapabilityReceipt,
} from "./capabilityReceiptStore";

import {
  createCapabilityAttestation,
} from "./capabilityAttestation";

import {
  addCapabilityAttestation,
} from "./capabilityAttestationStore";

import {
  buildWorkflowStepPrompt,
  createReviewLoopDecisionInstructions,
} from "../agents/buildWorkflowStepPrompt";

import {
  createJobApprovalChain,
} from "./approvalRuntime";

import {
  createReviewCredential,
} from "./reviewCredential";

import {
  buildReviewUrl,
} from "../config/publicUrl";

import {
  evaluateJobGovernance,
} from "./jobGovernance";

import {
  verboseLog,
} from "../logging/logger";

import {
  requestHumanContact,
} from "./humanContactRuntime";

import {
  measureRuntimeJobOutcome,
} from "./businessFunctionRuntimeOutcome";

import {
  createWorkerRuntimeState,
  markWorkerRuntimeBusy,
  markWorkerRuntimeIdle,
  markWorkerRuntimeStarted,
} from "./workerRuntimeState";

import {
  buildWorkflowContext,
} from "./workflowContext";

import {
  parseReviewLoopDecision,
} from "./reviewLoopDecision";

import {
  buildReviewLoopRevisionPrompt,
  buildReviewLoopRevisionRouting,
  canContinueReviewLoop,
  isRejectedReviewLoopDecision,
} from "./reviewLoopRuntime";
import { inferReviewLoopMetadata } from "../agents/reviewLoopInference";

import {
  validateWorkerSandboxForJob,
} from "./workerSandboxPolicy";

import {
  createHumanTask,
  getHumanTask,
  listHumanTasks,
} from "./humanTaskStore";

import {
  formatArtefactReference,
  parseArtefactReference,
} from "../artefacts/artefact";

import {
  formatArtefactContextForWorker,
  getArtefactVersion,
  submitArtefactVersionForReview,
} from "../artefacts/artefactStore";

let runtimeState =
  createWorkerRuntimeState();

export type RuntimeBroadcaster = (
  type: string,
  level: "info" | "success" | "warn" | "error",
  message: string
) => void;

export type HumanContactFailureInput = {
  readonly jobId: string;
  readonly targetWorker: Worker<any, any>;
  readonly message: string;
  readonly broadcast: RuntimeBroadcaster;
};

/**
 * Records a failed human-contact attempt.
 *
 * @param input Human-contact failure details.
 * @returns void
 *
 * SIDE EFFECT:
 * - Adds runtime notification.
 * - Broadcasts runtime event.
 */
export function recordHumanContactFailure(
  input: HumanContactFailureInput
): void {
  const targetName =
    input.targetWorker.displayName ??
    input.targetWorker.name;

  const failureMessage =
    `Failed to contact ${targetName}: ${input.message}`;

  addNotification(
    "error",
    "Human contact failed",
    failureMessage,
    input.jobId
  );

  input.broadcast(
    "workflow.human_contact.failed",
    "error",
    failureMessage
  );
}

export type KernelCallResolver = (
  callId: string,
  result: unknown
) => boolean;

export type CapabilityOutputValidationResult =
  | {
      valid: true;
      output: unknown;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Creates a runtime event record.
 *
 * @param type Event type.
 * @param level Event severity level.
 * @param message Human-readable event message.
 * @returns Runtime event object.
 *
 * PURE: No side effects.
 */
function createRuntimeEvent(
  type: string,
  level: "info" | "success" | "warn" | "error",
  message: string
) {
  return {
    id: Date.now(),
    type,
    level,
    message,
    timestamp:
      new Date().toISOString(),
  };
}

/**
 * Creates a human-readable job event message.
 *
 * @param status Job lifecycle status.
 * @param job Job record.
 * @returns Runtime event message.
 *
 * PURE: No side effects.
 */
export function createJobEventMessage(
  status: string,
  job: Job
): string {
  return `Task ${status}: ${job.id}`;
}

/**
 * Creates a short notification title for a job lifecycle event.
 *
 * @param status Job lifecycle status.
 * @param job Job record.
 * @returns Notification title.
 *
 * PURE: No side effects.
 */
export function createJobNotificationTitle(
  status: string,
  _job: Job
): string {
  return `Task ${status}`;
}

/**
 * Creates a notification message for a job lifecycle event.
 *
 * @param status Job lifecycle status.
 * @param job Job record.
 * @returns Notification message.
 *
 * PURE: No side effects.
 */
export function createJobNotificationMessage(
  status: string,
  job: Job
): string {
  return `${job.worker ?? "Unknown worker"} ${status} Task ${job.id}: ${job.task}`;
}

/**
 * Builds a workflow step task label.
 *
 * @param workflowName Workflow name.
 * @param index Zero-based step index.
 * @param count Total workflow step count.
 * @param capability Step capability.
 * @param baseTask Original workflow task.
 * @returns Step task string.
 *
 * PURE: No side effects.
 */
export function createWorkflowStepTask(
  workflowName: string,
  index: number,
  count: number,
  capability: string,
  baseTask: string
): string {
  return `[${workflowName} step ${index + 1}/${count}: ${capability}] ${baseTask}`;
}

/**
 * Builds a human review URL for a job.
 *
 * @param job Human review job.
 * @returns Review URL or fallback message.
 *
 * SIDE EFFECT: Reads PUBLIC_BASE_URL through buildReviewUrl.
 */
export function createHumanReviewUrl(
  job: Job
): string {
  if (!job.reviewToken) {
    return "(missing review token)";
  }

  // The link is issued *to* the assigned Human — it is emailed to them by name
  // — so the name is bound into the credential here. The server then acts on
  // the name Arturo issued, not on job.worker as it reads at decision time.
  if (!job.worker) {
    return "(no reviewer assigned)";
  }

  return buildReviewUrl(
    job.id,
    createReviewCredential({
      jobId: job.id,
      bearerToken: job.reviewToken,
      reviewer: job.worker,
    })
  );
}

/**
 * Builds a review link for one named approver of a Task held for approval.
 *
 * `createHumanReviewUrl` names `job.worker`, which for a Human review is the
 * reviewer. For governed work `job.worker` is the Worker that will do it, so
 * the approver has to be named explicitly.
 *
 * SIDE EFFECT: Reads PUBLIC_BASE_URL through buildReviewUrl.
 */
export function createApprovalReviewUrl(
  job: Job,
  approver: string
): string | undefined {
  if (!job.reviewToken) {
    return undefined;
  }

  return buildReviewUrl(
    job.id,
    createReviewCredential({
      jobId: job.id,
      bearerToken: job.reviewToken,
      reviewer: approver,
    })
  );
}

/**
 * Tells each person accountable for a held Task where to decide it.
 *
 * Says nothing unless this process serves review links, and nothing when the
 * staffing plan names no approver: a link has to be issued to someone.
 *
 * SIDE EFFECT: Writes background output and notifications.
 */
export function announceApprovalReviewLinks(
  job: Job
): void {
  if (!areReviewLinksServed()) {
    return;
  }

  for (const approver of designatedApproversForFunction(job.businessFunctionId)) {
    const reviewUrl =
      createApprovalReviewUrl(
        job,
        approver
      );

    if (!reviewUrl) {
      continue;
    }

    printBackgroundOutput([
      "",
      "[background event]",
      "Approval required before this work runs",
      `Task: ${job.id}`,
      `Approver: ${approver}`,
      `Review URL: ${reviewUrl}`,
      "Open the URL signed in as the approver, or decide in Arturo with /approve or /reject.",
      "",
    ]);

    addNotification(
      "warn",
      "Approval required",
      `${approver} to decide Task ${job.id}: ${reviewUrl}`,
      job.id
    );
  }
}

/**
 * Returns the first required capability for a job.
 *
 * @param job Job to inspect.
 * @returns Capability id or undefined.
 *
 * PURE: No side effects.
 */
export function getPrimaryJobCapability(
  job: Job
): string | undefined {
  return job.requiredCapabilities?.[0];
}

/**
 * Returns the timeout configured for a job's primary capability.
 *
 * @param job Job to inspect.
 * @returns Timeout in milliseconds, or 0 when no timeout applies.
 *
 * PURE: No side effects.
 */
export function getJobCapabilityTimeoutMs(
  job: Job
): number {
  const capability =
    getPrimaryJobCapability(
      job
    );

  if (!capability) {
    return 0;
  }

  return getCapabilityTimeoutMs(capability);
}

/**
 * Creates a capability timeout error message.
 *
 * @param capability Capability id.
 * @param timeoutMs Timeout in milliseconds.
 * @returns Timeout error message.
 *
 * PURE: No side effects.
 */
export function createCapabilityTimeoutError(
  capability: string,
  timeoutMs: number
): string {
  return `Capability ${capability} timed out after ${timeoutMs}ms`;
}

/**
 * Purpose: Race a Promise against a timeout and invoke a caller-supplied cancellation hook when the timeout wins.
 * Params: promise - work Promise; timeoutMs - timeout duration; timeoutMessage - rejection message; onTimeout - optional cancellation callback.
 * Returns: Promise result when work wins, otherwise rejects with the timeout error.
 * SIDE EFFECT: Creates and clears a timer and may invoke onTimeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  onTimeout?: () => void
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>(
    (resolve, reject) => {
      const timer =
        setTimeout(
          () => {
            onTimeout?.();

            reject(
              new Error(
                timeoutMessage
              )
            );
          },
          timeoutMs
        );

      promise.then(
        (value) => {
          clearTimeout(
            timer
          );

          resolve(
            value
          );
        },
        (error) => {
          clearTimeout(
            timer
          );

          reject(
            error
          );
        }
      );
    }
  );
}

/**
 * Converts an unknown timeout/runtime error into a safe message.
 *
 * @param err Unknown caught error.
 * @param fallback Fallback error message.
 * @returns Human-readable error message.
 *
 * PURE: No side effects.
 */
export function getRuntimeErrorMessage(
  err: unknown,
  fallback: string
): string {
  return err instanceof Error
    ? err.message
    : fallback;
}

/**
 * Purpose: Execute a Worker Job under its capability timeout and cancel any late commit path when that timeout expires.
 * Params: job - running Job; model - Worker model; options - execution dependencies.
 * Returns: Completed or failed Job.
 * SIDE EFFECT: Executes Worker work, creates a timeout AbortController, and may mutate Job state on timeout.
 */
export async function executeWorkerJobWithCapabilityTimeout(
  job: Job,
  model: string,
  options:
    WorkerJobExecutionOptions =
    {}
): Promise<Job> {
  const timeoutMs =
    getJobCapabilityTimeoutMs(
      job
    );

  const capability =
    getPrimaryJobCapability(
      job
    );

  const timeoutMessage =
    capability
      ? createCapabilityTimeoutError(
          capability,
          timeoutMs
        )
      : `Task timed out after ${timeoutMs}ms`;

  const timeoutController =
    new AbortController();

  try {
    return await withTimeout(
      executeWorkerJob(
        job,
        model,
        {
          ...options,
          abortSignal:
            timeoutController.signal,
        }
      ),
      timeoutMs,
      timeoutMessage,
      () =>
        timeoutController.abort()
    );
  } catch (err: unknown) {
    // The Task can disappear mid-execution — /reset clears the store while a
    // model call is still in flight. There is then no outcome to record, and
    // no operator-visible problem, so report the in-memory failure and let the
    // caller stop quietly rather than throwing "Task not found" at them.
    if (!getJob(job.id)) {
      return markJobFailed(
        job,
        getRuntimeErrorMessage(
          err,
          timeoutMessage
        ),
        Date.now()
      );
    }
    return failJob(
      job.id,
      getRuntimeErrorMessage(
        err,
        timeoutMessage
      )
    );
  }
}

/**
 * Parses a plain JSON value when possible.
 *
 * @param value Raw output string.
 * @returns Parsed JSON value or undefined when parsing fails.
 *
 * PURE: No side effects.
 */
export function tryParsePlainJson(
  value: string
): unknown | undefined {
  try {
    return JSON.parse(
      value
    ) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Parses raw job output into the value used by capability validation.
 *
 * @param rawOutput Raw worker output.
 * @returns Parsed structured/plain JSON output when possible, otherwise raw output.
 *
 * PURE: No side effects.
 */
export function parseJobOutputValue(
  rawOutput: string
): unknown {
  return (
    tryParseStructuredOutput(
      rawOutput
    ) ??
    tryParsePlainJson(
      rawOutput
    ) ??
    rawOutput
  );
}

/**
 * Validates a completed job output against its capability output schema.
 *
 * @param job Completed job.
 * @returns Output validation result.
 *
 * PURE: No side effects.
 */
export function validateCompletedJobCapabilityOutput(
  job: Job
): CapabilityOutputValidationResult {
  if (
    job.status !== "completed" ||
    job.rawOutput === undefined
  ) {
    return {
      valid: true,
      output:
        job.rawOutput,
    };
  }

  const capability =
    getPrimaryJobCapability(
      job
    );

  if (!capability) {
    return {
      valid: true,
      output:
        parseJobOutputValue(
          job.rawOutput
        ),
    };
  }

  const capabilityDefinition =
    resolveCapabilityDefinition(capability);

  if (!capabilityDefinition) {
    return {
      valid: true,
      output:
        parseJobOutputValue(
          job.rawOutput
        ),
    };
  }

  const output =
    parseJobOutputValue(
      job.rawOutput
    );

  const valid =
    validateCapabilitySchemaValue(
      capabilityDefinition.outputSchema,
      output
    );

  if (valid) {
    return {
      valid: true,
      output,
    };
  }

  return {
    valid: false,
    error:
      createCapabilityOutputValidationError(
        capability,
        capabilityDefinition.outputSchema.type,
        getRuntimeSchemaType(
          output
        )
      ),
  };
}

/**
 * Returns kernel call resolution data for a completed job.
 *
 * @param job Job that may be linked to a kernel call.
 * @returns Kernel call resolution payload or undefined.
 *
 * PURE: No side effects.
 */
export function createKernelCallResolution(
  job: Job
):
  | {
      callId: string;
      result: unknown;
    }
  | undefined {
  if (
    job.status !== "completed" ||
    !job.kernelCallId ||
    job.rawOutput === undefined
  ) {
    return undefined;
  }

  const validation =
    validateCompletedJobCapabilityOutput(
      job
    );

  if (!validation.valid) {
    return undefined;
  }

  return {
    callId:
      job.kernelCallId,
    result:
      validation.output,
  };
}

/**
 * Resolves a completed job's linked kernel call when possible.
 *
 * @param job Completed job that may contain a kernel call id.
 * @param resolver Kernel call resolver function.
 * @returns True when a kernel call was resolved, otherwise false.
 *
 * SIDE EFFECT: May invoke the supplied kernel call resolver.
 */
export function resolveKernelCallForJob(
  job: Job,
  resolver?: KernelCallResolver
): boolean {
  if (!resolver) {
    return false;
  }

  const resolution =
    createKernelCallResolution(
      job
    );

  if (!resolution) {
    return false;
  }

  return resolver(
    resolution.callId,
    resolution.result
  );
}

/**
 * Creates review-loop metadata for a workflow step when the step participates
 * in a known review-loop workflow.
 *
 * @param completedJob Completed workflow job.
 * @param nextWorkerName Next worker name.
 * @returns Review-loop metadata or undefined.
 *
 * PURE: No side effects.
 */
export function createReviewLoopMetadataForStep(
  completedJob: Job,
  nextWorkerName: string
): Job["reviewLoop"] {
  if (!completedJob.workflowRunId) {
    return undefined;
  }
  return inferReviewLoopMetadata(
    completedJob.workflowPlan?.steps ?? [],
    completedJob.workflowRunId,
    nextWorkerName,
    completedJob.reviewLoop?.attempt ?? 1,
    completedJob.reviewLoop?.maxAttempts ?? 3
  );
}

/**
 * Returns whether a job explicitly requires human review.
 *
 * @param job Job to inspect.
 * @returns True when the job requires human review.
 *
 * PURE: No side effects.
 */
export function jobRequiresHumanReview(
  job: Job
): boolean {
  return (
    job.requiredCapabilities ??
    []
  ).includes(
    "human-review"
  );
}

/**
 * Removes trailing punctuation from a workflow label before adding suffixes.
 *
 * @param value Workflow label.
 * @returns Label without trailing punctuation.
 *
 * PURE: No side effects.
 */
export function cleanWorkflowLabel(
  value: string
): string {
  return value
    .replace(
      /[.:;!?]+$/g,
      ""
    )
    .trim();
}

/**
 * Creates a human task title for a job.
 *
 * @param job Job requiring human task execution.
 * @returns Human-readable task title.
 *
 * PURE: No side effects.
 */
export function createHumanTaskTitleForJob(
  job: Job
): string {
  if (
    job.workflowName &&
    job.workflowStepIndex !== undefined
  ) {
    return `${cleanWorkflowLabel(
      job.workflowName
    )}: step ${job.workflowStepIndex + 1}`;
  }

  return job.task;
}

/**
 * Extracts the previous step output from a workflow step prompt.
 *
 * @param task Workflow step prompt.
 * @returns Previous step output or undefined.
 *
 * PURE: No side effects.
 */
export function extractPreviousStepOutput(
  task: string
): string | undefined {
  const marker =
    "Previous step output:";

  const index =
    task.indexOf(
      marker
    );

  if (index < 0) {
    return undefined;
  }

  const output =
    task
      .slice(
        index + marker.length
      )
      .trim();

  return output.length > 0
    ? output
    : undefined;
}

/**
 * Extracts the requested task section from a workflow step prompt.
 *
 * @param task Workflow step prompt.
 * @returns Requested task text.
 *
 * PURE: No side effects.
 */
export function extractRequestedTask(
  task: string
): string {
  const marker =
    "Previous step output:";

  const index =
    task.indexOf(
      marker
    );

  if (index < 0) {
    return task;
  }

  return task
    .slice(
      0,
      index
    )
    .replace(
      /^Task:\s*/i,
      ""
    )
    .trim();
}

/**
 * Creates a short input summary for a human task.
 *
 * @param job Job requiring human task execution.
 * @returns Human-readable input summary.
 *
 * PURE: No side effects.
 */
export function createHumanTaskInputSummary(
  job: Job
): string {
  if (job.humanTaskRevision) {
    return `Revised input after ${job.humanTaskRevision.sourceHumanTaskId} requested revision.`;
  }

  if (
    job.workflowName &&
    job.workflowStepIndex !== undefined
  ) {
    return `Input for ${cleanWorkflowLabel(
      job.workflowName
    )} step ${job.workflowStepIndex + 1}.`;
  }

  return "Input from the previous workflow step.";
}

/**
 * Resolves the worker that handed work to a human task.
 *
 * @param job Job requiring human task execution.
 * @returns Previous worker name or fallback label.
 *
 * PURE: No side effects.
 */
export function resolveHumanTaskFromWorker(
  job: Job
): string {
  const previousStepIndex =
    job.workflowStepIndex === undefined
      ? undefined
      : job.workflowStepIndex - 1;

  if (
    previousStepIndex === undefined ||
    previousStepIndex < 0
  ) {
    return "Previous workflow step";
  }

  return (
    job.workflowPlan?.steps[
      previousStepIndex
    ]?.workerName ??
    "Previous workflow step"
  );
}

/**
 * Resolves the owner for a human task.
 *
 * Revision-created human tasks should stay with the same human worker that
 * requested the revision.
 *
 * @param job Job requiring human task execution.
 * @returns Human task owner.
 *
 * SIDE EFFECT:
 * - Reads human task store when revision metadata is present.
 */
export function resolveHumanTaskOwner(
  job: Job
): string | undefined {
  const sourceHumanTaskId =
    job.humanTaskRevision
      ?.sourceHumanTaskId;

  if (!sourceHumanTaskId) {
    return job.worker;
  }

  return (
    getHumanTask(
      sourceHumanTaskId
    )?.owner ??
    job.worker
  );
}

/**
 * Creates acceptance criteria for a human task.
 *
 * @returns Acceptance criteria for the human task.
 *
 * PURE: No side effects.
 */
export function createHumanTaskAcceptanceCriteria():
  readonly string[] {
  return [
    "Review the provided input.",
    "Complete the requested human work.",
    "Record evidence Arturo should use to continue the workflow.",
  ];
}

/**
 * Creates a human task for a workflow job.
 *
 * @param job Job requiring human task execution.
 * @returns Created human task id.
 *
 * SIDE EFFECT:
 * - Creates a human task.
 * - Marks the linked job as awaiting human task completion.
 */
export function createHumanTaskForJob(
  job: Job
): string {
  const requestedTask =
    extractRequestedTask(
      job.task
    );

  const previousOutput =
    extractPreviousStepOutput(
      job.task
    );

  const owner =
    resolveHumanTaskOwner(
      job
    );

  const task =
    createHumanTask({
      title:
        createHumanTaskTitleForJob(
          job
        ),
      owner,
      fromWorker:
        resolveHumanTaskFromWorker(
          job
        ),
      toWorker:
        owner,
      purpose:
        "Complete the human portion of this Arturo workflow.",
      instructions:
        requestedTask,
      inputSummary:
        createHumanTaskInputSummary(
          job
        ),
      inputArtifact:
        previousOutput,
      requestedAction:
        requestedTask,
      acceptanceCriteria:
        createHumanTaskAcceptanceCriteria(),
      completionEvidence:
        "Record what was done, what evidence was produced, and any decision Arturo should use to continue.",
      revisionInstructions:
        job.humanTaskRevision
          ?.revisionInstructions,
      workflowRunId:
        job.workflowRunId,
      sourceJobId:
        job.id,
    });

  requestJobHumanTask(
    job.id
  );

  return task.id;
}

/**
 * Returns a human worker mode, falling back to archetype defaults.
 *
 * @param worker Assigned worker.
 * @param archetype Workflow step archetype.
 * @returns Human participation mode.
 *
 * PURE: No side effects.
 */
export function resolveHumanWorkerModeForStep(
  worker: Worker<any, any> | undefined,
  archetype: string
): "task" | "review" | "approval" | "decision" | undefined {
  if (worker?.kind !== "human") {
    return undefined;
  }

  if (worker.humanMode) {
    return worker.humanMode;
  }

  if (archetype === "reviewer") {
    return "review";
  }

  if (archetype === "guardian") {
    return "approval";
  }

  return "task";
}

/**
 * Returns whether a workflow step should be handled as a human review.
 *
 * @param worker Assigned worker.
 * @param archetype Workflow step archetype.
 * @returns True when the step should use human review.
 *
 * PURE: No side effects.
 */
export function shouldCreateHumanReviewForStep(
  worker: Worker<any, any> | undefined,
  archetype: string
): boolean {
  return (
    resolveHumanWorkerModeForStep(
      worker,
      archetype
    ) === "review"
  );
}

/**
 * Returns whether a workflow step should be handled as human approval.
 *
 * @param worker Assigned worker.
 * @param archetype Workflow step archetype.
 * @returns True when the step should use approval.
 *
 * PURE: No side effects.
 */
export function shouldCreateHumanApprovalForStep(
  worker: Worker<any, any> | undefined,
  archetype: string
): boolean {
  return (
    resolveHumanWorkerModeForStep(
      worker,
      archetype
    ) === "approval"
  );
}

/**
 * Returns whether a workflow step should be handled as a human task.
 *
 * @param worker Assigned worker.
 * @param archetype Workflow step archetype.
 * @returns True when the step should create a human task.
 *
 * PURE: No side effects.
 */
export function shouldCreateHumanTaskForStep(
  worker: Worker<any, any> | undefined,
  archetype: string
): boolean {
  return (
    resolveHumanWorkerModeForStep(
      worker,
      archetype
    ) === "task"
  );
}

/**
 * Carries exact Artefact versions from a completed Human Task or earlier
 * workflow step into the next step.
 */
export function resolveWorkflowArtefactRefs(
  completedJob: Job
): readonly string[] {
  const humanTask =
    listHumanTasks().find(
      (task) =>
        task.sourceJobId ===
        completedJob.id
    );

  return [
    ...new Set([
      ...(
        completedJob.inputArtefactRefs ??
        []
      ),
      ...(
        humanTask?.outputArtefactRefs ??
        []
      ),
    ]),
  ];
}

/**
 * Returns the exact versions produced by the immediately completed Human Task.
 *
 * A Human review step should decide on the newly created design files, not
 * silently approve every earlier evidence Artefact carried through the run.
 */
export function resolveWorkflowReviewArtefactRefs(
  completedJob: Job,
  carriedReferences: readonly string[]
): readonly string[] {
  const producedReferences =
    listHumanTasks().find(
      (task) =>
        task.sourceJobId ===
        completedJob.id
    )?.outputArtefactRefs ??
    [];

  return producedReferences.length
    ? [
        ...producedReferences,
      ]
    : [
        ...carriedReferences,
      ];
}

/**
 * Queues the next step for a sequential workflow.
 *
 * @param completedJob Completed workflow step job.
 * @returns Queued next job or undefined.
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 * - Mutates job queue.
 * - Mutates workflow run store.
 * - Broadcasts runtime events.
 * - Adds notifications.
 */
export function queueNextWorkflowStep(
  completedJob: Job
): Job | undefined {
  if (
    !completedJob.workflowRunId ||
    !completedJob.workflowName ||
    completedJob.workflowStepIndex === undefined ||
    completedJob.workflowStepCount === undefined ||
    !completedJob.workflowBaseTask ||
    !completedJob.workflowPlan
  ) {
    return undefined;
  }

  updateRunStepStatusByJobId(
    completedJob.id,
    "completed"
  );

  appendRunEvent(
    completedJob.workflowRunId,
    createRuntimeEvent(
      "workflow.step.completed",
      "success",
      `Workflow ${completedJob.workflowName} completed step ${completedJob.workflowStepIndex + 1}`
    )
  );

  refreshWorkflowRunStatus(
    completedJob.workflowRunId
  );

  const nextIndex =
    completedJob.workflowStepIndex + 1;

  if (
    nextIndex >=
    completedJob.workflowStepCount
  ) {
    broadcastEvent(
      "workflow.completed",
      "success",
      `Workflow completed: ${completedJob.workflowName}`
    );

    addNotification(
      "success",
      "Workflow completed",
      `Workflow completed: ${completedJob.workflowName}`
    );

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "workflow.completed",
        "success",
        `Workflow completed: ${completedJob.workflowName}`
      )
    );

    refreshWorkflowRunStatus(
      completedJob.workflowRunId
    );

    return undefined;
  }

  const nextStep =
    completedJob.workflowPlan
      .steps[nextIndex];

  if (!nextStep) {
    return undefined;
  }

  const workflowRun =
    getWorkflowRun(
      completedJob.workflowRunId
    );

  const workflowContext =
    workflowRun
      ? buildWorkflowContext(
          workflowRun,
          nextIndex
        )
      : "";

  const nextStepReviewLoop =
    createReviewLoopMetadataForStep(
      completedJob,
      nextStep.workerName
    );

  const reviewLoopDecisionInstructions =
    nextStepReviewLoop &&
    nextStep.workerName ===
      nextStepReviewLoop.decisionWorkerName
      ? createReviewLoopDecisionInstructions(
          nextStepReviewLoop.attempt,
          nextStep.instruction
        )
      : "";

  const carriedArtefactRefs =
    resolveWorkflowArtefactRefs(
      completedJob
    );
  const carriedArtefactReferences =
    carriedArtefactRefs.map(
      parseArtefactReference
    );
  const artefactContext =
    carriedArtefactReferences.length
      ? formatArtefactContextForWorker(
          carriedArtefactReferences
        )
      : "";
  const baseStepTask =
    buildWorkflowStepPrompt(
      nextStep.instruction,
      completedJob.rawOutput ?? "",
      workflowContext,
      reviewLoopDecisionInstructions
    );
  const stepTask =
    artefactContext
      ? [
          baseStepTask,
          "",
          artefactContext,
        ].join(
          "\n"
        )
      : baseStepTask;

  const assignedWorker =
    getWorker(
      nextStep.workerName
    );

  const isHumanReviewStep =
    shouldCreateHumanReviewForStep(
      assignedWorker,
      nextStep.archetype
    );

  const isHumanApprovalStep =
    shouldCreateHumanApprovalForStep(
      assignedWorker,
      nextStep.archetype
    );

  const isHumanTaskStep =
    shouldCreateHumanTaskForStep(
      assignedWorker,
      nextStep.archetype
    );

  const requiresHumanDecision =
    isHumanApprovalStep ||
    isHumanReviewStep;
  const reviewArtefactRefs =
    isHumanReviewStep
      ? resolveWorkflowReviewArtefactRefs(
          completedJob,
          carriedArtefactRefs
        )
      : [];
  const reviewArtefactReferences =
    reviewArtefactRefs.map(
      parseArtefactReference
    );

  const job =
    enqueueJob(
      stepTask,
      nextStep.workerName,
      {
        requiredCapabilities:
          requiresHumanDecision
            ? [
                "human-review",
              ]
            : undefined,

        selectedWorker:
          nextStep.workerName,

        routingReason:
          `Planner selected ${nextStep.workerName}`,

        workflowRunId:
          completedJob.workflowRunId,

        workflowName:
          completedJob.workflowName,

        workflowStepIndex:
          nextIndex,

        workflowStepCount:
          completedJob.workflowStepCount,

        workflowBaseTask:
          completedJob.workflowBaseTask,

        workflowPlan:
          completedJob.workflowPlan,

        enterpriseId:
          completedJob.enterpriseId,

        // The next step belongs to the same named piece of work, set once.
        workId:
          completedJob.workId,

        // A Workflow step never searches: its instruction may carry text a
        // model wrote, and only a person's own words may be searched (S4).

        inputArtefactRefs:
          carriedArtefactRefs.length
            ? [
                ...carriedArtefactRefs,
              ]
            : undefined,

        artefactApprovalDependencies:
          reviewArtefactRefs.length
            ? [
                ...reviewArtefactRefs,
              ]
            : undefined,

        humanTaskRevision:
          completedJob.humanTaskRevision,

        reviewLoop:
          nextStepReviewLoop,

        requiredApprovals:
          requiresHumanDecision
            ? 1
            : undefined,
      }
    );

  if (isHumanReviewStep) {
    if (!assignedWorker) {
      const failed =
        failJob(
          job.id,
          "Human review worker was not found"
        );

      updateRunStepStatusByJobId(
        job.id,
        "failed"
      );

      if (failed.workflowRunId) {
        refreshWorkflowRunStatus(
          failed.workflowRunId
        );
      }

      broadcastEvent(
        "workflow.step.failed",
        "error",
        "Human review worker was not found"
      );

      return failed;
    }

    try {
      reviewArtefactReferences.forEach(
        (reference) => {
          const version =
            getArtefactVersion(
              reference
            );
          if (
            version?.reviewStatus ===
              "draft" ||
            version?.reviewStatus ===
              "revision_requested"
          ) {
            submitArtefactVersionForReview(
              reference,
              assignedWorker.displayName ??
                assignedWorker.name,
              job.id
            );
          } else if (
            version?.reviewStatus !==
            "approved"
          ) {
            throw new Error(
              `Artefact cannot enter workflow review from status ${version?.reviewStatus ?? "missing"}: ${formatArtefactReference(reference)}`
            );
          }
        }
      );
    } catch (error) {
      const failed =
        failJob(
          job.id,
          error instanceof Error
            ? error.message
            : String(
                error
              )
        );
      updateRunStepStatusByJobId(
        job.id,
        "failed"
      );
      if (failed.workflowRunId) {
        refreshWorkflowRunStatus(
          failed.workflowRunId
        );
      }
      broadcastEvent(
        "workflow.step.failed",
        "error",
        failed.error ??
          "Artefact review setup failed"
      );
      return failed;
    }

    requestJobReview(
      job.id
    );

    const reviewUrl =
      createHumanReviewUrl(
        job
      );

    printBackgroundOutput([
      "",
      "[background event]",
      "Human review required",
      `Reviewer: ${nextStep.workerName}`,
      `Review URL: ${reviewUrl}`,
      "Open the URL, approve or reject the review, then return to Arturo.",
      "",
    ]);

    appendRunStep(
      completedJob.workflowRunId,
      {
        index:
          nextIndex,
        capability:
          nextStep.archetype,
        task:
          stepTask,
        jobId:
          job.id,
        worker:
          nextStep.workerName,
        status:
          "awaiting_review",
      }
    );

    broadcastEvent(
      "workflow.step.awaiting_review",
      "warn",
      `Workflow ${completedJob.workflowName} awaiting human review at step ${nextIndex + 1}`
    );

    const reviewLink =
      reviewUrl;

    addNotification(
      "warn",
      "Human review required",
      `Review required: ${reviewLink}`,
      job.id
    );

    const requestingWorker =
      completedJob.worker
        ? getWorker(
            completedJob.worker
          )
        : undefined;

    if (requestingWorker) {
      requestHumanContact({
        requestingWorker,
        humanWorker:
          assignedWorker,
        subject:
          "Arturo review required",
        body:
          [
            `Hello ${assignedWorker.displayName ?? assignedWorker.name},`,
            "",
            "Arturo requires your review.",
            "",
            "Please open the review link below:",
            "",
            reviewLink,
            "",
            "You can approve or reject the review from that page.",
            "",
            "Thank you.",
          ].join("\n"),
      }).catch((err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : String(err);

        console.error(
          "Failed to send human contact email",
          err
        );

        recordHumanContactFailure({
          jobId:
            job.id,
          targetWorker:
            assignedWorker,
          message,
          broadcast:
            broadcastEvent,
        });
      });
    } else {
      const message =
        `Requesting Worker not found for Task ${completedJob.id}`;

      console.error(
        `Failed to send human contact email: ${message}`
      );

      recordHumanContactFailure({
        jobId:
          job.id,
        targetWorker:
          assignedWorker,
        message,
        broadcast:
          broadcastEvent,
      });
    }

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "workflow.step.awaiting_review",
        "warn",
        `Workflow ${completedJob.workflowName} awaiting human review at step ${nextIndex + 1}`
      )
    );
  } else if (isHumanApprovalStep) {
    requestJobApproval(
      job.id
    );

    appendRunStep(
      completedJob.workflowRunId,
      {
        index:
          nextIndex,
        capability:
          nextStep.archetype,
        task:
          stepTask,
        jobId:
          job.id,
        worker:
          nextStep.workerName,
        status:
          "awaiting_approval",
      }
    );

    broadcastEvent(
      "workflow.step.awaiting_approval",
      "warn",
      `Workflow ${completedJob.workflowName} awaiting approval at step ${nextIndex + 1}`
    );

    addNotification(
      "warn",
      "Human approval required",
      `Workflow ${completedJob.workflowName} requires approval`,
      job.id
    );

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "workflow.step.awaiting_approval",
        "warn",
        `Workflow ${completedJob.workflowName} awaiting approval at step ${nextIndex + 1}`
      )
    );
  } else if (isHumanTaskStep) {
    const humanTaskId =
      createHumanTaskForJob(
        job
      );

    appendRunStep(
      completedJob.workflowRunId,
      {
        index:
          nextIndex,
        capability:
          nextStep.archetype,
        task:
          stepTask,
        jobId:
          job.id,
        worker:
          nextStep.workerName,
        status:
          "awaiting_human_task",
      }
    );

    broadcastEvent(
      "workflow.step.awaiting_human_task",
      "warn",
      `Workflow ${completedJob.workflowName} awaiting human task at step ${nextIndex + 1}`
    );

    addNotification(
      "warn",
      "Human task required",
      `Human task required: ${humanTaskId}`,
      job.id
    );

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "workflow.step.awaiting_human_task",
        "warn",
        `Workflow ${completedJob.workflowName} awaiting human task at step ${nextIndex + 1}`
      )
    );

    const humanTask =
      getHumanTask(
        humanTaskId
      );

    printBackgroundOutput([
      "",
      "[background event]",
      "Human task required",
      `Task: ${humanTaskId}`,
      `Worker: ${nextStep.workerName}`,
      humanTask
        ? `Open: ${buildHumanTaskUrl(humanTask)}`
        : undefined,
      `Use /human-task ${humanTaskId} to inspect it.`,
      `Use /complete-human-task ${humanTaskId} "<notes>" when done.`,
      "",
    ].filter(
      (line): line is string =>
        typeof line === "string"
    ));
  } else {
    appendRunStep(
      completedJob.workflowRunId,
      {
        index:
          nextIndex,
        capability:
          nextStep.archetype,
        task:
          stepTask,
        jobId:
          job.id,
        worker:
          nextStep.workerName,
        status:
          "queued",
      }
    );

    broadcastEvent(
      "workflow.step.queued",
      "info",
      `Workflow ${completedJob.workflowName} queued step ${nextIndex + 1}`
    );

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "workflow.step.queued",
        "info",
        `Workflow ${completedJob.workflowName} queued step ${nextIndex + 1}`
      )
    );
  }

  refreshWorkflowRunStatus(
    completedJob.workflowRunId
  );

  return (
    getJob(
      job.id
    ) ??
    job
  );
}
/**
 * Fails a completed job when its capability output is invalid.
 *
 * @param job Completed job.
 * @returns Original job when valid, otherwise failed job.
 *
 * SIDE EFFECT:
 * - May mutate job queue by failing the job.
 * - May persist updated job state.
 */
export function failJobWithInvalidCapabilityOutput(
  job: Job
): Job {
  const validation =
    validateCompletedJobCapabilityOutput(
      job
    );

  if (validation.valid) {
    return job;
  }

  return failJob(
    job.id,
    validation.error
  );
}

/**
 * Finds the workflow step index assigned to a named worker.
 *
 * @param job Workflow job containing the execution plan.
 * @param workerName Worker name to find.
 * @returns Step index or undefined.
 *
 * PURE: No side effects.
 */
export function findWorkflowStepIndexByWorkerName(
  job: Job,
  workerName: string
): number | undefined {
  const index =
    job.workflowPlan?.steps.findIndex(
      (step) =>
        step.workerName === workerName
    );

  return index === undefined ||
    index < 0
    ? undefined
    : index;
}

/**
 * Finds the latest completed draft job for a review loop.
 *
 * @param loopId Workflow run id for the review loop.
 * @param draftWorkerName Worker name that creates draft/revision output.
 * @returns Latest completed draft job or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory job queue.
 */
export function findLatestCompletedReviewLoopDraftJob(
  loopId: string,
  draftWorkerName: string
): Job | undefined {
  return listJobs()
    .filter(
      (job) =>
        job.workflowRunId === loopId &&
        job.worker === draftWorkerName &&
        job.status === "completed"
    )
    .sort(
      (left, right) =>
        (right.completedAt ?? 0) -
        (left.completedAt ?? 0)
    )[0];
}

/**
 * Handles a completed review-loop decision job.
 *
 * When the decision worker rejects the previous output and more attempts are
 * available, this queues a revision job for the draft worker and prevents the
 * normal workflow from advancing.
 *
 * @param completedJob Completed job.
 * @returns True when review-loop handling took over workflow progression.
 *
 * SIDE EFFECT:
 * - May enqueue a revision job.
 * - May broadcast workflow events.
 * - May append workflow timeline events.
 */
export function handleCompletedReviewLoopDecision(
  completedJob: Job
): boolean {
  const metadata =
    completedJob.reviewLoop;

  if (!metadata) {
    return false;
  }

  if (
    completedJob.worker !==
    metadata.decisionWorkerName
  ) {
    return false;
  }

  const decision =
    parseReviewLoopDecision(
      completedJob.output ??
        completedJob.rawOutput ??
        ""
    );

  if (!decision) {
    failJob(
      completedJob.id,
      "Review-loop decision worker returned invalid JSON"
    );

    if (completedJob.workflowRunId) {
      updateRunStepStatusByJobId(
        completedJob.id,
        "failed"
      );

      appendRunEvent(
        completedJob.workflowRunId,
        createRuntimeEvent(
          "review_loop.invalid_decision",
          "error",
          "Review-loop decision worker returned invalid JSON"
        )
      );

      refreshWorkflowRunStatus(
        completedJob.workflowRunId
      );
    }

    broadcastEvent(
      "review_loop.invalid_decision",
      "error",
      `${metadata.decisionWorkerName} returned invalid review-loop JSON`
    );

    return true;
  }

  if (
    decision.decision ===
    "approved"
  ) {
    if (completedJob.workflowRunId) {
      updateRunStepStatusByJobId(
        completedJob.id,
        "completed"
      );

      appendRunEvent(
        completedJob.workflowRunId,
        createRuntimeEvent(
          "review_loop.approved",
          "success",
          `Review loop approved on attempt ${metadata.attempt}`
        )
      );

      completeWorkflowRun(
        completedJob.workflowRunId
      );
    }

    broadcastEvent(
      "review_loop.approved",
      "success",
      `${metadata.decisionWorkerName} approved attempt ${metadata.attempt}`
    );

    return true;
  }

  if (
    !isRejectedReviewLoopDecision(
      decision
    )
  ) {
    return false;
  }

  if (
    !canContinueReviewLoop(
      metadata
    )
  ) {
    if (completedJob.workflowRunId) {
      updateRunStepStatusByJobId(
        completedJob.id,
        "failed"
      );

      appendRunEvent(
        completedJob.workflowRunId,
        createRuntimeEvent(
          "review_loop.max_attempts_reached",
          "error",
          `Review loop rejected after ${metadata.maxAttempts} attempts`
        )
      );

      refreshWorkflowRunStatus(
        completedJob.workflowRunId
      );
    }

    broadcastEvent(
      "review_loop.max_attempts_reached",
      "error",
      `${metadata.decisionWorkerName} rejected after ${metadata.maxAttempts} attempts`
    );

    return true;
  }

  const draftStepIndex =
    findWorkflowStepIndexByWorkerName(
      completedJob,
      metadata.draftWorkerName
    );

  const rejectedDraftJob =
    findLatestCompletedReviewLoopDraftJob(
      metadata.loopId,
      metadata.draftWorkerName
    );

  const revisionPrompt =
    buildReviewLoopRevisionPrompt(
      completedJob.workflowBaseTask ??
        completedJob.task,
      rejectedDraftJob ??
        completedJob,
      decision
    );

  const routing =
    {
      ...buildReviewLoopRevisionRouting(
        metadata
      ),
      workflowRunId:
        completedJob.workflowRunId,
      workflowName:
        completedJob.workflowName,
      workflowStepIndex:
        draftStepIndex,
      workflowStepCount:
        completedJob.workflowStepCount,
      workflowBaseTask:
        completedJob.workflowBaseTask,
      workflowCapabilities:
        completedJob.workflowCapabilities,
      workflowPlan:
        completedJob.workflowPlan,
      // A revision is the same draft again: it stays on the same named work.
      workId:
        completedJob.workId,
    };

  const revisionJob =
    enqueueJob(
      revisionPrompt,
      metadata.draftWorkerName,
      routing
    );

  if (completedJob.workflowRunId) {
    appendRunStep(
      completedJob.workflowRunId,
      {
        index:
          draftStepIndex ?? 0,
        capability:
          "analyst",
        task:
          revisionPrompt,
        jobId:
          revisionJob.id,
        worker:
          metadata.draftWorkerName,
        status:
          "queued",
      }
    );

    appendRunEvent(
      completedJob.workflowRunId,
      createRuntimeEvent(
        "review_loop.revision_queued",
        "warn",
        `Review loop queued revision attempt ${metadata.attempt + 1}`
      )
    );

    refreshWorkflowRunStatus(
      completedJob.workflowRunId
    );
  }

  broadcastEvent(
    "review_loop.revision_queued",
    "warn",
    `${metadata.decisionWorkerName} rejected attempt ${metadata.attempt}; queued revision attempt ${metadata.attempt + 1}`
  );

  return true;
}

/**
 * Repairs capability jobs produced by the former human-first execution router.
 * Deliberately assigned human review and human task jobs are not changed.
 *
 * SIDE EFFECT: May persist a corrected Job and broadcast a routing event.
 */
export function repairInvalidCapabilityRouting(
  job: Job,
  broadcaster: RuntimeBroadcaster = broadcastEvent
): Job {
  const selectedWorker =
    job.worker
      ? getWorker(job.worker)
      : undefined;

  const hasExecutionApprovalChain =
    Boolean(getApprovalChain(job.id));

  const isGovernedExecution =
    job.status === "awaiting_approval" ||
    hasExecutionApprovalChain;

  const isLegacyCapabilityRouting =
    job.routingReason?.startsWith(
      "Selected first worker matching:"
    ) ?? false;

  if (
    selectedWorker?.kind !== "human" ||
    (!isGovernedExecution && !isLegacyCapabilityRouting) ||
    (job.requiredCapabilities ?? []).includes("human-review")
  ) {
    return job;
  }

  let enterpriseId: string | undefined;
  try { enterpriseId = resolveJobEnterpriseId(job); }
  catch { return job; } // Governance will record and deny conflicting scope.
  const aiWorker = selectAiWorkerForCapabilities(
    job.requiredCapabilities ?? [], enterpriseId
  );

  const repaired = replaceJob({
    ...job,
    worker: aiWorker?.name,
    selectedWorker: aiWorker?.name,
    routingReason: aiWorker
      ? `Recovered capability routing to AI worker: ${aiWorker.name}`
      : "Recovered invalid human execution routing; awaiting a capable AI worker",
  });

  broadcaster(
    "worker.assigned",
    aiWorker ? "success" : "warn",
    aiWorker
      ? `Recovered Task ${job.id} routing from human participant to AI Worker ${aiWorker.name}`
      : `Removed invalid Human executor from Task ${job.id}`
  );

  return repaired;
}

/**
 * Processes one queued job, if one exists.
 *
 * @param broadcaster Runtime event broadcaster.
 * @param kernelCallResolver Optional resolver for kernel continuation calls.
 * @returns Processed job or undefined if no job was queued.
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 * - Mutates job queue.
 * - Calls Ollama through task executor.
 * - Broadcasts runtime events.
 * - May resolve kernel continuations.
 */
export async function processNextQueuedJob(
  broadcaster: RuntimeBroadcaster =
    broadcastEvent,
  kernelCallResolver?: KernelCallResolver
): Promise<Job | undefined> {
  let queued =
    listJobs().find(
      (job) =>
        job.status === "queued" &&
        Boolean(job.worker) &&
        (!getWorker(job.worker!) || isWorkerAvailableForNewTask(getWorker(job.worker!)))
    ) ?? listJobs().find(job => job.status === "queued" && !job.worker);

  if (!queued) {
    return undefined;
  }

  queued = repairInvalidCapabilityRouting(
    queued,
    broadcaster
  );

  const existingChain =
    getApprovalChain(
      queued.id
    );

  // Governance is evaluated on every pass, even when an approval chain already
  // exists — a pre-seeded chain must not let a job skip a deny/require-approval
  // policy check.
  const governanceDecision =
    evaluateJobGovernance(
      queued
    );

  if (
    governanceDecision?.effect ===
    "deny"
  ) {
    const failed = failJob(
      queued.id,
      `Governance denied capability ${governanceDecision.capabilityId} (policy ${governanceDecision.matchedRuleId})`
    );
    broadcaster(
      "governance.job.denied",
      "error",
      `Governance denied Task ${queued.id}: ${governanceDecision.capabilityId}`
    );
    settleDelegationForJob(failed);
    return failed;
  }

  // A web step always waits for its own signed go-ahead, whatever the
  // business's rules say (S4, W6): the go-ahead is for these search words.
  const governanceRequiresApproval =
    governanceDecision?.effect ===
    "require-approval" ||
    jobRequestsWebResearch(queued);

  const approvalChain =
    existingChain ??
    (
      (
        queued.requiredCapabilities ??
        []
      ).includes(
        "human-review"
      ) || governanceRequiresApproval
        ? createJobApprovalChain(
            queued.id,
            // A governance rule's approval count is authoritative over the count
            // supplied in job routing metadata, so "require-approval" can mean
            // more than one approver.
            governanceDecision?.requiredApprovals ??
              queued.requiredApprovals ??
              1,
            queued.approvalPolicy,
            governanceDecision?.effect === "require-approval"
              ? governanceDecision.matchedRuleId
              : undefined
          )
        : undefined
    );

  if (
    governanceRequiresApproval &&
    !existingChain &&
    approvalChain
  ) {
    announceApprovalReviewLinks(
      requestJobApproval(
        queued.id
      )
    );
  }

  const approvalState =
    resolveApprovalGate(
      queued,
      approvalChain,
      governanceRequiresApproval || Boolean(existingChain)
    );

  if (
    approvalState ===
    "awaiting_approval"
  ) {
    return undefined;
  }

  if (
    approvalState ===
    "rejected"
  ) {
    const failed =
      failJob(
        queued.id,
        "Approval chain rejected"
      );

    broadcaster(
      "job.failed",
      "error",
      createJobEventMessage(
        "failed",
        failed
      )
    );

    addNotification(
      "error",
      createJobNotificationTitle(
        "failed",
        failed
      ),
      createJobNotificationMessage(
        "failed",
        failed
      ),
      failed.id
    );

    settleDelegationForJob(failed);

    return failed;
  }

  if (!queued.worker) {
    // Runtime-generated work remains queued until a capable Worker exists.
    return undefined;
  }

  const worker =
    getWorker(
      queued.worker
    );

  if (!worker) {
    const failed =
      failJob(
        queued.id,
        `Worker not found: ${queued.worker}`
      );

    broadcaster(
      "job.failed",
      "error",
      createJobEventMessage(
        "failed",
        failed
      )
    );

    settleDelegationForJob(failed);

    return failed;
  }

  if (!isWorkerAvailableForNewTask(worker)) return undefined;
  if (!workerBelongsToEnterprise(worker.name, resolveJobEnterpriseId(queued))) {
    const failed = failJob(queued.id, "Worker does not belong to the Job Enterprise (or the Job has no unambiguous Enterprise).");
    settleDelegationForJob(failed);
    return failed;
  }

  if (worker.kind !== "ai" && worker.kind !== "workflow") {
    if (
      jobRequiresHumanReview(
        queued
      )
    ) {
      return requestJobReview(
        queued.id
      );
    }

    const humanTaskId =
      createHumanTaskForJob(
        queued
      );

    broadcaster(
      "human_task.created",
      "warn",
      `Human task created: ${humanTaskId}`
    );

    addNotification(
      "warn",
      "Human task required",
      `Human task required: ${humanTaskId}`,
      queued.id
    );

    return (
      listJobs().find(
        (job) =>
          job.id === queued.id
      ) ?? queued
    );
  }

  const sandboxViolation =
    validateWorkerSandboxForJob(
      queued,
      worker
    );

  if (sandboxViolation) {
    const failed =
      failJob(
        queued.id,
        sandboxViolation.message
      );

    broadcaster(
      "job.failed",
      "error",
      createJobEventMessage(
        "failed",
        failed
      )
    );

    addNotification(
      "error",
      createJobNotificationTitle(
        "failed",
        failed
      ),
      createJobNotificationMessage(
        "failed",
        failed
      ),
      failed.id
    );

    settleDelegationForJob(failed);

    return failed;
  }

  // Named work is checked again as the Task starts: "no AI" turned on, or the
  // work locked, since it was created cancels it before anything is sent
  // (work/workLocks.ts). startJob refuses the same as a backstop.
  const lockedAtStart =
    refuseWorkUnderLocks({
      workId: queued.workId,
      enterpriseId: queued.enterpriseId,
      functionId: queued.businessFunctionId,
      when: "start",
      taskCreatedAt: queued.createdAt,
    });
  if (lockedAtStart) {
    const cancelled =
      cancelJob(
        queued.id,
        `Cancelled before it started: ${lockedAtStart}`
      );
    broadcaster(
      "job.cancelled",
      "warn",
      `Task ${cancelled.id} was cancelled before it started: ${lockedAtStart}`
    );
    addNotification(
      "warn",
      `Task cancelled: ${cancelled.id}`,
      `Task ${cancelled.id} was cancelled before it started: ${lockedAtStart}`,
      cancelled.id
    );
    settleDelegationForJob(cancelled);
    return cancelled;
  }

  const running =
    startJob(
      queued.id
    );

  broadcaster(
    "job.started",
    "info",
    createJobEventMessage(
      "started",
      running
    )
  );

  // The model is whatever /model currently selects — a Worker does not carry
  // its own. Passing anything else would name a model that is not called.
  const executed =
    await executeWorkerJobWithCapabilityTimeout(
      running,
      getEffectiveModelName(),
      {
        onWebSearchEvidenceCaptured:
          (
            captured,
            response
          ) => {
            broadcaster(
              "web_search.evidence_captured",
              "success",
              `Governed Web Search captured ${response.results.length} result(s) for Task ${running.id} as ${captured.artefactReference}`
            );
          },
      }
    );

  // Deleted mid-flight (see above): there is nothing left to attest, notify, or
  // advance a Workflow with, and writing any of it would resurrect records the
  // operator asked to be gone.
  if (!getJob(executed.id)) {
    verboseLog(
      `Task ${executed.id} was removed while it was running; nothing to record.`
    );
    return undefined;
  }

  const finished =
    executed.status === "completed"
      ? failJobWithInvalidCapabilityOutput(
          executed
        )
      : executed;

  // Checked again when it finishes. A running Task cannot be stopped, so if
  // "no AI" was turned on, or the work became locked, while it ran, its
  // result is set aside by Arturo itself: never under a person's name, never
  // a sign-off, and nothing goes on from it (runtime/resultSetAside.ts).
  const lockedAtFinish =
    finished.status === "completed"
      ? refuseWorkUnderLocks({
          workId: finished.workId,
          enterpriseId: finished.enterpriseId,
          functionId: finished.businessFunctionId,
          when: "finish",
          taskCreatedAt: finished.createdAt,
        })
      : undefined;
  if (lockedAtFinish) {
    recordSystemSetAside(
      finished,
      lockedAtFinish
    );
    broadcaster(
      "job.result_set_aside",
      "warn",
      `The result of Task ${finished.id} was set aside by Arturo: ${lockedAtFinish}`
    );
    addNotification(
      "warn",
      `Result set aside: ${finished.id}`,
      `The result of Task ${finished.id} was set aside by Arturo and can't be used: ${lockedAtFinish}`,
      finished.id
    );
    settleDelegationForJob(finished);
    // Nothing goes on from a result set aside, so its next step is closed.
    if (claimNextAction("after-completion", finished.id) === "claimed") finishNextAction("after-completion", finished.id);
    return finished;
  }

  const eventType =
    finished.status === "completed"
      ? "job.completed"
      : "job.failed";

  const eventLevel =
    finished.status === "completed"
      ? "success"
      : "error";

  if (
    finished.status ===
    "completed"
  ) {
    const resolvedKernelCall =
      resolveKernelCallForJob(
        finished,
        kernelCallResolver
      );

    const reviewLoopHandled =
      resolvedKernelCall
        ? false
        : handleCompletedReviewLoopDecision(
            finished
          );

    if (
      !resolvedKernelCall &&
      !reviewLoopHandled
    ) {
      queueNextWorkflowStep(
        finished
      );
    }
  } else {
    updateRunStepStatusByJobId(
      finished.id,
      "failed"
    );

    if (finished.workflowRunId) {
      refreshWorkflowRunStatus(
        finished.workflowRunId
      );

      appendRunEvent(
        finished.workflowRunId,
        createRuntimeEvent(
          "workflow.step.failed",
          "error",
          `Workflow step failed: ${finished.task}`
        )
      );
    }
  }

  const receipt =
    createCapabilityReceipt(
      finished
    );

  if (receipt) {
    addCapabilityReceipt(
      receipt
    );
  }

  const attestation =
    createCapabilityAttestation(
      finished,
      getEffectiveModelName()
    );

  if (attestation) {
    addCapabilityAttestation(
      attestation
    );
  }

  addNotification(
    eventLevel,
    createJobNotificationTitle(
      finished.status,
      finished
    ),
    createJobNotificationMessage(
      finished.status,
      finished
    ),
    finished.id
  );

  broadcaster(
    eventType,
    eventLevel,
    createJobEventMessage(
      finished.status,
      finished
    )
  );

  settleDelegationForJob(finished);

  // The completion hooks run under the next-step record written with the
  // completion (runtime/nextActions.ts): claimed once here, marked done after,
  // and replayed at start-up if Arturo stopped before they finished.
  if (finished.status === "completed") {
    const claim = claimNextAction("after-completion", finished.id);
    if (claim !== "taken") {
      await runAfterCompletion(finished, broadcaster);
      if (claim === "claimed") finishNextAction("after-completion", finished.id);
    }
  } else {
    await measureRuntimeJobOutcome(
      finished
    );
  }

  return finished;
}

/**
 * What follows a completed Task: its Events, passing it on or its route's next
 * step, and the outcome path. Each keeps its own one-time claim, so running
 * this again after a restart finishes what was missed and repeats nothing.
 *
 * SIDE EFFECT: May publish Events, create Tasks and call a model.
 */
export async function runAfterCompletion(
  finished: Job,
  broadcaster: RuntimeBroadcaster =
    broadcastEvent
): Promise<void> {
  try {
    const eventRuleEvaluations =
      await publishConfiguredEventsForCompletedJob(
        finished
      );

    for (
      const evaluation of
        eventRuleEvaluations
    ) {
      if (
        evaluation.status ===
        "published"
      ) {
        broadcaster(
          "event.rule.published",
          "success",
          `Event rule ${evaluation.rule.id} published ${evaluation.rule.publishedEventLabel} from completed Task ${finished.id}`
        );
      } else if (
        evaluation.status ===
        "skipped"
      ) {
        broadcaster(
          "event.rule.skipped",
          "warn",
          `Event rule ${evaluation.rule.id} did not publish for Task ${finished.id}: ${evaluation.reason}`
        );
      }
    }
  } catch (error) {
    broadcaster(
      "event.rule.failed",
      "error",
      `Post-Task Event evaluation failed for completed Task ${finished.id}: ${
        error instanceof Error
          ? error.message
          : String(
              error
            )
      }`
    );
  }

  // A business function's own rule, or the choice made for this task, may send
  // the result to another business function's AI worker to be checked before a
  // person signs it off (resultPassOn.ts). Loaded here, not at the top, because
  // it creates the check through createTask.
  {
    try {
      const { deliverPassOn } = await import("./resultPassOn");
      const passed = deliverPassOn(finished);
      if (passed && "sent" in passed) {
        broadcaster("job.queued", "info", `Task ${finished.id} was passed on, as Task ${passed.sent}`);
      } else if (passed && "stopped" in passed) {
        broadcaster("job.pass_on_stopped", "warn", `Task ${finished.id} was not passed on: ${passed.stopped}`);
      }
    } catch (error) {
      broadcaster("job.pass_on_failed", "error", `Passing on Task ${finished.id} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await measureRuntimeJobOutcome(
    finished
  );
}

/**
 * Runs every next step not marked done: the completion hooks of a Task that
 * finished, and what follows a sign-off. A Task no longer completed, or set
 * aside, has nothing to follow it and its step is closed.
 *
 * SIDE EFFECT: Replays next steps; may create Tasks and call a model.
 */
export async function replayUnfinishedNextSteps(
  broadcaster: RuntimeBroadcaster =
    broadcastEvent
): Promise<number> {
  return replayNextActions({
    "after-completion": async (action) => {
      const job = getJob(action.sourceJobId);
      if (!job || job.status !== "completed" || readResultSetAsideStanding(job).state === "set_aside") return;
      broadcaster("runtime.next_step.replayed", "info", `Task ${job.id} finished before Arturo stopped; what follows it is running now.`);
      await runAfterCompletion(job, broadcaster);
    },
    "after-sign-off": async (action) => {
      const job = getJob(action.sourceJobId);
      if (!job || !action.by) return;
      const { runAfterSignOff } = await import("../task/taskSignOff");
      broadcaster("runtime.next_step.replayed", "info", `Task ${job.id} was signed off before Arturo stopped; what follows the sign-off is running now.`);
      runAfterSignOff(job, action.by);
    },
    // A claim, not a step: nothing to run again.
    "outcome-follow-on": () => undefined,
    "event-task": () => undefined,
  });
}

/**
 * Returns whether a processed job should pause runtime draining.
 *
 * @param job Processed job.
 * @returns True when workflow execution should pause for human input.
 *
 * PURE: No side effects.
 */
export function shouldPauseRuntimeDrain(
  job: Job
): boolean {
  return (
    job.status === "awaiting_review" ||
    job.status === "awaiting_approval" ||
    job.status === "awaiting_human_task" ||
    job.status === "awaiting_revision"
  );
}

/**
 * Processes queued jobs until no immediately runnable job remains.
 *
 * @param kernelCallResolver Optional resolver for kernel continuation calls.
 * @returns void
 *
 * SIDE EFFECT:
 * - Schedules asynchronous runtime work.
 * - Mutates runtime busy state.
 * - Processes queued jobs.
 * - Broadcasts runtime events.
 */
export function wakeWorkerRuntime(
  kernelCallResolver?: KernelCallResolver
): void {
  setTimeout(
    async () => {
      if (runtimeState.busy) {
        return;
      }

      runtimeState =
        markWorkerRuntimeBusy(
          runtimeState
        );

      try {
        let processed:
          | Job
          | undefined =
          undefined;

        do {
          processed =
            await processNextQueuedJob(
              broadcastEvent,
              kernelCallResolver
            );
        } while (
          processed &&
          !shouldPauseRuntimeDrain(
            processed
          )
        );
      } catch (err: unknown) {
        console.error(
          "Worker runtime wake error",
          err
        );
      } finally {
        runtimeState =
          markWorkerRuntimeIdle(
            runtimeState
          );
      }
    },
    0
  );
}

/**
 * Starts the background worker runtime loop.
 *
 * @param kernelCallResolver Optional resolver for kernel continuation calls.
 * @returns void
 *
 * SIDE EFFECT: Starts an interval that processes queued jobs.
 */
export function recoverAwaitingApprovalChains(): number {
  let recovered = 0;
  for (const persistedJob of listJobs()) {
    const job =
      persistedJob.status === "awaiting_approval"
        ? repairInvalidCapabilityRouting(persistedJob)
        : persistedJob;

    if (job.status === "awaiting_approval") {
      const existingChain = getApprovalChain(job.id);
      const governanceDecision = evaluateJobGovernance(job);

      if (!existingChain) {
        createJobApprovalChain(
          job.id,
          job.requiredApprovals ?? 1,
          job.approvalPolicy,
          governanceDecision?.effect === "require-approval"
            ? governanceDecision.matchedRuleId
            : undefined
        );
        recovered += 1;
      } else if (
        !existingChain.governancePolicyId &&
        governanceDecision?.effect === "require-approval"
      ) {
        storeApprovalChain({
          ...existingChain,
          governancePolicyId: governanceDecision.matchedRuleId,
        });
        recovered += 1;
      }
    }
  }
  return recovered;
}

export function startWorkerRuntime(
  kernelCallResolver?: KernelCallResolver
): void {
  if (runtimeState.started) {
    return;
  }

  recoverAwaitingApprovalChains();

  // Steps that should have followed a completion or a sign-off before Arturo
  // stopped are run now (C2). Each keeps its own one-time claim.
  void replayUnfinishedNextSteps().catch((error: unknown) => {
    broadcastEvent("runtime.next_step.replay_failed", "error", `Replaying unfinished next steps failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  runtimeState =
    markWorkerRuntimeStarted(
      runtimeState
    );

  verboseLog(
    "Worker runtime started"
  );

  setInterval(
    async () => {
      if (runtimeState.busy) {
        return;
      }

      runtimeState =
        markWorkerRuntimeBusy(
          runtimeState
        );

      try {
        await processNextQueuedJob(
          broadcastEvent,
          kernelCallResolver
        );
      } catch (err: unknown) {
        // The operator sees this in their terminal, so it has to read like
        // everything else Arturo says. A Node stack trace tells them nothing
        // they can act on and looks like a crash. The detail still goes to the
        // verbose log for whoever is debugging.
        broadcastEvent(
          "runtime.error",
          "error",
          `The Worker runtime hit a problem and skipped that Task: ${getRuntimeErrorMessage(err, "unknown error")}`
        );
        verboseLog(
          `Worker runtime error: ${
            err instanceof Error ? err.stack ?? err.message : String(err)
          }`
        );
      } finally {
        runtimeState =
          markWorkerRuntimeIdle(
            runtimeState
          );
      }
    },
    500
  );
}
