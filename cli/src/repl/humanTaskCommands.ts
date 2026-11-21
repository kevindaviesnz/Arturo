import { completeHumanTaskAs } from "../runtime/humanTaskCompletion";
import { describeHandedWork, refuseUnacceptedHandOver } from "../runtime/resultSignOff";
import { isWorkerAvailableForNewTask } from "../control/workers";
import {
  buildHumanTaskUrl,
} from "../runtime/humanTaskLink";

import type {
  HumanTask,
} from "../runtime/humanTaskStore";

import {
  createHumanTask,
  getHumanTask,
  listHumanTasks,
} from "../runtime/humanTaskStore";

import {
  blockHumanTaskWorkflow,
  completeHumanTaskWorkflow,
  requestHumanTaskRevisionWorkflow,
} from "../runtime/humanTaskWorkflowActions";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  listWorkers,
} from "../control/workers";

import {
  formatArtefactReference,
  parseArtefactReferences,
  describeArtefactReviewStatus,
} from "../artefacts/artefact";

import {
  getArtefactVersion,
} from "../artefacts/artefactStore";

import {
  getJob,
} from "../runtime/jobQueue";

import {
  withoutEvidenceBanner,
} from "../runtime/taskExecutor";

/** Returns one Human Task flag value. */
export function getHumanTaskFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const index =
    args.indexOf(
      flag
    );

  if (index >= 0) {
    return args[
      index + 1
    ];
  }

  const prefix =
    `${flag}=`;
  return args
    .find(
      (arg) =>
        arg.startsWith(
          prefix
        )
    )
    ?.slice(
      prefix.length
    );
}

/** Removes supported flag/value pairs before positional parsing. */
export function removeHumanTaskFlags(
  args: readonly string[],
  flags: readonly string[]
): string[] {
  const result: string[] =
    [];

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const argument =
      args[
        index
      ];
    const matchingFlag =
      flags.find(
        (flag) =>
          argument ===
            flag ||
          argument.startsWith(
            `${flag}=`
          )
      );

    if (!matchingFlag) {
      result.push(
        argument
      );
      continue;
    }

    if (
      argument ===
      matchingFlag
    ) {
      index += 1;
    }
  }

  return result;
}

/** Resolves exact Artefact references and formats immutable handoff metadata. */
export function formatHumanTaskArtefactContext(
  value: string
): {
  readonly refs: readonly string[];
  readonly context: string;
} {
  const references =
    parseArtefactReferences(
      value
    );
  const versions =
    references.map(
      (reference) => {
        const version =
          getArtefactVersion(
            reference
          );
        if (!version) {
          throw new Error(
            `Artefact version not found: ${formatArtefactReference(reference)}`
          );
        }
        return version;
      }
    );

  return {
    refs:
      references.map(
        formatArtefactReference
      ),
    context:
      versions
        .map(
          (version) =>
            [
              `Artefact: ${formatArtefactReference(version)}`,
              `URI: ${version.uri}`,
              `Media type: ${version.mediaType}`,
              `SHA-256: ${version.sha256 ?? "not supplied"}`,
              `Review: ${describeArtefactReviewStatus(version.reviewStatus)}`,
            ].join(
              "\n"
            )
        )
        .join(
          "\n\n"
        ),
  };
}

/**
 * Formats a human task summary row.
 *
 * @param task Human task.
 * @returns Human-readable task summary.
 *
 * PURE: No side effects.
 */
export function formatHumanTaskSummary(
  task: ReturnType<typeof listHumanTasks>[number]
): string {
  return [
    `${task.id} ${task.status}`,
    `Title: ${task.title}`,
    task.owner
      ? `Owner: ${task.owner}`
      : undefined,
    task.workflowRunId
      ? `Workflow: ${task.workflowRunId}`
      : undefined,
    task.sourceJobId
      ? `Task: ${task.sourceJobId}`
      : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Formats optional human task handoff details.
 *
 * @param task Human task.
 * @returns Human-readable handoff section or undefined.
 *
 * PURE: No side effects.
 */
export function formatHumanTaskHandoff(
  task: ReturnType<typeof listHumanTasks>[number]
): string | undefined {
  const hasHandoff =
    Boolean(
      task.fromWorker ||
        task.toWorker ||
        task.inputSummary ||
        task.inputArtifact ||
        task.requestedAction ||
        task.acceptanceCriteria?.length
    );

  if (!hasHandoff) {
    return undefined;
  }

  return [
    "Handoff:",
    // A missing hand-off origin is "nobody handed this over", not an error.
    // Printing "(unknown)" made a successful creation read as a refusal to the
    // label heuristic, so a created Human Task was reported as "not created".
    ...(task.fromWorker ? [`From: ${task.fromWorker}`] : []),
    `To: ${task.toWorker ?? task.owner ?? "nobody yet"}`,
    "",
    task.inputSummary
      ? [
          "Input summary:",
          task.inputSummary,
          "",
        ].join("\n")
      : undefined,
    task.inputArtifact
      ? [
          "Input:",
          task.inputArtifact,
          "",
        ].join("\n")
      : undefined,
    task.inputArtefactRefs?.length
      ? [
          "Input Artefacts:",
          task.inputArtefactRefs
            .map(
              (reference) =>
                `- ${reference}`
            )
            .join(
              "\n"
            ),
          "",
        ].join(
          "\n"
        )
      : undefined,
    "Requested action:",
    task.requestedAction ?? task.instructions,
    "",
    "Acceptance criteria:",
    ...(task.acceptanceCriteria?.length
      ? task.acceptanceCriteria.map(
          (criterion) =>
            `- ${criterion}`
        )
      : [
          "- No explicit acceptance criteria provided.",
        ]),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Formats available commands for a human task.
 *
 * @param task Human task.
 * @returns Human-readable command section.
 *
 * PURE: No side effects.
 */
export function formatHumanTaskCommands(
  task: ReturnType<typeof listHumanTasks>[number]
): string {
  if (task.status === "open") {
    return [
      "Commands:",
      `/complete-human-task ${task.id} "<notes>"`,
      `/block-task ${task.id} "<reason>"`,
      `/revise-task ${task.id} "<revision instructions>"`,
    ].join("\n");
  }

  return [
    "Commands:",
    "(no actions available)",
  ].join("\n");
}

/**
 * The finished Task's result, for a person being asked to act on it.
 *
 * Reads handoverJobId, not sourceJobId. sourceJobId means the Task waiting on
 * this person, and completing the Human Task completes it — pointing it at an
 * already-finished Task made /complete-human-task refuse with "Task is not
 * awaiting Human Task completion" under a heading that said it had worked.
 *
 * Resolved at read time rather than copied at creation: the Task is finished,
 * so its result does not move, and one copy cannot drift from the other.
 *
 * Labelled as unchecked, because that is what it is — a completed Task is not
 * a verified one, and the person acting on it is entitled to know.
 *
 * PURE: Reads the job store; does not mutate it.
 */
export function formatHumanTaskSourceWork(
  task: Pick<HumanTask, "handoverJobId">
): string | undefined {
  if (!task.handoverJobId) return undefined;

  const source = getJob(task.handoverJobId);
  if (!source?.output) return undefined;

  // The stored banner is dropped because the heading below already says the
  // same thing in plain words, and saying it twice reads as boilerplate rather
  // than as the caution it is.
  const work = withoutEvidenceBanner(source.output)?.trim();
  if (!work) return undefined;

  return [
    `Work to act on (from ${source.id}, ${describeHandedWork(source)}):`,
    work,
    "",
  ].join("\n");
}

/**
 * Formats a full human task view.
 *
 * @param task Human task.
 * @returns Human-readable task details.
 *
 * PURE: No side effects.
 */
export function formatHumanTaskDetail(
  task: ReturnType<typeof listHumanTasks>[number]
): string {
  return [
    `Human task: ${task.id}`,
    `Status: ${task.status}`,
    `Title: ${task.title}`,
    task.owner
      ? `Owner: ${task.owner}`
      : undefined,
    "",
    task.workflowRunId
      ? `Workflow: ${task.workflowRunId}`
      : undefined,
    task.sourceJobId
      ? `Task: ${task.sourceJobId}`
      : undefined,
    "",
    formatHumanTaskHandoff(
      task
    ),
    "",
    task.purpose
      ? [
          "Purpose:",
          task.purpose,
          "",
        ].join("\n")
      : undefined,
    "Instructions:",
    task.instructions,
    "",
    task.completionEvidence
      ? [
          "Completion evidence:",
          task.completionEvidence,
          "",
        ].join("\n")
      : undefined,
    task.notes
      ? [
          "Notes:",
          task.notes,
          "",
        ].join("\n")
      : undefined,
    task.outputArtefactRefs?.length
      ? [
          "Output Artefacts:",
          task.outputArtefactRefs
            .map(
              (reference) =>
                `- ${reference}`
            )
            .join(
              "\n"
            ),
          "",
        ].join(
          "\n"
        )
      : undefined,
    task.completedBy
      ? `Completed by: ${task.completedBy}`
      : undefined,
    task.blockReason
      ? [
          "Block reason:",
          task.blockReason,
          "",
        ].join("\n")
      : undefined,
    task.revisionInstructions
      ? [
          "Revision requested:",
          task.revisionInstructions,
          "",
        ].join("\n")
      : undefined,
    formatHumanTaskCommands(
      task
    ),
    // Last, because the renderer quotes it to the end of the body — a Worker's
    // output has blank lines in it, and any earlier terminator would stop
    // quoting a paragraph in and restyle the rest.
    formatHumanTaskSourceWork(
      task
    ),
  ]
    .filter(Boolean)
    .join("\n");
}


export const CREATE_HUMAN_TASK_USAGE =
  'Usage: /create-human-task "<title>" "<instructions>" [--assign-to "<human-worker>"] [--artefact <artefact-id>@<version>[,...]] [--purpose "<purpose>"] [--follows <task-id>]';

export type HumanTaskCreateOutcome =
  | { readonly created: true; readonly task: HumanTask }
  | { readonly created: false; readonly message: string };

/**
 * Creates a Human Task from the arguments /create-human-task takes, and
 * refuses before creating anything.
 *
 * The terminal command and the overview's "Pass this on" control both call
 * this, so a Task handed to a person is checked and recorded the same way
 * whichever way it was handed over: the finished Task must exist, and an AI
 * model's result reaches a person only once someone has signed it off.
 *
 * SIDE EFFECT: May create a Human Task and broadcast a runtime event.
 */
export function createHumanTaskFromArgs(
  args: readonly string[]
): HumanTaskCreateOutcome {
  const refuse = (message: string): HumanTaskCreateOutcome => ({ created: false, message });
  const positional =
    removeHumanTaskFlags(
      args,
      [
        "--assign-to",
        "--artefact",
        "--purpose",
        "--follows",
      ]
    );
  const [
    title,
    ...instructionParts
  ] = positional;

  const instructions =
    instructionParts
      .join(" ")
      .trim();

  if (!title || !instructions) {
    return refuse(CREATE_HUMAN_TASK_USAGE);
  }

  // The finished Task whose result the person is being asked to act on. Same
  // rule as /task --follows: it must exist and be finished, because an
  // unfinished one has nothing to hand over yet.
  const followsReference =
    getHumanTaskFlagValue(
      args,
      "--follows"
    );
  const sourceJob =
    followsReference
      ? getJob(followsReference)
      : undefined;

  if (followsReference) {
    if (!sourceJob) {
      return refuse(`No Task found with id ${followsReference}.`);
    }
    if (sourceJob.status !== "completed") {
      return refuse(`Task ${followsReference} has not finished, so there is nothing to hand over yet.`);
    }
    const unaccepted = refuseUnacceptedHandOver(sourceJob);
    if (unaccepted) {
      return refuse(unaccepted);
    }
  }

  const ownerReference =
    getHumanTaskFlagValue(
      args,
      "--assign-to"
    );
  const owner =
    ownerReference
      ? listWorkers().find(
          (worker) =>
            worker.kind ===
              "human" &&
            isWorkerAvailableForNewTask(worker) &&
            (
              worker.name.toLowerCase() ===
                ownerReference.toLowerCase() ||
              worker.displayName?.toLowerCase() ===
                ownerReference.toLowerCase()
            )
        )
      : undefined;

  if (
    ownerReference &&
    !owner
  ) {
    return refuse(`Available Human worker not found: ${ownerReference}`);
  }

  let inputArtefacts:
    ReturnType<
      typeof formatHumanTaskArtefactContext
    > |
    undefined;
  try {
    const inputArtefactValue =
      getHumanTaskFlagValue(
        args,
        "--artefact"
      );
    inputArtefacts =
      inputArtefactValue
        ? formatHumanTaskArtefactContext(
            inputArtefactValue
          )
        : undefined;
  } catch (error) {
    return refuse(
      error instanceof Error
        ? error.message
        : String(
            error
          )
    );
  }

  const task =
    createHumanTask({
      title,
      owner:
        owner
          ? owner.displayName ??
            owner.name
          : undefined,
      purpose:
        getHumanTaskFlagValue(
          args,
          "--purpose"
        ),
      instructions,
      handoverJobId:
        sourceJob?.id,
      inputArtefactRefs:
        inputArtefacts
          ?.refs,
      inputArtifact:
        inputArtefacts
          ?.context,
    });

  broadcastEvent(
    "human_task.created",
    "info",
    `Human task created: ${task.id}`
  );

  return { created: true, task };
}

/**
 * Handles the /create-human-task command, printing what
 * createHumanTaskFromArgs decided.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates a human task.
 * - Writes CLI output.
 * - Broadcasts runtime event.
 */
export function handleCreateTaskCommand(
  args: readonly string[]
): void {
  const outcome =
    createHumanTaskFromArgs(
      args
    );

  if (!outcome.created) {
    console.log(
      outcome.message
    );

    return;
  }

  const task =
    outcome.task;

  console.log(
    `human task created: ${task.id}`
  );

  try {
    console.log(
      `open: ${buildHumanTaskUrl(task)}`
    );
  } catch (err: unknown) {
    console.log(
      "open: unavailable — configure HUMAN_TASK_TOKEN_SECRET with at least 32 non-placeholder characters to enable signed browser links"
    );
  }

  console.log("");

  console.log(
    formatHumanTaskDetail(
      task
    )
  );
}

/**
 * Handles the /human-tasks command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads human task store.
 * - Writes CLI output.
 */
export function handleHumanTasksCommand(): void {
  const tasks =
    listHumanTasks();

  if (!tasks.length) {
    console.log(
      "No human tasks."
    );

    return;
  }

  console.log(
    tasks
      .map(
        formatHumanTaskSummary
      )
      .join("\n\n")
  );
}

/**
 * Handles the /human-task command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads human task store.
 * - Writes CLI output.
 */
export function handleHumanTaskCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /human-task <id>"
    );

    return;
  }

  const task =
    getHumanTask(
      id
    );

  if (!task) {
    console.log(
      `human task not found: ${id}`
    );

    return;
  }

  console.log(
    formatHumanTaskDetail(
      task
    )
  );
}

/**
 * Handles the /complete-human-task command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates human task, job, and workflow state through runtime action.
 * - Writes CLI output.
 */
export function handleCompleteTaskCommand(
  args: readonly string[]
): void {
  const requestedHuman =
    getHumanTaskFlagValue(
      args,
      "--as"
    );
  const outputArtefactValue =
    getHumanTaskFlagValue(
      args,
      "--artefact"
    );
  const positional =
    removeHumanTaskFlags(
      args,
      [
        "--as",
        "--artefact",
      ]
    );
  const id =
    positional[0];

  const notes =
    positional.slice(1)
      .join(" ")
      .trim();

  if (!id || !notes) {
    console.log(
      'Usage: /complete-human-task <id> "<notes>" [--as "<human-worker>"] [--artefact <artefact-id>@<version>[,...]]'
    );

    return;
  }

  const outcome =
    completeHumanTaskAs({
      id,
      notes,
      as: requestedHuman,
      artefacts: outputArtefactValue,
    });

  if (!outcome.completed) {
    console.log(outcome.message);
    return;
  }

  console.log(
    `human task completed: ${outcome.task.id}`
  );
  console.log(`completed by: ${outcome.completedBy}`);
  broadcastEvent(
    "human_task.completed",
    "success",
    `Human task ${outcome.task.id} completed by ${outcome.completedBy}`
  );
}

/**
 * Handles the /block-task command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates human task state through runtime action.
 * - Writes CLI output.
 */
export function handleBlockTaskCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  const reason =
    args
      .slice(1)
      .join(" ")
      .trim();

  if (!id || !reason) {
    console.log(
      'Usage: /block-task <id> "<reason>"'
    );

    return;
  }

  try {
    const task =
      blockHumanTaskWorkflow(
        id,
        reason
      );

    console.log(
      `human task blocked: ${task.id}`
    );
  } catch (err: unknown) {
    console.log(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}

/**
 * Handles the /revise-task command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Mutates human task, job, and workflow state through runtime action.
 * - Writes CLI output.
 * - Broadcasts runtime event.
 */
export function handleReviseTaskCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  const revisionInstructions =
    args
      .slice(1)
      .join(" ")
      .trim();

  if (
    !id ||
    !revisionInstructions
  ) {
    console.log(
      'Usage: /revise-task <id> "<revision instructions>"'
    );

    return;
  }

  try {
    const result =
      requestHumanTaskRevisionWorkflow(
        id,
        revisionInstructions
      );

    console.log(
      `revision requested for ${id}`
    );

    console.log(
      `revision Task queued: ${result.revisionJobId}`
    );

    console.log(
      `worker: ${result.workerName}`
    );

    broadcastEvent(
      "human_task.revision_requested",
      "warn",
      `Human task ${id} requested revision from ${result.workerName}`
    );
  } catch (err: unknown) {
    console.log(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
}
