/**
 * Hand-back of waiting drafts (setup-and-staff final v3, 4h). When someone
 * loses the sign-off right, their waiting drafts come back to the owner,
 * who names a new signer. Nothing passes on automatically, and the owner
 * is never the default signer. Naming one is owner-only, with a typed
 * reason and a signed Event. The new signer is checked again at sign-off.
 * Drafts keep showing whose they were. The owner can always sign off, so
 * a hand-back never lands on nobody. For locked or marked work, the new
 * signer must be the owner or a named stand-in.
 *
 * SIDE EFFECT: Reads and writes the runtime database; reads the signing secret.
 */

import crypto from "node:crypto";

import { effectiveFunctionMark, isBlockingFunctionMark } from "../business/functionMark";
import { isOwner, listPeople, maySignOff } from "../identity/companySignIn";
import { listJobs, type Job } from "../runtime/jobQueue";
import { readResultSignOffStanding } from "../runtime/resultSignOff";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { formatRuntimeEventTimestamp } from "../ui/uiTimelineEntries";
import { refuseWorkUnderLocks } from "../work/workLocks";
import { getDraftsFor } from "./draftsFor";
import { designatedApproversForFunction } from "./functionApprovers";
import { clearPersistedHandBacks, loadHandBackRows, saveHandBackRow } from "../storage/handBackRepository";

export type HandBackRecord = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly jobId: string;
  readonly previousSigner: string;
  readonly changedBy: string;
  readonly changedByUserId?: string;
  readonly lostRightAt: number;
  readonly newSigner?: string;
  readonly namedBy?: string;
  readonly namedByUserId?: string;
  readonly reason?: string;
  readonly namedAt?: number;
  readonly signature: string;
};

export type HandBackRefusal = { readonly refused: string };

const PURPOSE = "hand-back";
const NZ_ZONE = "Pacific/Auckland";

function payloadOf(record: Omit<HandBackRecord, "signature">): string {
  return JSON.stringify({
    purpose: PURPOSE,
    id: record.id,
    enterpriseId: record.enterpriseId,
    jobId: record.jobId,
    previousSigner: record.previousSigner,
    changedBy: record.changedBy,
    changedByUserId: record.changedByUserId ?? null,
    lostRightAt: record.lostRightAt,
    newSigner: record.newSigner ?? null,
    namedBy: record.namedBy ?? null,
    namedByUserId: record.namedByUserId ?? null,
    reason: record.reason ?? null,
    namedAt: record.namedAt ?? null,
  });
}

function sign(record: Omit<HandBackRecord, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(record)).digest("hex");
}

function verified(record: HandBackRecord): boolean {
  try {
    const { signature, ...rest } = record;
    const expected = Buffer.from(sign(rest));
    const actual = Buffer.from(String(signature ?? ""));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function loadAll(): HandBackRecord[] {
  const records: HandBackRecord[] = [];
  for (const text of loadHandBackRows()) {
    try {
      records.push(JSON.parse(text) as HandBackRecord);
    } catch {
      // Skip unreadable rows.
    }
  }
  return records.filter(verified);
}

function write(record: Omit<HandBackRecord, "signature">): HandBackRecord {
  const signed: HandBackRecord = { ...record, signature: sign(record) };
  saveHandBackRow(signed.id, signed.enterpriseId, signed.jobId, JSON.stringify(signed));
  return signed;
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isUnsignedCompleted(job: Job): boolean {
  if (job.status !== "completed" || !job.output) return false;
  return readResultSignOffStanding(job).state !== "signed";
}

/** People this completed draft is waiting on, before a hand-back is opened. SIDE EFFECT: Reads staffing. */
export function expectedSignersForJob(job: Job): string[] {
  const designated = designatedApproversForFunction(job.businessFunctionId);
  if (designated.length > 0) return [...designated];
  if (job.enterpriseId && job.worker) {
    const standing = getDraftsFor(job.enterpriseId, job.worker);
    if (standing?.on && standing.signer) return [standing.signer];
  }
  return [];
}

/** Unsigned completed drafts this person was expected to sign off. SIDE EFFECT: Reads jobs and sign-offs. */
export function waitingDraftsForPerson(enterpriseId: string, person: string): Job[] {
  return listJobs().filter((job) => {
    if (job.enterpriseId !== enterpriseId) return false;
    if (!isUnsignedCompleted(job)) return false;
    return expectedSignersForJob(job).some((name) => same(name, person));
  });
}

/** Open hand-backs (no new signer yet) at a business. SIDE EFFECT: Reads the store. */
export function listOpenHandBacks(enterpriseId?: string): HandBackRecord[] {
  return loadAll().filter((record) => {
    if (record.newSigner) return false;
    if (enterpriseId && record.enterpriseId !== enterpriseId) return false;
    return true;
  });
}

/** The open or named hand-back for a Task, if there is one. SIDE EFFECT: Reads the store. */
export function handBackForJob(jobId: string): HandBackRecord | undefined {
  return loadAll()
    .filter((record) => record.jobId === jobId)
    .sort((a, b) => (b.namedAt ?? b.lostRightAt) - (a.namedAt ?? a.lostRightAt))[0];
}

/**
 * Opens a hand-back for each of this person's waiting drafts.
 * SIDE EFFECT: Writes signed records and a Timeline event.
 */
export function openHandBacksForLostRight(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly changedBy: string;
  readonly changedByUserId?: string;
  readonly at?: number;
}): readonly HandBackRecord[] {
  const at = input.at ?? Date.now();
  const opened: HandBackRecord[] = [];
  for (const job of waitingDraftsForPerson(input.enterpriseId, input.person)) {
    const existing = handBackForJob(job.id);
    if (existing && !existing.newSigner && same(existing.previousSigner, input.person)) {
      opened.push(existing);
      continue;
    }
    opened.push(
      write({
        id: crypto.randomUUID(),
        enterpriseId: input.enterpriseId,
        jobId: job.id,
        previousSigner: input.person,
        changedBy: input.changedBy,
        ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
        lostRightAt: at,
      })
    );
  }
  if (opened.length > 0) {
    broadcastEvent(
      "staff.hand_back",
      "info",
      `${input.changedBy} took the sign-off right from ${input.person}. ${formatHandBackCount(opened.length)} came back to the owner to name a new signer.`
    );
  }
  return opened;
}

function isLockedOrMarked(job: Job): boolean {
  if (isBlockingFunctionMark(effectiveFunctionMark(job.businessFunctionId))) return true;
  return Boolean(
    refuseWorkUnderLocks({
      workId: job.workId,
      enterpriseId: job.enterpriseId,
      functionId: job.businessFunctionId,
      when: "signoff",
    })
  );
}

/** Named stand-in is built later; until then only the owner qualifies for locked work. PURE. */
export function isNamedStandIn(_enterpriseId: string, _name: string): boolean {
  return false;
}

function jobOf(jobId: string): Job | undefined {
  return listJobs().find((job) => job.id === jobId);
}

/**
 * Owner names a new signer for a handed-back draft, with a typed reason.
 * SIDE EFFECT: Writes a signed record and a Timeline event.
 */
export function nameHandBackSigner(input: {
  readonly enterpriseId: string;
  readonly jobId: string;
  readonly signer: string;
  readonly reason: string;
  readonly actor: { readonly workerName: string; readonly userId?: string };
  readonly now?: number;
}): HandBackRecord | HandBackRefusal {
  if (!isOwner(input.enterpriseId, input.actor.workerName)) {
    return { refused: "Only the owner can name a new signer for handed-back drafts. Nothing was changed." };
  }
  const reason = input.reason.trim();
  if (!reason) return { refused: "Type a reason for naming this signer. Nothing was changed." };
  const record = listOpenHandBacks(input.enterpriseId).find((one) => one.jobId === input.jobId);
  if (!record) return { refused: "That draft is not waiting for a new signer. Nothing was changed." };
  const signer = input.signer.trim();
  if (!signer) return { refused: "Choose someone who can sign off. Nothing was changed." };
  if (!maySignOff(input.enterpriseId, signer)) {
    return { refused: `${signer} may not sign off work at this business, so they were not named. Nothing was changed.` };
  }
  const job = jobOf(input.jobId);
  if (job && isLockedOrMarked(job)) {
    const allowed = isOwner(input.enterpriseId, signer) || isNamedStandIn(input.enterpriseId, signer);
    if (!allowed) {
      return {
        refused:
          "For locked or marked work, the new signer must be the owner or a named stand-in. Nothing was changed.",
      };
    }
  }
  const now = input.now ?? Date.now();
  const named = write({
    ...record,
    newSigner: signer,
    namedBy: input.actor.workerName,
    ...(input.actor.userId ? { namedByUserId: input.actor.userId } : {}),
    reason,
    namedAt: now,
  });
  broadcastEvent(
    "staff.hand_back_named",
    "info",
    `${input.actor.workerName} named ${signer} to sign off ${input.jobId} (was waiting for ${record.previousSigner}): ${reason}`
  );
  return named;
}

/**
 * Who may sign a handed-back draft now. The owner can always sign; a
 * named new signer is also checked here, and again at sign-off.
 * SIDE EFFECT: Reads the store.
 */
export function refuseHandBackSignOff(jobId: string, workerName: string): string | undefined {
  const record = handBackForJob(jobId);
  if (!record) return undefined;
  const enterpriseId = record.enterpriseId;
  if (isOwner(enterpriseId, workerName)) return undefined;
  if (!record.newSigner) {
    return "This draft is waiting for the owner to name a new signer, so this sign-off was not recorded.";
  }
  if (same(record.newSigner, workerName)) return undefined;
  return (
    `This draft was handed back from ${record.previousSigner}, and ${record.newSigner} was named to sign it off, ` +
    "so this sign-off was not recorded."
  );
}

/** Eligible people to name, owner included but never preselected. SIDE EFFECT: Reads identity. */
export function eligibleHandBackSigners(enterpriseId: string, jobId: string): string[] {
  const job = jobOf(jobId);
  const locked = job ? isLockedOrMarked(job) : false;
  return listPeople(enterpriseId)
    .filter((person) => {
      if (person.status === "suspended") return false;
      if (!maySignOff(enterpriseId, person.name) && person.role !== "owner") return false;
      if (locked) return person.role === "owner" || isNamedStandIn(enterpriseId, person.name);
      return maySignOff(enterpriseId, person.name) || person.role === "owner";
    })
    .map((person) => person.name);
}

export function formatHandBackCount(count: number): string {
  if (count <= 0) return "0 need a new signer";
  return `${count} need a new signer`;
}

export function formatRoleChangeHandBackConfirm(count: number): string {
  if (count === 1) {
    return "1 draft is waiting and will come back to the owner to choose who signs it off.";
  }
  return `${count} drafts are waiting and will come back to the owner to choose who signs them off.`;
}

export function formatHandBackSessionLine(count: number): string | undefined {
  if (count <= 0) return undefined;
  return `${formatHandBackCount(count)} — name a new signer from the staff menu.`;
}

export function formatHandBackWaitingSection(enterpriseId?: string): string | undefined {
  const open = listOpenHandBacks(enterpriseId);
  if (open.length === 0) return undefined;
  const lines = [
    "What's waiting — need a new signer",
    "",
    ...open.map((record) => {
      const when = formatRuntimeEventTimestamp(record.lostRightAt, NZ_ZONE);
      return (
        `${record.jobId} was waiting for ${record.previousSigner}. ` +
        `${record.changedBy} changed the sign-off right on ${when}.`
      );
    }),
  ];
  return lines.join("\n");
}

/** Drafts keep showing whose they were, even after a new signer is named. PURE. */
export function formatWasWaitingFor(record: HandBackRecord | undefined, current?: string): string | undefined {
  if (!record) return current;
  const was = `was waiting for ${record.previousSigner}`;
  if (record.newSigner) return `${was}; ${record.newSigner} was named to sign it off`;
  return `${was}; the owner will name a new signer`;
}

/** SIDE EFFECT: Deletes every hand-back (tests and /reset). */
export function clearHandBacks(): void {
  clearPersistedHandBacks();
}
