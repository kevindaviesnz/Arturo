import { passOnChecking } from "../runtime/passOnRules";
import { continueRouteAfterSignOff, recordCheckSeenAtSignOff, signOffAlongside } from "../runtime/resultPassOn";
import { resolveApprovalCommandIdentity } from "../repl/approvalCommands";
import { getJob } from "../runtime/jobQueue";
import {
  readResultSignOffStanding,
  recordResultSignOff,
  refuseResultSignOff,
} from "../runtime/resultSignOff";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import { deliverHandOff } from "../runtime/handOff";
import { readResultSetAsideStanding } from "../runtime/resultSetAside";
import { refuseSignOffOrder } from "../runtime/signOffOrder";
import { refuseWorkUnderLocks } from "../work/workLocks";
import { claimNextAction, finishNextAction, recordNextAction } from "../runtime/nextActions";
import { runtimeDb } from "../storage/runtimeDatabase";
import type { Job } from "../runtime/jobQueue";
import {
  designatedApproversForFunction,
  mayDecideForFunction,
} from "../staffing/functionApprovers";
import { isOwner, maySignOff } from "../identity/companySignIn";
import { handBackForJob, refuseHandBackSignOff } from "../staffing/handBack";
import {
  formatEmailAcceptanceLine,
  recordEmailAcceptance,
  refuseEmailAcceptance,
  type EmailAcceptanceInput,
} from "../staffing/emailAcceptance";
import { revokeOffTerminalLinksForJob } from "../offterminal/offTerminalLinks";

export type TaskSignOffOutcome = {
  readonly signedOff: boolean;
  readonly message: string;
  /** A fixed refusal code, where one is set (sign-off order: runtime/signOffOrder.ts). */
  readonly code?: string;
};

const USAGE = 'Usage: /task signoff <task-id> [--as "<human-worker>"] [--accepted-by "<name>"] [--email-date "<date>"] [--email-subject "<subject>"] [--email-from "<sender>"]';

const NOTE_FLAGS = new Set(["--accepted-by", "--email-date", "--email-subject", "--email-from"]);

function parseEmailAcceptanceArgs(args: readonly string[]): {
  readonly rest: string[];
  readonly note?: {
    readonly freelancerName?: string;
    readonly emailDate?: string;
    readonly emailSubject?: string;
    readonly emailSender?: string;
  };
} {
  const rest: string[] = [];
  const note: {
    freelancerName?: string;
    emailDate?: string;
    emailSubject?: string;
    emailSender?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]!;
    if (!NOTE_FLAGS.has(option)) {
      rest.push(option);
      continue;
    }
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      return { rest: [...args] };
    }
    index += 1;
    if (option === "--accepted-by") note.freelancerName = value;
    if (option === "--email-date") note.emailDate = value;
    if (option === "--email-subject") note.emailSubject = value;
    if (option === "--email-from") note.emailSender = value;
  }
  if (!note.freelancerName && !note.emailDate && !note.emailSubject && !note.emailSender) {
    return { rest };
  }
  return { rest, note };
}

/**
 * Records that a named person has read a finished result and accepts it.
 *
 * Who may sign is decided by maySignOff (identity/companySignIn.ts): they
 * must be a registered, approval-capable Human, and with sign-in on they
 * also need a verified grant from the owner. Identity resolution still
 * checks the person's mode first, so a Human in "task" mode is refused
 * with that more specific reason before the grant is considered. Where a
 * staffing plan made someone accountable for the Function, only them.
 * Every refusal happens before anything is written.
 *
 * SIDE EFFECT: May write a signed sign-off and broadcast a runtime event.
 */
export function signOffTaskResult(
  args: readonly string[]
): TaskSignOffOutcome {
  const refused = (message: string, code?: string): TaskSignOffOutcome => ({
    signedOff: false,
    message,
    ...(code ? { code } : {}),
  });

  let identity;
  try {
    identity = resolveApprovalCommandIdentity(args);
  } catch (error: unknown) {
    return refused(error instanceof Error ? error.message : String(error));
  }

  const parsed = parseEmailAcceptanceArgs(identity.remainingArgs);
  const [taskId, ...unexpected] = parsed.rest;
  if (!taskId || taskId.startsWith("--") || unexpected.length > 0) {
    return refused(USAGE);
  }

  const job = getJob(taskId);
  const refusal = refuseResultSignOff(job, taskId);
  if (!job || refusal) {
    return refused(refusal ?? USAGE);
  }

  // A check made because a result was passed on is kept with that result,
  // which is the work; it is never signed off on its own.
  const checking = passOnChecking(job.id);
  if (checking) {
    return refused(
      `${taskId} is a check of ${checking.sourceTaskId}, kept with it. Sign off ${checking.sourceTaskId} instead. Nothing was recorded.`
    );
  }

  // The person's sign-off right, checked again here so a grant taken away
  // (or never given) cannot be bypassed by an approval-capable mode alone.
  if (!maySignOff(job.enterpriseId, identity.workerName)) {
    broadcastEvent(
      "job.result_sign_off_refused",
      "warn",
      `Sign-off of Task ${taskId} refused: ${identity.workerName} may not sign off work`
    );
    return refused(
      `${identity.workerName} may not sign off work at this business, so this sign-off was not recorded.`,
      "cannot_sign_off"
    );
  }

  const handedBack = refuseHandBackSignOff(taskId, identity.workerName);
  if (handedBack) {
    broadcastEvent(
      "job.result_sign_off_refused",
      "warn",
      `Sign-off of Task ${taskId} refused: handed-back draft`
    );
    return refused(handedBack, "hand_back");
  }

  const designated = designatedApproversForFunction(job.businessFunctionId);
  const handBack = handBackForJob(taskId);
  const namedForHandBack = Boolean(
    handBack && (
      (handBack.newSigner && handBack.newSigner.trim().toLowerCase() === identity.workerName.trim().toLowerCase()) ||
      (job.enterpriseId && isOwner(job.enterpriseId, identity.workerName))
    )
  );
  if (!namedForHandBack && !mayDecideForFunction(designated, identity.workerName)) {
    broadcastEvent(
      "job.result_sign_off_refused",
      "warn",
      `Sign-off of Task ${taskId} refused: ${identity.workerName} is not the accountable approver`
    );
    return refused(
      [
        `${identity.workerName} is not accountable for this Function, so this sign-off was not recorded.`,
        `The staffing plan you applied made ${designated.join(" or ")} accountable for it.`,
        `  /task signoff ${taskId} --as "${designated[0]}"`,
      ].join("\n")
    );
  }

  const setAside = readResultSetAsideStanding(job);
  if (setAside.state === "set_aside") {
    return refused(
      `${setAside.setAside.worker} set ${taskId} aside: "${setAside.setAside.reason}". A result that was set aside cannot then be signed off; ask for the work again. Nothing was recorded.`
    );
  }

  // B10: a result can't be signed off before the results it was built from.
  const outOfOrder = refuseSignOffOrder(job);
  if (outOfOrder) {
    return refused(outOfOrder.message, outOfOrder.code);
  }

  // Named work is checked again at sign-off: a result on work that is now
  // locked, or has "no AI" on, is not accepted (work/workLocks.ts).
  const locked = refuseWorkUnderLocks({ workId: job.workId, enterpriseId: job.enterpriseId, functionId: job.businessFunctionId, when: "signoff" });
  if (locked) {
    return refused(`${locked} Nothing was recorded.`);
  }

  const standing = readResultSignOffStanding(job);
  if (standing.state === "signed") {
    return refused(
      `${taskId} was already signed off by ${standing.signOff.worker}. Nothing was recorded.`
    );
  }

  let acceptanceInput: EmailAcceptanceInput | undefined;
  if (parsed.note) {
    if (!job.enterpriseId) {
      return refused("This Task has no business, so a freelancer note cannot be attached. Nothing was recorded.");
    }
    acceptanceInput = {
      enterpriseId: job.enterpriseId,
      jobId: job.id,
      recordedBy: identity.workerName,
      freelancerName: parsed.note.freelancerName ?? "",
      emailDate: parsed.note.emailDate ?? "",
      ...(parsed.note.emailSubject ? { emailSubject: parsed.note.emailSubject } : {}),
      ...(parsed.note.emailSender ? { emailSender: parsed.note.emailSender } : {}),
    };
    const noteRefused = refuseEmailAcceptance(acceptanceInput, job);
    if (noteRefused) return refused(noteRefused);
  }

  // The sign-off and the step that follows it are written together (C2).
  const signedAt = Date.now();
  let acceptanceLine: string | undefined;
  runtimeDb.transaction(() => {
    recordResultSignOff(job, identity.workerName, signedAt, signOffAlongside(job));
    revokeOffTerminalLinksForJob(job.id, signedAt);
    recordNextAction("after-sign-off", job.id, signedAt, identity.workerName);
    if (acceptanceInput) {
      const recorded = recordEmailAcceptance({ ...acceptanceInput, now: signedAt }, job);
      if ("refused" in recorded) throw new Error(recorded.refused);
      acceptanceLine = formatEmailAcceptanceLine(recorded, identity.workerName);
    }
  })();
  broadcastEvent(
    "job.result_signed_off",
    "success",
    `Result of Task ${taskId} signed off by ${identity.workerName}`
  );

  // What any check of it said is kept with the sign-off.
  recordCheckSeenAtSignOff(job, identity.workerName);

  const claim = claimNextAction("after-sign-off", job.id);
  const { routeLine, handOff } = claim === "taken"
    ? { routeLine: undefined, handOff: { handed: false } as ReturnType<typeof deliverHandOff> }
    : runAfterSignOff(job, identity.workerName);
  if (claim === "claimed") finishNextAction("after-sign-off", job.id);

  return {
    signedOff: true,
    message: [
      `Signed off: ${taskId}`,
      acceptanceLine ?? `Signed off by: ${identity.workerName}`,
      "This records that they read the result and accept it as it stands now. It does not prove the result is correct.",
      ...(routeLine ? ["", routeLine] : []),
      ...(handOff.message ? ["", handOff.message] : []),
    ].join("\n"),
  };
}

/**
 * What follows a sign-off: a route that waited for it, and a hand-off to a
 * person. Run once when the sign-off is made, and again at start-up if Arturo
 * stopped before it finished (runtime/nextActions.ts). Each keeps its own
 * one-time claim, so a replay never makes a step twice.
 *
 * SIDE EFFECT: May create a Task or a person's task, and broadcasts events.
 */
export function runAfterSignOff(job: Job, signedOffBy: string): { readonly routeLine?: string; readonly handOff: ReturnType<typeof deliverHandOff> } {
  // A route that waited for this sign-off goes on now; the sign-off stands whatever happens.
  let routeLine: string | undefined;
  try {
    const route = continueRouteAfterSignOff(job);
    if (route && "sent" in route) routeLine = `It goes on along its route: ${route.sent} is working from it now.`;
    else if (route && "stopped" in route) routeLine = `Its route did not go on: ${route.stopped}`;
  } catch (error: unknown) {
    routeLine = `Its route did not go on: ${error instanceof Error ? error.message : String(error)}`;
  }

  // The sign-off is recorded first and stands whatever happens next.
  const handOff = deliverHandOff(job, signedOffBy);
  if (handOff.handed) {
    broadcastEvent(
      "human_task.created",
      "info",
      `Human task created: ${handOff.humanTaskId} (hand-off of ${job.id} to ${handOff.to})`
    );
  }
  return { routeLine, handOff };
}
