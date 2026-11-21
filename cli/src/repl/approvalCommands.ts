import {
  getJob,
  approveJob,
  failJob,
} from "../runtime/jobQueue";

import {
  designatedApproversForFunction,
  formatApproverRefusal,
  mayDecideForFunction,
} from "../staffing/functionApprovers";

import {
  isApprovalCapableMode,
} from "../control/humanWorkerMode";

import {
  queueNextWorkflowStep,
} from "../runtime/workerRuntime";

import {
  updateRunStepStatusByJobId,
  refreshWorkflowRunStatus,
} from "../runtime/workflowRunStore";

import {
  approveJobInChain,
  refuseApprovalRelease,
  rejectJobInChain,
} from "../runtime/approvalRuntime";

import {
  approvalDecisionKind,
  isGovernedExecutionJob,
  releaseApprovedJob,
} from "../runtime/approvedJobRelease";

import {
  getApprovalChain,
} from "../runtime/approvalChainStore";

import {
  formatApprovalChain,
} from "../runtime/approvalFormatter";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  listWorkers,
} from "../control/workers";

import {
  parseArtefactReference,
} from "../artefacts/artefact";

import {
  getArtefactVersion,
  reviewArtefactVersion,
} from "../artefacts/artefactStore";

/**
 * What an approval or rejection did, for any surface that offers one.
 *
 * `recorded` means a signed decision was added to the Task's approval chain;
 * `released` means approved work was let start (or a review was cleared).
 * A decision can be recorded without releasing anything, when the chain still
 * needs another approver. `message` is exactly what the terminal prints.
 */
export type ApprovalDecisionOutcome = {
  readonly recorded: boolean;
  readonly released: boolean;
  readonly message: string;
};

/** Validates that a Human is reviewing the exact versions assigned to them. */
/**
 * Refuses a decision from someone the staffing plan did not make accountable.
 *
 * Returns the message to show, or undefined when the decision may proceed.
 *
 * SIDE EFFECT: Reads the staffing assignment store.
 */
export function refuseUndesignatedApprover(
  job: ReturnType<typeof getJob>,
  workerName: string,
  decision: "approve" | "reject"
): string | undefined {
  const designated =
    designatedApproversForFunction(
      job?.businessFunctionId
    );

  return mayDecideForFunction(
    designated,
    workerName
  )
    ? undefined
    : formatApproverRefusal(
        designated,
        workerName,
        decision
      );
}

export function validateJobArtefactReviewer(
  job: ReturnType<
    typeof getJob
  >,
  reviewer: string
): void {
  const reviewReferences =
    job?.artefactApprovalDependencies ??
    job?.inputArtefactRefs ??
    [];

  if (
    !job ||
    !reviewReferences.length ||
    !(
      job.requiredCapabilities ??
      []
    ).includes(
      "human-review"
    )
  ) {
    return;
  }

  reviewReferences.forEach(
    (value) => {
      const version =
        getArtefactVersion(
          parseArtefactReference(
            value
          )
        );
      if (!version) {
        throw new Error(
          `Artefact version not found: ${value}`
        );
      }
      if (
        version.reviewStatus !==
          "awaiting_review" &&
        version.reviewStatus !==
          "approved"
      ) {
        throw new Error(
          `Artefact version is not awaiting review: ${value} (${version.reviewStatus})`
        );
      }
      if (
        version.reviewer &&
        version.reviewer.toLowerCase() !==
          reviewer.toLowerCase()
      ) {
        throw new Error(
          `Artefact review is assigned to ${version.reviewer}, not ${reviewer}.`
        );
      }
    }
  );
}

/** Records the review Job's Human decision against every exact Artefact. */
export function recordJobArtefactDecision(
  job: NonNullable<
    ReturnType<
      typeof getJob
    >
  >,
  reviewer: string,
  decision:
    | "approved"
    | "rejected",
  notes: string
): void {
  const reviewReferences =
    job.artefactApprovalDependencies ??
    job.inputArtefactRefs ??
    [];

  if (
    !reviewReferences.length ||
    !(
      job.requiredCapabilities ??
      []
    ).includes(
      "human-review"
    )
  ) {
    return;
  }

  reviewReferences.forEach(
    (value) => {
      const reference =
        parseArtefactReference(
          value
        );
      const version =
        getArtefactVersion(
          reference
        );
      if (
        version?.reviewStatus ===
        "approved"
      ) {
        return;
      }
      reviewArtefactVersion(
        reference,
        {
          decision,
          reviewer,
          notes,
        }
      );
    }
  );
}

export type ApprovalCommandIdentity = {
  workerName: string;
  remainingArgs: readonly string[];
};

/**
 * Resolves the registered human responsible for an approval decision.
 * A sole eligible human is selected automatically. Multiple eligible humans
 * require an explicit `--as <name>` argument.
 *
 * PURE: Reads the registered worker list and validates command arguments.
 */
export function resolveApprovalCommandIdentity(
  args: readonly string[]
): ApprovalCommandIdentity {
  const asIndex = args.indexOf("--as");
  const requestedName =
    asIndex === -1
      ? undefined
      : args[asIndex + 1];

  if (asIndex !== -1 && !requestedName) {
    throw new Error(
      'Usage: add --as "<human-worker-name>"'
    );
  }

  const remainingArgs =
    asIndex === -1
      ? args
      : args.filter(
          (_arg, index) =>
            index !== asIndex &&
            index !== asIndex + 1
        );

  const canApprove = (worker: ReturnType<typeof listWorkers>[number]) =>
    worker.kind === "human" &&
    worker.availability !== "offline" &&
    isApprovalCapableMode(worker.humanMode);

  const eligibleHumans = listWorkers().filter(canApprove);

  if (requestedName) {
    const requested = eligibleHumans.find(
      (worker) =>
        worker.name.toLowerCase() === requestedName.toLowerCase() ||
        worker.displayName?.toLowerCase() === requestedName.toLowerCase()
    );

    if (!requested) {
      // Distinguish "no such identity" from "known identity, but not entitled
      // to approve": they are different security outcomes and an operator
      // debugging one must not be told the other. A single "not found" string
      // for both sends them to re-register someone who is already registered.
      const registered = listWorkers().find(
        (worker) =>
          worker.name.toLowerCase() === requestedName.toLowerCase() ||
          worker.displayName?.toLowerCase() === requestedName.toLowerCase()
      );

      if (!registered) {
        throw new Error(
          `No registered Worker named ${requestedName}. Register one with /add-human-worker, or check /workers for the exact name.`
        );
      }

      if (registered.kind !== "human") {
        throw new Error(
          `${requestedName} is a registered AI Worker, and only a Human can approve. Register a Human with /add-human-worker.`
        );
      }

      if (registered.availability === "offline") {
        throw new Error(
          `${requestedName} is registered as a Human but is marked offline, so cannot approve right now. Set their availability with /add-human-worker, or use another approver.`
        );
      }

      throw new Error(
        `${requestedName} is a registered Human but not an approval-capable Worker (their role does not include approving). Register an approving Human — for example --archetype guardian — with /add-human-worker.`
      );
    }

    return {
      workerName: requested.displayName ?? requested.name,
      remainingArgs,
    };
  }

  if (eligibleHumans.length === 1) {
    const worker = eligibleHumans[0];
    return {
      workerName: worker.displayName ?? worker.name,
      remainingArgs,
    };
  }

  if (eligibleHumans.length === 0) {
    // Distinguish "nobody to approve" from "someone is registered but their role
    // does not include approving". Telling an operator who just added a Human to
    // "add a Human" sends them to repeat the step that did not work; a registered
    // Human in "task" mode needs an approving role, not another registration.
    const registeredHumans = listWorkers().filter(
      (worker) => worker.kind === "human"
    );
    const incapable = registeredHumans.filter(
      (worker) =>
        worker.availability !== "offline" &&
        !isApprovalCapableMode(worker.humanMode)
    );

    if (incapable.length > 0) {
      const names = incapable
        .map((worker) => worker.displayName ?? worker.name)
        .join(", ");
      throw new Error(
        `${names} ${incapable.length === 1 ? "is registered as a Human" : "are registered as Humans"} but not approval-capable (their role does not include approving). Run /add-human-worker to add a person who can approve, then re-run /staff so the plan names them.`
      );
    }

    throw new Error(
      [
        "No one is on record who can approve this yet.",
        "An approval is signed in a named person's name so there's an auditable",
        "record of who allowed the work — Arturo can't assume that's whoever is",
        "at the keyboard. Add that person first, even if it's you: run",
        '/add-human-worker (choose the "approve" role), then run /approve again.',
      ].join(" ")
    );
  }

  throw new Error(
    `Multiple human approvers are available (${eligibleHumans
      .map((worker) => worker.displayName ?? worker.name)
      .join(", ")}). Use --as "<name>".`
  );
}

/**
 * Handles the /approve command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates approval, job, and workflow-run state.
 * - May queue the next workflow step.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
/**
 * Describes an approval attempt for the audit record when identity resolution
 * fails, before a worker name has been resolved. Pulls the Task id and the
 * requested `--as` name straight from the raw args.
 *
 * PURE: No side effects.
 */
export function describeApprovalTarget(
  args: readonly string[]
): string {
  const asIndex = args.indexOf("--as");
  const requestedName =
    asIndex === -1 ? undefined : args[asIndex + 1];
  const taskId = extractApprovalTaskId(args);

  return [
    taskId ? `Task ${taskId}` : "an unspecified Task",
    requestedName ? ` by ${requestedName}` : "",
  ].join("");
}

/**
 * Pulls the Task id from the raw command args, before identity resolution.
 *
 * PURE: No side effects.
 */
export function extractApprovalTaskId(
  args: readonly string[]
): string | undefined {
  const asIndex = args.indexOf("--as");

  return args.find(
    (arg, index) =>
      !arg.startsWith("--") &&
      (asIndex === -1 || index !== asIndex + 1)
  );
}

/**
 * Reports a decision on a Task that does not exist, before any approver
 * identity is resolved.
 *
 * The checks used to run the other way round: `/approve task-99` with no
 * registered approver reported "No available registered human approver",
 * sending the operator off to fix their staffing when the actual problem was
 * a Task id that named nothing. Diagnose the Task first — its absence is
 * independent of who is asking.
 *
 * SIDE EFFECT: Reads the job queue.
 */
export function describeMissingApprovalTask(
  args: readonly string[]
): string | undefined {
  const taskId = extractApprovalTaskId(args);

  if (!taskId || getJob(taskId)) {
    return undefined;
  }

  return `No Task found with id ${taskId}. Check /tasks for the exact id.`;
}

/**
 * Reports a decision asked of a Task that is not waiting for one.
 *
 * A Task that was never gated has no approval chain — and the internal
 * "Approval chain not found" surfaced verbatim, which reads like a broken installation rather than an answer. It
 * also said the same thing whether the Task had completed or the id was simply
 * not one that was ever gated.
 *
 * The distinction matters because approval here authorises work *before* it
 * runs. A completed Task cannot be approved, and the operator wanting to judge
 * its result is asking for something real that lives elsewhere.
 *
 * PURE: Reads the job queue and the chain store.
 */
export function describeTaskNotAwaitingDecision(
  args: readonly string[],
  decision: "approve" | "reject"
): string | undefined {
  const taskId = extractApprovalTaskId(args);

  if (!taskId) return undefined;

  const job = getJob(taskId);
  if (!job) {
    return undefined;
  }

  // A chain outlives the decision it recorded. Its existence alone used to let
  // the command through, so `/approve` on a Task that had already been approved
  // and run put it back on the queue and the work ran a second time on the one
  // approval. A decided chain admits a further decision only while its Task is
  // still held; an undecided chain is left as it was.
  const chain = getApprovalChain(taskId);
  if (chain && (chain.status === "pending" || job.status.startsWith("awaiting_"))) {
    return undefined;
  }

  // A rejected Task is recorded as failed; JobStatus has no separate value.
  const finished =
    job.status === "completed" ||
    job.status === "failed";

  if (finished) {
    return [
      `${taskId} has already finished, so there is nothing to ${decision}.`,
      "",
      "Approval authorises a Task before it runs. It is not a judgement on the",
      "result, and a finished Task cannot be undone by refusing it now.",
      "",
      "To record a decision about what the Task produced, register the output as",
      "an Artefact version and send it for review:",
      "  /artefact add, then /artefact submit, then /artefact review",
    ].join("\n");
  }

  return [
    `${taskId} is not waiting for a decision, so there is nothing to ${decision}.`,
    `Its status is ${job.status}.`,
    "",
    "Only a Task that Governance held before execution can be approved or",
    "rejected. Use /approvals to see the Tasks that are waiting.",
  ].join("\n");
}

/**
 * Approves a Task held for a person's decision: the one sequence behind both
 * the terminal's /approve and the company overview's "Approve to start".
 * Every refusal comes before anything is recorded.
 *
 * SIDE EFFECT: May record a signed decision, release the Task, record
 * Artefact decisions, advance a Workflow and broadcast events.
 */
export function decideApproval(
  args: readonly string[]
): ApprovalDecisionOutcome {
  const lines: string[] = [];
  const say = (line: string): void => {
    lines.push(line);
  };
  let recorded = false;
  let released = false;
  const finish = (): ApprovalDecisionOutcome => ({ recorded, released, message: lines.join("\n") });

  const missingTask = describeMissingApprovalTask(args);
  if (missingTask) {
    say(missingTask);
    return finish();
  }

  const notWaiting =
    describeTaskNotAwaitingDecision(
      args,
      "approve"
    );
  if (notWaiting) {
    say(notWaiting);
    return finish();
  }

  let identity: ApprovalCommandIdentity;

  try {
    identity = resolveApprovalCommandIdentity(args);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    say(message);
    // A rejected access-control decision is the highest-value audit record
    // there is — someone tried to release work they were not entitled to.
    // Record it so it survives in the Timeline, not just the terminal.
    broadcastEvent(
      "job.approval_refused",
      "warn",
      `Approval refused for ${describeApprovalTarget(args)}: ${message}`
    );
    return finish();
  }

  const id = identity.remainingArgs[0];

  if (!id) {
    say(
      "Usage: /approve <task-id>"
    );

    return finish();
  }

  const approveRefusal =
    refuseUndesignatedApprover(
      getJob(id),
      identity.workerName,
      "approve"
    );

  if (approveRefusal) {
    say(approveRefusal);
    broadcastEvent(
      "job.approval_refused",
      "warn",
      `Approval of Task ${id} refused: ${identity.workerName} is not the accountable approver`
    );
    return finish();
  }

  try {
    validateJobArtefactReviewer(
      getJob(
        id
      ),
      identity.workerName
    );
    const jobBeforeDecision =
      getJob(
        id
      );
    const chain =
      approveJobInChain(
        id,
        identity.workerName,
        undefined,
        jobBeforeDecision
          ? approvalDecisionKind(jobBeforeDecision)
          : undefined
      );
    recorded = true;

    // The decision is recorded above; whether the work may now run is a
    // separate question, and until this guard existed the answer was assumed.
    const releaseRefusal =
      refuseApprovalRelease(chain);

    if (releaseRefusal) {
      say(
        `approval recorded: ${id}`
      );
      say(
        `approval status: ${chain.status}`
      );
      say(releaseRefusal);
      broadcastEvent(
        "job.approval_not_released",
        "warn",
        `Approval by ${identity.workerName} did not release Task ${id}: chain is ${chain.status}`
      );
      return finish();
    }

    const job =
      getJob(
        id
      );

    const output =
      job?.status === "awaiting_review"
        ? "Human review approved"
        : `Approved by ${identity.workerName}`;

    const releasesWork =
      job !== undefined &&
      isGovernedExecutionJob(job);

    const approvedJob =
      job
        ? releaseApprovedJob(
            job,
            output
          )
        : approveJob(
            id,
            output
          );

    released = true;

    if (job) {
      recordJobArtefactDecision(
        job,
        identity.workerName,
        "approved",
        `Approved through Human review Task ${job.id}.`
      );
    }

    updateRunStepStatusByJobId(
      id,
      "completed"
    );

    if (approvedJob.workflowRunId) {
      refreshWorkflowRunStatus(
        approvedJob.workflowRunId
      );

      queueNextWorkflowStep(
        approvedJob
      );
    }

    say(
      `approval recorded: ${id}`
    );

    say(
      `approval status: ${chain.status}`
    );

    say(
      `approved by: ${identity.workerName}`
    );

    // Tell the operator where the work goes next. A governed execution Task is
    // now queued to run; a human-review approval just cleared its review. Both
    // are read back the same way, so name the command rather than leaving the
    // operator to remember the Task id and the inspect syntax.
    say(
      releasesWork
        ? `The work will run now. This let it start; it is not a sign-off of what it produces. See how it goes with /task inspect ${id}`
        : `See the result with /task inspect ${id}`
    );

    broadcastEvent(
      "job.approved",
      "success",
      `Approval recorded for Task ${id} by ${identity.workerName}${
        releasesWork ? ": released to run, result not signed off" : ": review accepted"
      }`
    );
  } catch (err: unknown) {
    say(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
  return finish();
}

/**
 * The terminal command: prints what the decision function says, and nothing else.
 *
 * SIDE EFFECT: Writes CLI output, through the decision function's effects.
 */
export function handleApproveCommand(
  args: readonly string[]
): void {
  const outcome = decideApproval(args);
  if (outcome.message) console.log(outcome.message);
}

/**
 * Handles the /reject command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates approval state.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
/**
 * Rejects a Task held for a person's decision, with a reason: the one sequence
 * behind both the terminal's /reject and the company overview's "Reject".
 *
 * SIDE EFFECT: May record a signed decision, fail the Task, record Artefact
 * decisions and broadcast events.
 */
export function decideRejection(
  args: readonly string[]
): ApprovalDecisionOutcome {
  const lines: string[] = [];
  const say = (line: string): void => {
    lines.push(line);
  };
  let recorded = false;
  let released = false;
  const finish = (): ApprovalDecisionOutcome => ({ recorded, released, message: lines.join("\n") });

  const missingTask = describeMissingApprovalTask(args);
  if (missingTask) {
    say(missingTask);
    return finish();
  }

  const notWaiting =
    describeTaskNotAwaitingDecision(
      args,
      "reject"
    );
  if (notWaiting) {
    say(notWaiting);
    return finish();
  }

  let identity: ApprovalCommandIdentity;

  try {
    identity = resolveApprovalCommandIdentity(args);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    say(message);
    broadcastEvent(
      "job.rejection_refused",
      "warn",
      `Rejection refused for ${describeApprovalTarget(args)}: ${message}`
    );
    return finish();
  }

  const [
    id,
    ...reasonParts
  ] = identity.remainingArgs;

  const reason =
    reasonParts.join(" ");

  if (!id || !reason) {
    say(
      'Usage: /reject <task-id> "<reason>"'
    );

    return finish();
  }

  const rejectRefusal =
    refuseUndesignatedApprover(
      getJob(id),
      identity.workerName,
      "reject"
    );

  if (rejectRefusal) {
    say(rejectRefusal);
    broadcastEvent(
      "job.rejection_refused",
      "warn",
      `Rejection of Task ${id} refused: ${identity.workerName} is not the accountable approver`
    );
    return finish();
  }

  try {
    const job =
      getJob(
        id
      );
    validateJobArtefactReviewer(
      job,
      identity.workerName
    );
    const chain =
      rejectJobInChain(
        id,
        identity.workerName,
        reason,
        undefined,
        job ? approvalDecisionKind(job) : undefined
      );
    recorded = true;

    if (
      job &&
      !(job.requiredCapabilities ?? []).includes("human-review")
    ) {
      failJob(
        id,
        `Governance approval rejected: ${reason}`
      );
    }
    if (job) {
      recordJobArtefactDecision(
        job,
        identity.workerName,
        "rejected",
        reason
      );
    }

    say(
      `rejection recorded: ${id}`
    );

    say(
      `approval status: ${chain.status}`
    );

    say(
      `rejected by: ${identity.workerName}`
    );

    broadcastEvent(
      "job.rejected",
      "error",
      `Approval rejected for Task ${id} by ${identity.workerName}`
    );
  } catch (err: unknown) {
    say(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
  return finish();
}

/**
 * The terminal command: prints what the decision function says, and nothing else.
 *
 * SIDE EFFECT: Writes CLI output, through the decision function's effects.
 */
export function handleRejectCommand(
  args: readonly string[]
): void {
  const outcome = decideRejection(args);
  if (outcome.message) console.log(outcome.message);
}

/**
 * Handles the /approval-status command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads approval chain state.
 * - Writes CLI output.
 */
export function handleApprovalStatusCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /approval-status <task-id>"
    );

    return;
  }

  const chain =
    getApprovalChain(
      id
    );

  if (!chain) {
    console.log(
      `approval chain not found: ${id}`
    );

    return;
  }

  console.log(
    formatApprovalChain(
      chain
    )
  );
}
