import crypto from "crypto";

import { authenticatedUserId } from "../identity/authenticatedContext";
import {
  clearPersistedResultSetAsides,
  loadResultSetAside,
  saveResultSetAside,
} from "../storage/resultSetAsideRepository";
import type { Job } from "./jobQueue";
import { hashResult, refuseResultSignOff } from "./resultSignOff";
import { getLocalApprovalSigningSecret } from "./runtimeSecrets";
import { formatNzDay } from "../core/nzTime";

/**
 * A person's recorded decision not to accept one finished result, and why.
 *
 * A result could only be signed off or left alone. A lawyer who read a review,
 * found its most important verdict backwards and declined it had nowhere to
 * record that, so the result sat under "nobody has signed it off" for good:
 * the file said nothing about whether anyone had read it, and a list that
 * never empties teaches people to click through it. Asked for four times in
 * one demonstration.
 *
 * Setting aside is the opposite of a sign-off, kept as its own signed record
 * with its own purpose so neither can ever verify as the other. It never
 * accepts, never releases and never hands anything on; it records that a
 * named person read this exact result, declined it, and why.
 */
export type ResultSetAside = {
  jobId: string;
  jobCreatedAt: number;
  worker: string;
  userId?: string;
  resultSha256: string;
  reason: string;
  timestamp: number;
  /**
   * Set aside by Arturo itself, not by a person: a Task on named work that
   * was locked, or had "no AI" turned on, while it ran (work/workLocks.ts).
   * Signed with its own purpose, so a system set-aside never verifies as a
   * person's, nor a person's as the system's.
   */
  bySystem?: true;
  signature: string;
};

/** The name a set-aside by Arturo itself is kept under. Never a person's. */
export const SYSTEM_SET_ASIDE_WORKER = "Arturo";

export type ResultSetAsideStanding =
  | { readonly state: "none" }
  | { readonly state: "set_aside"; readonly setAside: ResultSetAside }
  | { readonly state: "superseded"; readonly setAside: ResultSetAside }
  | { readonly state: "unverified" };

/** The longest reason kept. */
export const MAX_SET_ASIDE_REASON_LENGTH = 500;

type SettableJob = Pick<Job, "id" | "createdAt" | "status" | "output" | "requiredCapabilities">;

/** PURE: No side effects. */
export function createResultSetAsidePayload(setAside: Omit<ResultSetAside, "signature">): string {
  return JSON.stringify({
    purpose: setAside.bySystem ? "result-set-aside-system" : "result-set-aside",
    jobId: setAside.jobId,
    jobCreatedAt: setAside.jobCreatedAt,
    ...(setAside.userId !== undefined ? { userId: setAside.userId } : {}),
    worker: setAside.worker,
    resultSha256: setAside.resultSha256,
    reason: setAside.reason,
    timestamp: setAside.timestamp,
  });
}

/** PURE: No side effects. */
export function signResultSetAside(setAside: Omit<ResultSetAside, "signature">, secret: string): string {
  return crypto.createHmac("sha256", secret).update(createResultSetAsidePayload(setAside)).digest("hex");
}

/** PURE: No side effects. */
export function verifyResultSetAsideSignature(setAside: ResultSetAside, secret: string): boolean {
  const expected = Buffer.from(signResultSetAside(setAside, secret));
  const actual = Buffer.from(String(setAside.signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * What, if anything, has been set aside for this Task's current result. Counts
 * only a record whose signature verifies, for this Task and not an earlier one
 * with the same id, and for the result as it reads now.
 *
 * SIDE EFFECT: Reads the runtime database and the signing secret.
 */
export function readResultSetAsideStanding(job: SettableJob): ResultSetAsideStanding {
  const setAside = loadResultSetAside(job.id);
  if (!setAside) return { state: "none" };
  if (setAside.jobId !== job.id || !verifyResultSetAsideSignature(setAside, getLocalApprovalSigningSecret())) {
    return { state: "unverified" };
  }
  if (setAside.jobCreatedAt !== job.createdAt) return { state: "none" };
  return job.output !== undefined && setAside.resultSha256 === hashResult(job.output)
    ? { state: "set_aside", setAside }
    : { state: "superseded", setAside };
}

/**
 * Why a reason would not be kept, or undefined.
 *
 * PURE: No side effects.
 */
export function refuseSetAsideReason(reason: string): string | undefined {
  const trimmed = reason.replace(/\s+/g, " ").trim();
  if (!trimmed) return "Say why you are setting it aside, in a few words. The reason is kept on the file.";
  if (trimmed.length > MAX_SET_ASIDE_REASON_LENGTH) {
    return `Keep the reason under ${MAX_SET_ASIDE_REASON_LENGTH} characters.`;
  }
  return undefined;
}

/**
 * Signs and stores a named person's decision to set a result aside. The caller
 * must already have established who it is and that they may.
 *
 * SIDE EFFECT: Reads the signing secret and writes the runtime database.
 */
export function recordResultSetAside(
  job: SettableJob,
  worker: string,
  reason: string,
  timestamp = Date.now()
): ResultSetAside {
  const refusal = refuseResultSignOff(job, job.id) ?? refuseSetAsideReason(reason);
  if (refusal) throw new Error(refusal);
  const unsigned = {
    jobId: job.id,
    jobCreatedAt: job.createdAt,
    worker,
    ...(authenticatedUserId() ? { userId: authenticatedUserId() } : {}),
    resultSha256: hashResult(job.output ?? ""),
    reason: reason.replace(/\s+/g, " ").trim(),
    timestamp,
  };
  const setAside = { ...unsigned, signature: signResultSetAside(unsigned, getLocalApprovalSigningSecret()) };
  saveResultSetAside(setAside);
  return setAside;
}

/**
 * Signs and stores Arturo's own setting aside of a finished result, because
 * the named work it belongs to was locked or had "no AI" turned on while it
 * ran. Never under a person's name or user id, and never a sign-off: nothing
 * goes on from it, and it cannot then be signed off.
 *
 * SIDE EFFECT: Reads the signing secret and writes the runtime database.
 */
export function recordSystemSetAside(
  job: Pick<Job, "id" | "createdAt" | "output">,
  reason: string,
  timestamp = Date.now()
): ResultSetAside {
  const kept = reason.replace(/\s+/g, " ").trim().slice(0, MAX_SET_ASIDE_REASON_LENGTH) || "The work it belongs to was locked while it ran.";
  const unsigned = {
    jobId: job.id,
    jobCreatedAt: job.createdAt,
    worker: SYSTEM_SET_ASIDE_WORKER,
    resultSha256: hashResult(job.output ?? ""),
    reason: kept,
    timestamp,
    bySystem: true as const,
  };
  const setAside = { ...unsigned, signature: signResultSetAside(unsigned, getLocalApprovalSigningSecret()) };
  saveResultSetAside(setAside);
  return setAside;
}

/**
 * The line the terminal and the page both show, from the same standing.
 *
 * PURE: No side effects.
 */
export function describeResultSetAside(standing: ResultSetAsideStanding): string | undefined {
  if (standing.state === "set_aside") {
    const on = formatNzDay(standing.setAside.timestamp);
    const reason = /[.!?]$/.test(standing.setAside.reason) ? standing.setAside.reason : `${standing.setAside.reason}.`;
    if (standing.setAside.bySystem) {
      return `Arturo set this result aside on ${on}, because the work it belongs to changed while it ran. It can't be used or signed off. Reason: ${reason}`;
    }
    return `${standing.setAside.worker} set this result aside on ${on}. It was read and not accepted. Reason: ${reason}`;
  }
  if (standing.state === "unverified") {
    return "A set-aside is stored for this Task but its signature does not verify, so it is not counted.";
  }
  return undefined;
}

/** SIDE EFFECT: Deletes every stored set-aside. */
export function clearResultSetAsides(): void {
  clearPersistedResultSetAsides();
}
