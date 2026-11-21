/**
 * Replying to an AI Worker's completed Task when it asked for missing details
 * or needs follow-up clarification (`DESIGN_QUESTIONS.md` item 9).
 *
 * The reply creates a fresh, governed Task through `createTask` (the exact
 * function behind `/task create`), carrying forward the original instruction,
 * Business Function, Enterprise, client, named work, and input documents, plus
 * the operator's reply (and any newly attached document).
 *
 * It deliberately does NOT set `--follows` on an unsigned AI question: that
 * would make the real answer look like it was built on an unsigned AI draft.
 */
import { withoutSuppliedArtefactContext } from "../artefacts/artefactStore";
import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { withoutClientRecord } from "../clients/clientRecords";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { createTask } from "../repl/taskRoutingCommands";
import { getJob, type Job } from "../runtime/jobQueue";
import { resolveJobEnterpriseId } from "../runtime/jobOrganisation";
import { passOnChecking } from "../runtime/passOnRules";
import { readResultSetAsideStanding } from "../runtime/resultSetAside";
import { carriedTaskArgs } from "./carriedTaskArgs";

export const MAX_REPLY_LENGTH = 4000;

export type TaskReplyPlan =
  | { readonly reply: true; readonly createArgs: readonly string[] }
  | { readonly reply: false; readonly reason: string };

export type TaskReplyOutcome = {
  readonly created: boolean;
  readonly taskId?: string;
  readonly message: string;
};

const NEEDS_INPUT_PHRASES = [
  /\bplease\s+(?:provide|supply|share|specify|clarify|confirm|attach|upload|send|tell\s+me)\b/i,
  /\bcould\s+you\s+(?:please\s+)?(?:provide|supply|share|specify|clarify|confirm|let\s+me\s+know)\b/i,
  /\blet\s+me\s+know\s+(?:which|what|whether|if|your)\b/i,
  /\b(?:missing|additional|more)\s+(?:information|details?|context|evidence|documents?|materials?)\b/i,
  /\b(?:was|were|is|are)\s+not\s+(?:supplied|provided|attached|included)\b/i,
  /\bbefore\s+i\s+can\s+(?:proceed|continue|complete|finish|draft|review|answer|assess)\b/i,
  /\bto\s+(?:proceed|continue|complete\s+this|give\s+you)\b[^.\n]{0,80}\b(?:need|require|please)\b/i,
];

/**
 * Deterministic check for whether a finished AI result appears to be asking
 * the operator for missing information rather than completing the request.
 *
 * PURE: No side effects.
 */
export function taskNeedsInput(result: string | null | undefined): boolean {
  const text = (result ?? "").trim();
  if (!text) return false;
  const hasQuestionMark = text.includes("?");
  const matchesPhrase = NEEDS_INPUT_PHRASES.some((pattern) => pattern.test(text));
  if (matchesPhrase) return true;
  // Short response ending in a direct question to the user.
  const nonEmptyLines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const lastLine = nonEmptyLines.at(-1) ?? "";
  return hasQuestionMark && nonEmptyLines.length <= 8 && lastLine.endsWith("?");
}

/**
 * Whether a Task may receive an operator reply to continue with more details.
 *
 * PURE: No side effects.
 */
export function canReplyToTask(
  job: Job | undefined,
  options: { readonly isCheck?: boolean; readonly isSetAside?: boolean } = {}
): boolean {
  if (!job || job.status !== "completed") return false;
  if (options.isCheck || options.isSetAside) return false;
  if (job.workflowRunId) return false;
  return true;
}

/**
 * Builds the `/task create` arguments for replying to a completed Task with
 * additional context or an extra document.
 *
 * PURE: No side effects.
 */
export function buildTaskReply(
  job: Job | undefined,
  taskId: string,
  replyText: string,
  owner: {
    readonly functionLabel?: string;
    readonly enterpriseName?: string;
    readonly askedBy?: string;
    readonly extraArtefactRef?: string;
    readonly isCheck?: boolean;
    readonly isSetAside?: boolean;
  }
): TaskReplyPlan {
  if (!job) {
    return { reply: false, reason: `No Task found with id ${taskId}. Check /tasks for the exact id.` };
  }
  if (job.status !== "completed") {
    return {
      reply: false,
      reason: `${taskId} has not finished yet (status: ${job.status}). Wait for it to finish before replying.`,
    };
  }
  if (owner.isSetAside) {
    return {
      reply: false,
      reason: `${taskId} was set aside and cannot be continued. Start a new Task instead.`,
    };
  }
  if (owner.isCheck) {
    return {
      reply: false,
      reason: `${taskId} is an AI check of another result. Reply to the original Task instead.`,
    };
  }
  if (job.workflowRunId) {
    return {
      reply: false,
      reason: `${taskId} is part of a Workflow run and cannot be replied to directly.`,
    };
  }
  const reply = replyText.trim();
  if (!reply) {
    return { reply: false, reason: "Type your reply first before sending." };
  }
  if (reply.length > MAX_REPLY_LENGTH) {
    return { reply: false, reason: `Keep your reply under ${MAX_REPLY_LENGTH} characters.` };
  }

  const original = withoutClientRecord(withoutSuppliedArtefactContext(job.task)).trim();
  const instruction = [
    original,
    "",
    `Additional details supplied in reply to ${taskId}:`,
    reply,
  ].join("\n");

  const artefacts = [
    ...(job.inputArtefactRefs ?? []),
    ...(owner.extraArtefactRef ? [owner.extraArtefactRef] : []),
  ];
  const carried = carriedTaskArgs({
    requestedBy: owner.askedBy?.trim() || job.requestedBy,
    clientId: job.clientId,
    workId: job.workId,
  });

  return {
    reply: true,
    createArgs: [
      instruction,
      ...(owner.functionLabel ? ["--function", owner.functionLabel] : []),
      ...(owner.enterpriseName ? ["--enterprise", owner.enterpriseName] : []),
      ...(artefacts.length ? ["--input-artefact", artefacts.join(",")] : []),
      ...carried,
      "--write-only",
    ],
  };
}

/**
 * Plans a reply for a stored Task by ID.
 *
 * SIDE EFFECT: Reads Task, Function, Enterprise, check and set-aside state.
 */
export function planTaskReply(input: {
  readonly taskId: string;
  readonly reply: string;
  readonly askedBy?: string;
  readonly extraArtefactRef?: string;
}): TaskReplyPlan {
  const job = getJob(input.taskId);
  const enterpriseId = job ? resolveJobEnterpriseId(job) : undefined;
  return buildTaskReply(job, input.taskId, input.reply, {
    functionLabel: job?.businessFunctionId ? getBusinessFunctionDefinition(job.businessFunctionId)?.label : undefined,
    enterpriseName: enterpriseId ? getEnterprise(enterpriseId)?.name : undefined,
    askedBy: input.askedBy,
    extraArtefactRef: input.extraArtefactRef,
    isCheck: job ? Boolean(passOnChecking(job.id)) : false,
    isSetAside: job ? readResultSetAsideStanding(job).state === "set_aside" : false,
  });
}

/**
 * Executes a reply to a completed Task through `createTask` (the exact function
 * behind `/task create`). Used by both the terminal `/task reply` and the
 * browser's `POST /api/task/reply`.
 *
 * SIDE EFFECT: Creates and queues a new governed Task.
 */
export function replyToTask(input: {
  readonly taskId: string;
  readonly reply: string;
  readonly askedBy?: string;
  readonly extraArtefactRef?: string;
}): TaskReplyOutcome {
  const plan = planTaskReply(input);
  if (!plan.reply) {
    return { created: false, message: plan.reason };
  }
  const created = createTask([...plan.createArgs]);
  if (!created.created) {
    return { created: false, message: created.message };
  }
  return {
    created: true,
    taskId: created.taskId,
    message: `Started ${created.taskId} with your reply to ${input.taskId}.`,
  };
}
