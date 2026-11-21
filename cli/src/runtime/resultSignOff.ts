import crypto from "crypto";

import { authenticatedUserId } from "../identity/authenticatedContext";
import {
  clearPersistedResultSignOffs,
  loadResultSignOff,
  saveResultSignOff,
} from "../storage/resultSignOffRepository";
import { isGovernedExecutionJob } from "./approvedJobRelease";
import type { Job } from "./jobQueue";
import { getLocalApprovalSigningSecret } from "./runtimeSecrets";
import { formatNzDay } from "../core/nzTime";
import { getWork } from "../work/workStore";

/**
 * A person's recorded acceptance of one finished result.
 *
 * `/approve` on governed work lets the work start, before there is anything to
 * read. Until this existed there was no way to record the other thing a person
 * does — reading what came back and accepting it — so "approved" was taken for
 * both. A sign-off is deliberately not an approval decision: it never releases
 * work, never counts toward an approval chain, and is bound to the exact text
 * that was accepted.
 *
 * It records that a named person accepted the result. It does not prove who was
 * at the keyboard, and it does not make the result correct.
 */
export type ResultSignOff = {
  jobId: string;
  /** Task ids are reused after a reset; the creation time tells two apart. */
  jobCreatedAt: number;
  worker: string;
  userId?: string;
  resultSha256: string;
  /**
   * What the person had beside the result and accepted it with: the results
   * it was built on along a route, and a check kept with it, each by the
   * SHA-256 of its text. Inside the signature, so the record says what the
   * whole pack read when it was signed off.
   */
  alongside?: { taskId: string; role: "built-on" | "check"; sha256: string }[];
  /**
   * The named work's terms the result was accepted under: its matter type and
   * when that type last changed. Inside the signature. A matter's type is
   * part of what is signed off, so when it changes the sign-off falls away
   * (Grace, addendum 1). Absent for a Task on no named work.
   */
  work?: SignOffWorkTerms;
  timestamp: number;
  signature: string;
};

/** A matter's type and when it last changed, as a sign-off binds them. */
export type SignOffWorkTerms = { workId: string; matterType: string | null; typeChangedAt: number | null };

export type ResultSignOffStanding =
  | { readonly state: "none" }
  | { readonly state: "signed"; readonly signOff: ResultSignOff }
  | {
      readonly state: "superseded";
      readonly signOff: ResultSignOff;
      /** The result reads the same, but its matter's type changed (or can't be read) since: the sign-off fell away. */
      readonly workChanged?: true;
    }
  | { readonly state: "unverified" };

type SignableJob = Pick<
  Job,
  "id" | "createdAt" | "status" | "output" | "requiredCapabilities"
> & Partial<Pick<Job, "workId">>;

/**
 * The named work's terms now, for binding into a sign-off and checking it.
 * Undefined for a Task on no named work; "unreadable" when its record is
 * missing or doesn't verify (any sign-off then falls away: fail closed).
 *
 * SIDE EFFECT: Reads the work record and the signing secret.
 */
function currentWorkTerms(job: SignableJob): SignOffWorkTerms | "unreadable" | undefined {
  if (!job.workId) return undefined;
  const standing = getWork(job.workId);
  if (standing.state !== "verified") return "unreadable";
  return { workId: job.workId, matterType: standing.work.matterType ?? null, typeChangedAt: standing.work.typeChangedAt ?? null };
}

/**
 * PURE: No side effects.
 */
export function hashResult(result: string): string {
  return crypto.createHash("sha256").update(result).digest("hex");
}

/**
 * Serialises what a sign-off attests to.
 *
 * The purpose field keeps this from ever verifying as an approval decision,
 * which is signed with the same secret.
 *
 * PURE: No side effects.
 */
export function createResultSignOffPayload(
  signOff: Omit<ResultSignOff, "signature">
): string {
  return JSON.stringify({
    purpose: "result-sign-off",
    jobId: signOff.jobId,
    jobCreatedAt: signOff.jobCreatedAt,
    ...(signOff.userId !== undefined ? { userId: signOff.userId } : {}),
    worker: signOff.worker,
    resultSha256: signOff.resultSha256,
    ...(signOff.alongside?.length ? { alongside: signOff.alongside.map((one) => ({ taskId: one.taskId, role: one.role, sha256: one.sha256 })) } : {}),
    ...(signOff.work ? { work: { workId: signOff.work.workId, matterType: signOff.work.matterType, typeChangedAt: signOff.work.typeChangedAt } } : {}),
    timestamp: signOff.timestamp,
  });
}

/**
 * PURE: No side effects.
 */
export function signResultSignOff(
  signOff: Omit<ResultSignOff, "signature">,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(createResultSignOffPayload(signOff))
    .digest("hex");
}

/**
 * PURE: No side effects.
 */
export function verifyResultSignOffSignature(
  signOff: ResultSignOff,
  secret: string
): boolean {
  const expected = Buffer.from(signResultSignOff(signOff, secret));
  const actual = Buffer.from(String(signOff.signature ?? ""));
  return (
    expected.length === actual.length &&
    crypto.timingSafeEqual(expected, actual)
  );
}

/**
 * Says why a Task's result cannot be signed off, or undefined when it can.
 *
 * PURE: No side effects.
 */
export function refuseResultSignOff(
  job: SignableJob | undefined,
  taskId: string
): string | undefined {
  if (!job) {
    return `There is no Task called ${taskId}. See your Tasks with /tasks`;
  }
  if (!isGovernedExecutionJob(job)) {
    return `${taskId} is itself a review by a person, so its decision is already the sign-off. Nothing was recorded.`;
  }
  if (job.status !== "completed" || !job.output) {
    return `${taskId} has not finished, so there is no result to sign off yet. Nothing was recorded.`;
  }
  return undefined;
}

/**
 * Reads what, if anything, has been signed off for this Task's current result.
 *
 * A stored record counts only if its signature verifies, it belongs to this
 * Task and not an earlier one that had the same id, and the result still reads
 * exactly as it did when it was accepted.
 *
 * SIDE EFFECT: Reads the runtime database and the signing secret.
 */
export function readResultSignOffStanding(
  job: SignableJob
): ResultSignOffStanding {
  const signOff = loadResultSignOff(job.id);
  if (!signOff) {
    return { state: "none" };
  }
  if (
    signOff.jobId !== job.id ||
    !verifyResultSignOffSignature(signOff, getLocalApprovalSigningSecret())
  ) {
    return { state: "unverified" };
  }
  if (signOff.jobCreatedAt !== job.createdAt) {
    return { state: "none" };
  }
  if (job.output === undefined || signOff.resultSha256 !== hashResult(job.output)) {
    return { state: "superseded", signOff };
  }
  // The matter's type is part of what was signed off: a change since (or a
  // record that can no longer be read) makes the sign-off fall away. A
  // sign-off made before sign-offs bound the type stands only while the type
  // has never been changed.
  const terms = currentWorkTerms(job);
  if (terms === "unreadable") return { state: "superseded", signOff, workChanged: true };
  if (terms) {
    const signed = signOff.work;
    const fellAway = (signed?.typeChangedAt ?? null) !== terms.typeChangedAt || (signed !== undefined && (signed.workId !== terms.workId || signed.matterType !== terms.matterType));
    if (fellAway) return { state: "superseded", signOff, workChanged: true };
  }
  return { state: "signed", signOff };
}

/**
 * Signs and stores a named person's acceptance of a finished result.
 *
 * The caller must already have established who is signing and that they may.
 *
 * SIDE EFFECT: Reads the signing secret and writes the runtime database.
 */
export function recordResultSignOff(
  job: SignableJob,
  worker: string,
  timestamp = Date.now(),
  alongside: ResultSignOff["alongside"] = []
): ResultSignOff {
  const refusal = refuseResultSignOff(job, job.id);
  if (refusal) {
    throw new Error(refusal);
  }
  const unsigned = {
    jobId: job.id,
    jobCreatedAt: job.createdAt,
    worker,
    ...(authenticatedUserId() ? { userId: authenticatedUserId() } : {}),
    resultSha256: hashResult(job.output ?? ""),
    ...(alongside && alongside.length ? { alongside } : {}),
    ...(() => {
      const terms = currentWorkTerms(job);
      return terms && terms !== "unreadable" ? { work: terms } : {};
    })(),
    timestamp,
  };
  const signOff = {
    ...unsigned,
    signature: signResultSignOff(unsigned, getLocalApprovalSigningSecret()),
  };
  saveResultSignOff(signOff);
  return signOff;
}

/**
 * SIDE EFFECT: Deletes every stored sign-off.
 */
export function clearResultSignOffs(): void {
  clearPersistedResultSignOffs();
}

/**
 * Says why a Task's result may not be handed to a person yet, or undefined
 * when it may.
 *
 * A result an AI model wrote reaches a person's desk only once someone has
 * signed it off. The sign-off was a record and nothing more: a brief whose
 * closing line misdescribed its own sources could have gone straight to the
 * designer with nobody having accepted it. Work handed from one AI Worker to
 * another is not held here; that is internal work, and runs freely.
 *
 * SIDE EFFECT: Reads the stored sign-off and the signing secret.
 */
export function refuseUnacceptedHandOver(
  job: SignableJob
): string | undefined {
  if (!job.output?.startsWith("Evidence status: UNVERIFIED MODEL SYNTHESIS")) {
    return undefined;
  }
  const standing = readResultSignOffStanding(job);
  if (standing.state === "signed") {
    return undefined;
  }
  const why =
    standing.state === "superseded" && standing.workChanged
      ? `${standing.signOff.worker}'s sign-off fell away when its matter's type changed`
      : standing.state === "superseded"
      ? `${standing.signOff.worker} signed off an earlier version of it, not this one`
      : "nobody has signed it off";
  return [
    `${job.id} was written by an AI model and ${why}, so it was not handed to a person.`,
    `Read it with /task inspect ${job.id}. If you accept it, run /task signoff ${job.id} and then create this Human Task again.`,
  ].join("\n");
}

/**
 * Who stands behind a finished result that is being handed to someone, in
 * the clause the hand-over headings use.
 *
 * The hand-over heading said "written by an AI Worker and not checked by
 * anyone" even directly under a result its Function's owner had signed off,
 * so the record and the page a designer reads disagreed.
 *
 * SIDE EFFECT: Reads the stored sign-off.
 */
export function describeHandedWork(job: SignableJob): string {
  const standing = readResultSignOffStanding(job);
  if (standing.state === "signed") {
    const on = formatNzDay(standing.signOff.timestamp);
    return `written by an AI Worker and signed off by ${standing.signOff.worker} on ${on}, which records that they accepted it, not that it is correct`;
  }
  return "written by an AI Worker and not checked by anyone";
}

/**
 * Says where a finished result stands, for the Task's own detail view.
 *
 * Returns nothing for a Task that has no result to sign off.
 *
 * PURE: No side effects.
 */
export function describeResultSignOff(
  job: SignableJob,
  standing: ResultSignOffStanding
): string | undefined {
  if (refuseResultSignOff(job, job.id)) {
    return undefined;
  }
  if (standing.state === "signed") {
    const on = formatNzDay(standing.signOff.timestamp);
    return `${standing.signOff.worker} signed off this result on ${on}. That records that they accepted it; it does not prove the result is correct.`;
  }
  if (standing.state === "superseded" && standing.workChanged) {
    return `${standing.signOff.worker}'s sign-off of this result fell away when its matter's type changed. Nobody has signed it off since.`;
  }
  if (standing.state === "superseded") {
    return `${standing.signOff.worker} signed off an earlier version of this result. This version has not been signed off.`;
  }
  if (standing.state === "unverified") {
    return "A sign-off is stored for this Task but its signature does not verify, so it is not counted. Nobody has signed off this result.";
  }
  return `Nobody has signed off this result. Once you have read it and accept it: /task signoff ${job.id}`;
}
