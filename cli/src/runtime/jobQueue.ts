import type {
  WorkflowExecutionPlan,
} from "../agents/workflowExecution";

import {
  clearPersistedJobs,
  loadJobs,
  saveJob,
} from "../storage/jobRepository";

import type {
  WorkerCapability,
} from "../control/workers";

import {
  createJobApprovalChain,
} from "./approvalRuntime";

import type {
  ApprovalPolicy,
} from "./approvalPolicy";

import {
  createDecisionToken,
} from "./decisionToken";

import {
  refuseWorkUnderLocks,
} from "../work/workLocks";

import { runtimeDb } from "../storage/runtimeDatabase";

import { clearNextActions, recordNextAction } from "./nextActions";
import { revokeOffTerminalLinksForJob } from "../offterminal/offTerminalLinks";
import { notifyOffTerminalResultReady } from "../offterminal/signOffEmail";

export type JobStatus =
  | "scheduled"
  | "queued"
  | "running"
  | "awaiting_review"
  | "awaiting_approval"
  | "awaiting_human_task"
  | "awaiting_artefact_approval"
  | "awaiting_revision"
  | "completed"
  | "failed"
  // Stopped before it started, because "no AI" was turned on or the work
  // became locked (work/workChanges.ts, the start check in workerRuntime).
  // Never runs, and is never resumed.
  | "cancelled";

/** Statuses a Task can be cancelled from: it has not started. */
export const CANCELLABLE_JOB_STATUSES: readonly JobStatus[] = [
  "scheduled",
  "queued",
  "awaiting_approval",
  "awaiting_review",
  "awaiting_artefact_approval",
];

export type JobCapability =
  | WorkerCapability
  | "human-review";


export type ReviewLoopJobMetadata = {
  readonly loopId: string;
  readonly draftWorkerName: string;
  readonly criticWorkerName: string;
  readonly decisionWorkerName: string;
  readonly attempt: number;
  readonly maxAttempts: number;
};

export type HumanTaskRevisionMetadata = {
  readonly sourceHumanTaskId: string;
  readonly sourceHumanJobId: string;
  readonly revisionInstructions: string;
};

export type Job = {
  id: string;
  task: string;
  owningJobId?: string;
  worker?: string;
  reviewToken?: string;
  requiredCapabilities?: JobCapability[];
  selectedWorker?: string;
  routingReason?: string;
  workflowRunId?: string;
  workflowName?: string;
  workflowStepIndex?: number;
  workflowStepCount?: number;
  workflowBaseTask?: string;
  workflowCapabilities?: JobCapability[];
  workflowPlan?: WorkflowExecutionPlan;
  enterpriseId?: string;
  // The Business Function this Task belongs to. Previously discoverable only by
  // scanning a *running* Function's jobIds, so a Task on a Function that had
  // never been started could not be attributed to it at all — which is how
  // Function-scoped governance had nothing to match on.
  businessFunctionId?: string;
  /**
   * The completed Task whose result caused this one to exist.
   *
   * Set when a running Function creates a Task in response to an Event that a
   * job-completion rule published. Without it the new Task carries only the
   * instruction the model wrote, and the Worker is asked to review work it was
   * never given — measured: an Editorial Review Task answered "there is no
   * work provided for me to review".
   *
   * The id is stored, not the text. Resolving it at execution keeps the
   * upstream result current if it changes, rather than freezing a copy into
   * the instruction the way the Supplied Artefacts block once did.
   */
  sourceTaskId?: string;
  /**
   * A finished Human Task whose notes this Task works from.
   *
   * The mirror of sourceTaskId. A person is the instrument for anything a
   * model cannot observe -- an inspection, a drop test, a count on a shelf --
   * and until this existed the only way to get what they found into an AI
   * Task was for the operator to retype it into the instruction. Blueprint 3
   * did exactly that while claiming the AI was "given the person's findings
   * verbatim"; the operator was the carrier, and any transcription error or
   * omission was theirs and invisible.
   *
   * The id is stored, not the notes, for the same reason as above.
   */
  sourceHumanTaskId?: string;
  /**
   * The person who asked for this work, as they named themselves when asking.
   * Absent for work started before this was recorded, and for follow-on work
   * Arturo created itself.
   */
  requestedBy?: string;
  /** The client this work is for. Their record is quoted in the Task's text as it was when the work was asked for. */
  clientId?: string;
  /**
   * The named piece of work (work/workStore.ts) this Task belongs to: a
   * matter, a book or a deal. Set once when the Task is created and never
   * changed (replaceJob refuses), and carried by every path that rebuilds a
   * Task from this one (task/carriedTaskArgs.ts).
   */
  workId?: string;
  /** When it was cancelled, for a cancelled Task. */
  cancelledAt?: number;
  /**
   * How many generations of automatic follow-on work produced this Task.
   *
   * A Task the operator asked for is absent/0. One a Function created from a
   * completed result is 1, and so on. Bounded by MAX_CHAIN_DEPTH (runtime/chainLimits.ts) so a
   * chain cannot run indefinitely: until this existed, nothing anywhere in
   * runtime/ or events/ limited how far Arturo could carry on by itself, and
   * the only brake was a gate that refused to act on unverified output at all.
   */
  followUpDepth?: number;
  scheduledOccurrenceAt?: number;
  webSearchQuery?: string;
  inputArtefactRefs?: string[];
  artefactApprovalDependencies?: string[];
  // Lean reference to a versioned, governed Procedure (proc-<id>@<version>) that
  // supplies how to perform the Task. Instructions are never inlined here.
  procedureRef?: string;

  reviewLoop?: ReviewLoopJobMetadata;

  kernelCallId?: string;
  status: JobStatus;
  rawOutput?: string;
  output?: string;
  createdAt: number;
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  approvalRequestedAt?: number;
  requiredApprovals?: number;
  approvalPolicy?: ApprovalPolicy;
  approvedAt?: number;
  rejectedAt?: number;
  error?: string;
  revisionRequestedAt?: number;
  revisionInstructions?: string;

  humanTaskRevision?: HumanTaskRevisionMetadata;

};

export type JobRoutingMetadata = {
  owningJobId?: string;
  requiredCapabilities?: JobCapability[];
  selectedWorker?: string;
  routingReason?: string;
  workflowRunId?: string;
  workflowName?: string;
  workflowStepIndex?: number;
  workflowStepCount?: number;
  workflowBaseTask?: string;
  workflowCapabilities?: JobCapability[];
  workflowPlan?: WorkflowExecutionPlan;
  enterpriseId?: string;
  businessFunctionId?: string;
  sourceTaskId?: string;
  sourceHumanTaskId?: string;
  /**
   * The person who asked for this work, as they named themselves when asking.
   * Absent for work started before this was recorded, and for follow-on work
   * Arturo created itself.
   */
  requestedBy?: string;
  /** The client this work is for. Their record is quoted in the Task's text as it was when the work was asked for. */
  clientId?: string;
  /** The named piece of work this Task belongs to, set once. */
  workId?: string;
  followUpDepth?: number;
  webSearchQuery?: string;
  inputArtefactRefs?: string[];
  artefactApprovalDependencies?: string[];
  procedureRef?: string;
  reviewLoop?: ReviewLoopJobMetadata;
  kernelCallId?: string;
  requiredApprovals?: number;
  approvalPolicy?: ApprovalPolicy;
  humanTaskRevision?: HumanTaskRevisionMetadata;
};

/**
 * Recovers a job that was interrupted while running.
 *
 * @param job Job to recover.
 * @returns Re-queued job when interrupted, otherwise original job.
 *
 * PURE: No side effects.
 */
export function recoverInterruptedJob(
  job: Job
): Job {
  if (job.status !== "running") {
    return job;
  }

  return {
    ...job,
    status: "queued",
    error: "Recovered after runtime restart",
  };
}

/**
 * Recovers all interrupted jobs.
 *
 * @param loadedJobs Loaded jobs.
 * @returns Jobs with running jobs re-queued.
 *
 * PURE: No side effects.
 */
export function recoverInterruptedJobs(
  loadedJobs: Job[]
): Job[] {
  return loadedJobs.map(
    recoverInterruptedJob
  );
}

let jobs: Job[] =
  recoverInterruptedJobs(
    loadJobs()
  );

jobs.forEach(
  saveJob
);

/**
 * Creates a job record.
 *
 * @param task Job task.
 * @param worker Optional worker name.
 * @param now Creation timestamp.
 * @param id Job id.
 * @param routing Routing metadata.
 * @param reviewToken Optional review token.
 * @returns New queued job.
 *
 * PURE: No side effects.
 */
export function createJobRecord(
  task: string,
  worker: string | undefined,
  now: number,
  id: string,
  routing: JobRoutingMetadata = {},
  reviewToken?: string
): Job {
  return {
    id,
    task,
    owningJobId:
      routing.owningJobId,
    worker,
    reviewToken,
    requiredCapabilities:
      routing.requiredCapabilities,
    selectedWorker:
      routing.selectedWorker,
    routingReason:
      routing.routingReason,
    workflowRunId:
      routing.workflowRunId,
    workflowName:
      routing.workflowName,
    workflowStepIndex:
      routing.workflowStepIndex,
    workflowStepCount:
      routing.workflowStepCount,
    workflowBaseTask:
      routing.workflowBaseTask,
    workflowCapabilities:
      routing.workflowCapabilities,
    workflowPlan:
      routing.workflowPlan,
    enterpriseId:
      routing.enterpriseId,
    businessFunctionId:
      routing.businessFunctionId,
    sourceTaskId:
      routing.sourceTaskId,
    sourceHumanTaskId:
      routing.sourceHumanTaskId,
    requestedBy:
      routing.requestedBy,
    clientId:
      routing.clientId,
    workId:
      routing.workId,
    followUpDepth:
      routing.followUpDepth,
    webSearchQuery:
      routing.webSearchQuery,
    inputArtefactRefs:
      routing.inputArtefactRefs,
    artefactApprovalDependencies:
      routing.artefactApprovalDependencies,
    procedureRef:
      routing.procedureRef,
    reviewLoop:
      routing.reviewLoop,
    kernelCallId:
      routing.kernelCallId,
    requiredApprovals:
      routing.requiredApprovals,
    approvalPolicy:
      routing.approvalPolicy,
    status: "queued",
    createdAt: now,
    assignedAt: worker ? now : undefined,
    humanTaskRevision:
    routing.humanTaskRevision,
  };
}

/**
 * Creates a Task that is dormant until a Task schedule makes an occurrence due.
 *
 * SIDE EFFECT:
 * - Mutates module-level job queue.
 * - Persists the Task.
 */
export function enqueueScheduledJob(
  task: string,
  routing: JobRoutingMetadata = {}
): Job {
  const job = {
    ...createJobRecord(
      task,
      undefined,
      Date.now(),
      createReadableJobId(
        jobs.map((existing) => existing.id)
      ),
      routing
    ),
    status: "scheduled" as const,
  };

  jobs = [
    ...jobs,
    job,
  ];

  persistJobs();

  return job;
}

/**
 * Queues a dormant or completed recurring Task for one due occurrence.
 * The Worker runtime, rather than the scheduler, changes it to running.
 *
 * PURE: No side effects.
 */
export function queueScheduledTaskOccurrence(
  job: Job,
  worker: string,
  routingReason: string,
  scheduledOccurrenceAt: number,
  now: number
): Job {
  if (
    job.status !==
    "scheduled" &&
    job.status !==
    "completed"
  ) {
    throw new Error(
      `Task must be scheduled or completed before it can be queued: ${job.id}`
    );
  }

  return {
    ...job,
    worker,
    selectedWorker:
      worker,
    routingReason,
    status: "queued",
    rawOutput: undefined,
    output: undefined,
    error: undefined,
    assignedAt: now,
    startedAt: undefined,
    completedAt: undefined,
    failedAt: undefined,
    scheduledOccurrenceAt,
  };
}

/**
 * Checks whether routing metadata requires human review.
 *
 * @param routing Routing metadata.
 * @returns True when human review is required.
 *
 * PURE: No side effects.
 */
export function requiresHumanReview(
  routing: JobRoutingMetadata
): boolean {
  return (
    routing.requiredCapabilities ??
    []
  ).includes(
    "human-review"
  );
}

/**
 * Marks a job as running.
 *
 * @param job Job to update.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobRunning(
  job: Job,
  now: number
): Job {
  return {
    ...job,
    status: "running",
    startedAt: now,
  };
}

/**
 * Marks a job as awaiting review.
 *
 * @param job Job to update.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobAwaitingReview(
  job: Job,
  now: number
): Job {
  return {
    ...job,
    status: "awaiting_review",
    approvalRequestedAt: now,
  };
}

/**
 * Marks a job as awaiting approval.
 *
 * @param job Job to update.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobAwaitingApproval(
  job: Job,
  now: number
): Job {
  return {
    ...job,
    status: "awaiting_approval",
    approvalRequestedAt: now,
  };
}

/**
 * Marks a job as awaiting human task completion.
 *
 * @param job Job to update.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobAwaitingHumanTask(
  job: Job,
  now: number
): Job {
  return {
    ...job,
    status: "awaiting_human_task",
    approvalRequestedAt: now,
  };
}

/**
 * Marks a job as awaiting revision from another worker.
 *
 * @param job Job to update.
 * @param instructions Revision instructions.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobAwaitingRevision(
  job: Job,
  instructions: string,
  now: number
): Job {
  return {
    ...job,
    status:
      "awaiting_revision",
    revisionInstructions:
      instructions,
    revisionRequestedAt:
      now,
  };
}

/**
 * Marks a job as completed.
 *
 * @param job Job to update.
 * @param rawOutput Raw output.
 * @param outputOrNow Output string or timestamp.
 * @param maybeNow Optional timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobCompleted(
  job: Job,
  rawOutput: string,
  outputOrNow: string | number,
  maybeNow?: number
): Job {
  const output =
    typeof outputOrNow === "number"
      ? rawOutput
      : outputOrNow;

  const now =
    typeof outputOrNow === "number"
      ? outputOrNow
      : maybeNow;

  return {
    ...job,
    status: "completed",
    rawOutput,
    output,
    completedAt: now,
  };
}

/**
 * Marks a job as approved and completed.
 *
 * @param job Job to update.
 * @param output Approval output.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobApproved(
  job: Job,
  output: string,
  now: number
): Job {
  return {
    ...job,
    status: "completed",
    rawOutput: output,
    output,
    approvedAt: now,
    completedAt: now,
  };
}

/**
 * Marks a job as rejected.
 *
 * @param job Job to update.
 * @param reason Rejection reason.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobRejected(
  job: Job,
  reason: string,
  now: number
): Job {
  return {
    ...job,
    status: "failed",
    error: reason,
    rejectedAt: now,
    failedAt: now,
  };
}

/**
 * Marks a job as failed.
 *
 * @param job Job to update.
 * @param error Failure reason.
 * @param now Timestamp.
 * @returns Updated job.
 *
 * PURE: No side effects.
 */
export function markJobFailed(
  job: Job,
  error: string,
  now: number
): Job {
  return {
    ...job,
    status: "failed",
    error,
    failedAt: now,
  };
}

/**
 * Persists all current jobs.
 *
 * @returns void
 *
 * SIDE EFFECT: Writes jobs to persistent storage.
 */
function persistJobs(): void {
  jobs.forEach(
    saveJob
  );
}

/**
 * Enqueues a new job.
 *
 * @param task Job task.
 * @param worker Optional worker name.
 * @param routing Routing metadata.
 * @returns Created job.
 *
 * SIDE EFFECT:
 * - Mutates module-level job queue.
 * - Persists jobs.
 * - May create approval chain.
 */
export function enqueueJob(
  task: string,
  worker?: string,
  routing: JobRoutingMetadata = {}
): Job {
  const token =
    requiresHumanReview(routing)
      ? createDecisionToken()
      : undefined;

  const job =
    createJobRecord(
      task,
      worker,
      Date.now(),
      createReadableJobId(
        jobs.map((existing) => existing.id)
      ),
      routing,
      token
    );

  jobs = [
    ...jobs,
    job,
  ];

  persistJobs();

  if (
    requiresHumanReview(
      routing
    )
  ) {
    createJobApprovalChain(
      job.id,
      routing.requiredApprovals ?? 1,
      routing.approvalPolicy
    );
  }

  return job;
}

/**
 * Replaces an existing job.
 *
 * @param updated Updated job.
 * @returns Updated job.
 *
 * SIDE EFFECT:
 * - Mutates module-level job queue.
 * - Persists jobs.
 */
export function replaceJob(
  updated: Job
): Job {
  const previous = getJob(updated.id);
  // One piece of work per Task, set once (brief story 1). One check here
  // covers every caller that rewrites a Task.
  if (previous && (previous.workId ?? undefined) !== (updated.workId ?? undefined)) {
    throw new Error(`A Task's work can't change: ${updated.id}`);
  }
  const normalizedUpdated =
    updated.worker && !updated.assignedAt && !previous?.assignedAt
      ? {
          ...updated,
          assignedAt: Date.now(),
        }
      : updated;

  jobs = jobs.map((job) =>
    job.id === updated.id
      ? normalizedUpdated
      : job
  );

  persistJobs();

  if (previous && previous.output !== normalizedUpdated.output) {
    revokeOffTerminalLinksForJob(normalizedUpdated.id);
  }

  if (
    normalizedUpdated.status === "completed" &&
    normalizedUpdated.output !== undefined &&
    (previous?.status !== "completed" || previous.output !== normalizedUpdated.output)
  ) {
    notifyOffTerminalResultReady(normalizedUpdated);
  }

  return normalizedUpdated;
}

/**
 * Gets a job by id.
 *
 * @param id Job id.
 * @returns Matching job or undefined.
 *
 * PURE: No side effects.
 */
export function getJob(
  id: string
): Job | undefined {
  return jobs.find(
    (job) => job.id === id
  );
}

/**
 * Lists all jobs.
 *
 * @returns Job list copy.
 *
 * PURE: No side effects.
 */
export function listJobs(): Job[] {
  return [
    ...jobs,
  ];
}

/**
 * Gets the next queued job.
 *
 * @returns Next queued job or undefined.
 *
 * PURE: No side effects.
 */
/**
 * The next readable Task id.
 *
 * Tasks were the last record still identified by a raw UUID, so an operator who
 * wanted to inspect or approve one had to copy
 * `6b105cdb-785e-426a-bb25-aa6657cb5c23` from a list, while their Functions
 * were `t-s-heating-ltd:invoicing`. Task ids are not secrets — external review
 * is authorised by a separate 32-byte token, hashed and compared in constant
 * time — so nothing depends on them being unguessable.
 *
 * Ids already issued as UUIDs keep working; lookups are exact matches, so the
 * two forms coexist.
 *
 * PURE: No side effects.
 */
export function createReadableJobId(
  existingIds: readonly string[]
): string {
  const used = existingIds.reduce(
    (highest, id) => {
      const match = /^task-(\d+)$/.exec(id);
      return match
        ? Math.max(highest, Number(match[1]))
        : highest;
    },
    0
  );

  return `task-${used + 1}`;
}

export function nextJob():
  Job | undefined {
  return jobs.find(
    (job) =>
      job.status === "queued"
  );
}

/**
 * Whether any Task is waiting its turn or actually being worked on.
 *
 * Only `queued` and `running` count. `scheduled` is a recurring Task lying
 * dormant until its next occurrence is due, so counting it would mean waiting
 * for something that is not going to happen; the `awaiting_*` statuses are
 * excluded for the opposite reason — the work has stopped and is resting on a
 * person, and the next thing typed is what releases it.
 *
 * Used by bot mode to end a wait as soon as the model is finished rather than
 * after a fixed number of seconds.
 *
 * PURE: No side effects.
 */
export function hasWorkInFlight(): boolean {
  return jobs.some(
    (job) =>
      job.status === "queued" ||
      job.status === "running"
  );
}

/**
 * Requests review for a job.
 *
 * @param id Job id.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function requestJobReview(
  id: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  return replaceJob(
    markJobAwaitingReview(
      job,
      Date.now()
    )
  );
}

/**
 * Requests approval for a job.
 *
 * @param id Job id.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function requestJobApproval(
  id: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  // A held Task carries a decision token, as a Human review always has, so a
  // review link can be issued for it. The token alone decides nothing: a link
  // must also name its reviewer under HMAC and the reviewer must be signed in.
  return replaceJob({
    ...markJobAwaitingApproval(
      job,
      Date.now()
    ),
    reviewToken:
      job.reviewToken ?? createDecisionToken(),
  });
}

/**
 * Requests human task completion for a job.
 *
 * @param id Job id.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function requestJobHumanTask(
  id: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  return replaceJob(
    markJobAwaitingHumanTask(
      job,
      Date.now()
    )
  );
}

/**
 * Requests revision for a job.
 *
 * @param id Job id.
 * @param instructions Revision instructions.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function requestJobRevision(
  id: string,
  instructions: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  return replaceJob(
    markJobAwaitingRevision(
      job,
      instructions,
      Date.now()
    )
  );
}

/**
 * Whether a person's approve or reject can be applied to this Task now.
 *
 * `approveJob` and `rejectJob` enforce it; a decision surface asks it first, so
 * it can refuse before recording anything instead of failing half-way.
 *
 * PURE: No side effects.
 */
export function isAwaitingHumanDecision(
  job: Pick<Job, "status">
): boolean {
  return (
    job.status === "awaiting_approval" ||
    job.status === "awaiting_review"
  );
}

/**
 * Approves an awaiting job.
 *
 * @param id Job id.
 * @param output Approval output.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function approveJob(
  id: string,
  output = "Approved"
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  if (!isAwaitingHumanDecision(job)) {
    throw new Error(
      `Task is not awaiting approval or review: ${id}`
    );
  }

  return replaceJob(
    markJobApproved(
      job,
      output,
      Date.now()
    )
  );
}

/**
 * Rejects an awaiting job.
 *
 * @param id Job id.
 * @param reason Rejection reason.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function rejectJob(
  id: string,
  reason: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  if (!isAwaitingHumanDecision(job)) {
    throw new Error(
      `Task is not awaiting approval or review: ${id}`
    );
  }

  return replaceJob(
    markJobRejected(
      job,
      reason,
      Date.now()
    )
  );
}

/**
 * Starts a job.
 *
 * @param id Job id.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function startJob(
  id: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  // Backstop for every caller: work-bound Tasks are checked again when they
  // start, so a path that skips the worker runtime's own check (which cancels
  // instead) still cannot start one under "no AI" or a lock.
  const locked =
    refuseWorkUnderLocks({
      workId: job.workId,
      enterpriseId: job.enterpriseId,
      functionId: job.businessFunctionId,
      when: "start",
      taskCreatedAt: job.createdAt,
    });
  if (locked) {
    throw new Error(
      `${locked} ${id} was not started.`
    );
  }

  return replaceJob(
    markJobRunning(
      job,
      Date.now()
    )
  );
}

/**
 * Marks a Task cancelled. Only from a status where it has not started.
 *
 * PURE: No side effects.
 */
export function markJobCancelled(
  job: Job,
  reason: string,
  now: number
): Job {
  if (!CANCELLABLE_JOB_STATUSES.includes(job.status)) {
    throw new Error(
      `${job.id} has already started or finished (${job.status}), so it cannot be cancelled.`
    );
  }
  return {
    ...job,
    status: "cancelled",
    error: reason,
    cancelledAt: now,
  };
}

/**
 * Cancels a Task that has not started. Throws for any other.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function cancelJob(
  id: string,
  reason: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  return replaceJob(
    markJobCancelled(
      job,
      reason,
      Date.now()
    )
  );
}

/**
 * Completes a job.
 *
 * @param id Job id.
 * @param rawOutput Raw output.
 * @param output Output.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function completeJob(
  id: string,
  rawOutput: string,
  output = rawOutput
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  // The completion and the step that must follow it are written together
  // (C2), so a stop between the two cannot leave a finished Task that never
  // moves on: start-up replays any step not marked done (runtime/nextActions.ts).
  const now = Date.now();
  return runtimeDb.transaction(() => {
    const completed = replaceJob(
      markJobCompleted(
        job,
        rawOutput,
        output,
        now
      )
    );
    recordNextAction("after-completion", completed.id, now);
    return completed;
  })();
}

/**
 * Completes a job from human task evidence.
 *
 * @param id Job id.
 * @param output Human task completion evidence.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function completeJobFromHumanTask(
  id: string,
  output: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  if (
    job.status !==
    "awaiting_human_task"
  ) {
    throw new Error(
      `Task is not awaiting Human Task completion: ${id}`
    );
  }

  return replaceJob(
    markJobCompleted(
      job,
      output,
      output,
      Date.now()
    )
  );
}

/**
 * Fails a job.
 *
 * @param id Job id.
 * @param error Failure reason.
 * @returns Updated job.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function failJob(
  id: string,
  error: string
): Job {
  const job =
    getJob(id);

  if (!job) {
    throw new Error(
      `Task not found: ${id}`
    );
  }

  return replaceJob(
    markJobFailed(
      job,
      error,
      Date.now()
    )
  );
}

/**
 * Clears all jobs.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears module-level job queue.
 * - Clears persisted jobs.
 */
export function clearJobs():
  void {
  jobs = [];
  clearPersistedJobs();
  // A next step belongs to its Task; ids are used again once Tasks are cleared.
  clearNextActions();
}

export const jobQueue = {
  get jobs() {
    return listJobs();
  },

  enqueue(task: string) {
    return enqueueJob(task);
  },

  next() {
    return nextJob();
  },

  clear() {
    clearJobs();
  },
};
