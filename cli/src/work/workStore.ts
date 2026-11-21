/**
 * Reads and writes named work, and keeps the signed log of every change.
 *
 * Every read verifies the record's signature; a record that does not verify
 * is reported as unverified and never throws. "No AI" is resolved up the
 * chain from a deal to its book at every check (effectiveNoAi), so turning it
 * on for a book changes nothing on the deal and still stops it. A chain that
 * is missing a record, fails to verify, crosses into another business, loops
 * back on itself or runs deeper than MAX_WORK_DEPTH fails closed: the work is
 * treated as "no AI".
 *
 * The change log is append-only and hash-chained: every entry names the one
 * before it by SHA-256 and is signed with its own purpose, so an edit or a
 * removal in the middle shows (verifyWorkChangeLog), the same way the
 * authority log does (identity/companySignIn.ts).
 *
 * Signatures use the local approval signing key, so someone who can read the
 * data directory and that key can forge them (THREAT_MODEL.md item 1).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import crypto from "node:crypto";

import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { appendWorkChange, clearPersistedWorkChanges, loadWorkChanges } from "../storage/workChangeRepository";
import { clearPersistedWork, insertWorkRecord, loadWorkRecordRow, loadWorkRecordRows, replaceWorkRecord } from "../storage/workRepository";
import {
  MAX_WORK_DEPTH,
  signWorkRecord,
  UNVERIFIED_WORK,
  verifyWorkRecordSignature,
  type UnsignedWorkRecord,
  type WorkRecord,
  type WorkStanding,
} from "./workRecord";

export type WorkChange = {
  readonly enterpriseId: string;
  /** Absent for a change to the business's practice setting. */
  readonly workId?: string;
  readonly what: string;
  readonly by: string;
  readonly byUserId?: string;
  readonly reason?: string;
  readonly at: number;
  readonly prevSha256: string;
  readonly signature: string;
};

const sha256 = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

/** SIDE EFFECT: Reads the signing secret. */
function signChange(payload: Omit<WorkChange, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(JSON.stringify({ purpose: "work-change", ...payload })).digest("hex");
}

/** The standing of a stored record's text. SIDE EFFECT: Reads the signing secret. */
function standingOf(id: string, text: string | undefined): WorkStanding {
  if (text === undefined) return { state: "missing", id };
  let record: WorkRecord;
  try {
    record = JSON.parse(text) as WorkRecord;
  } catch {
    return { state: "unverified", id };
  }
  if (!record || record.id !== id || !verifyWorkRecordSignature(record, getLocalApprovalSigningSecret())) return { state: "unverified", id };
  return { state: "verified", work: record };
}

/** One piece of work, verified on every read. SIDE EFFECT: Reads the runtime database and the signing secret. */
export function getWork(id: string): WorkStanding {
  return standingOf(id, loadWorkRecordRow(id));
}

/** Every piece of work at a business that verifies, oldest first, with the ids of any that do not. SIDE EFFECT: Reads the runtime database. */
export function listWorkFor(enterpriseId: string): { readonly work: WorkRecord[]; readonly unverified: string[] } {
  const work: WorkRecord[] = [];
  const unverified: string[] = [];
  for (const row of loadWorkRecordRows()) {
    const standing = standingOf(row.id, row.recordJson);
    if (standing.state === "verified") {
      if (standing.work.enterpriseId === enterpriseId) work.push(standing.work);
    } else {
      // An unverified row says nothing trustworthy about its business, so only
      // rows whose stored business matches are reported against this one.
      try {
        if ((JSON.parse(row.recordJson) as { enterpriseId?: string }).enterpriseId === enterpriseId) unverified.push(row.id);
      } catch {
        unverified.push(row.id);
      }
    }
  }
  return { work, unverified };
}

/** Signs and stores a new record. The caller has already checked it. SIDE EFFECT: Writes one row. */
export function insertSignedWork(unsigned: UnsignedWorkRecord): WorkRecord {
  const record = { ...unsigned, signature: signWorkRecord(unsigned, getLocalApprovalSigningSecret()) };
  insertWorkRecord(record);
  return record;
}

/**
 * Stores a changed record under the next version, signed again. The id,
 * business, kind and parent never change.
 *
 * SIDE EFFECT: Replaces one row.
 */
export function replaceSignedWork(
  previous: WorkRecord,
  change: Partial<Pick<WorkRecord, "noAi" | "matterType" | "paidEscalationAllowed" | "cancelledAt" | "cancelledBy" | "cancelledByUserId" | "cancelReason" | "typeHeld" | "typeChangedAt">>,
  by: string,
  at: number
): WorkRecord {
  // Cancelled work is read-only: never reopened, never changed again.
  if (previous.cancelledAt !== undefined) throw new Error(`${previous.name} was cancelled, so it can't be changed or reopened.`);
  const { signature: _signature, ...rest } = previous;
  const unsigned: UnsignedWorkRecord = { ...rest, ...change, version: previous.version + 1, changedAt: at, changedBy: by };
  const record = { ...unsigned, signature: signWorkRecord(unsigned, getLocalApprovalSigningSecret()) };
  replaceWorkRecord(record);
  return record;
}

export type WorkChain = { readonly chain: WorkRecord[] } | { readonly failClosed: string };

/**
 * The work and the records above it, nearest first: a deal, then its book.
 * Missing, unverified, another business, not a book, a cycle or a longer
 * chain all fail closed.
 *
 * PURE apart from the lookup.
 */
export function resolveWorkChain(id: string, lookup: (id: string) => WorkStanding = getWork): WorkChain {
  const first = lookup(id);
  if (first.state === "missing") return { failClosed: `There is no work called ${id}, so nothing on it can go to an AI worker.` };
  if (first.state === "unverified") return { failClosed: UNVERIFIED_WORK };
  const chain: WorkRecord[] = [first.work];
  const seen = new Set<string>([first.work.id]);
  let current = first.work;
  while (current.parentWorkId) {
    if (seen.has(current.parentWorkId)) return { failClosed: `The work ${first.work.name} belongs to itself through its parents, so it is treated as "no AI".` };
    if (chain.length >= MAX_WORK_DEPTH) return { failClosed: `The work ${first.work.name} is nested deeper than ${MAX_WORK_DEPTH}, so it is treated as "no AI".` };
    const parent = lookup(current.parentWorkId);
    if (parent.state !== "verified") return { failClosed: `The record of ${current.parentWorkId}, which ${current.name} belongs to, does not verify or is missing, so nothing on it can go to an AI worker.` };
    if (parent.work.enterpriseId !== first.work.enterpriseId) return { failClosed: `${current.name} names a parent at another business, so it is treated as "no AI".` };
    if (parent.work.kind !== "book") return { failClosed: `${current.name} names a parent that is not a book, so it is treated as "no AI".` };
    seen.add(parent.work.id);
    chain.push(parent.work);
    current = parent.work;
  }
  return { chain };
}

/**
 * Whether nothing on this work may go to an AI worker: "no AI" on it or on
 * any record above it, or a chain that fails closed. Resolved every time,
 * never copied.
 *
 * PURE apart from the lookup.
 */
export function effectiveNoAi(id: string, lookup: (id: string) => WorkStanding = getWork): { readonly noAi: boolean; readonly because: string } {
  const resolved = resolveWorkChain(id, lookup);
  if ("failClosed" in resolved) return { noAi: true, because: resolved.failClosed };
  const set = resolved.chain.find((work) => work.noAi);
  if (!set) return { noAi: false, because: "" };
  return set.id === id
    ? { noAi: true, because: `"No AI" is on for ${set.name}, so nothing on it goes to an AI worker.` }
    : { noAi: true, because: `"No AI" is on for ${set.name}, which ${resolved.chain[0].name} belongs to, so nothing on it goes to an AI worker.` };
}

/** Appends one signed, hash-chained entry to the change log. SIDE EFFECT: Reads the log and the signing secret; writes one row. */
export function logWorkChange(change: Omit<WorkChange, "prevSha256" | "signature">): WorkChange {
  const earlier = loadWorkChanges();
  const prevSha256 = earlier.length ? sha256(JSON.stringify(earlier[earlier.length - 1])) : "";
  const payload = { ...change, prevSha256 };
  const entry = { ...payload, signature: signChange(payload) };
  appendWorkChange(entry);
  return entry;
}

/**
 * Checks the change log: every entry signed, and each naming the one before.
 * Returns the position of the first entry that fails, or -1.
 *
 * SIDE EFFECT: Reads the log and the signing secret.
 */
export function verifyWorkChangeLog(): number {
  const entries = loadWorkChanges();
  for (const [index, entry] of entries.entries()) {
    const { signature, ...payload } = entry;
    const prev = index ? sha256(JSON.stringify(entries[index - 1])) : "";
    const expected = Buffer.from(signChange(payload));
    const actual = Buffer.from(String(signature ?? ""));
    if (entry.prevSha256 !== prev || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return index;
  }
  return -1;
}

/** One business's log, or one piece of work's. SIDE EFFECT: Reads the log. */
export function listWorkChanges(enterpriseId: string, workId?: string): WorkChange[] {
  return loadWorkChanges().filter((entry) => entry.enterpriseId === enterpriseId && (workId === undefined || entry.workId === workId));
}

/** SIDE EFFECT: Deletes every work record and the change log (tests and /reset). */
export function clearWork(): void {
  clearPersistedWork();
  clearPersistedWorkChanges();
}
