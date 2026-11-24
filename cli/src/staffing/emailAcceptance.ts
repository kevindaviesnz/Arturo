/**
 * The owner's record that a freelancer accepted a draft by email
 * (setup-and-staff final v3, 4i). It is a note attached to the owner's own
 * sign-off, never a sign-off in the freelancer's name, and never a grant
 * or a maySignOff right. No email body is stored.
 *
 * SIDE EFFECT: Reads and writes the runtime database; reads the signing secret.
 */

import crypto from "node:crypto";

import { isOwner, maySignOff } from "../identity/companySignIn";
import { getJob, type Job } from "../runtime/jobQueue";
import { hashResult } from "../runtime/resultSignOff";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import {
  clearPersistedEmailAcceptances,
  loadEmailAcceptanceRows,
  saveEmailAcceptanceRow,
} from "../storage/emailAcceptanceRepository";

export type EmailAcceptanceRecord = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly jobId: string;
  readonly resultSha256: string;
  readonly recordedBy: string;
  readonly recordedByUserId?: string;
  readonly freelancerName: string;
  readonly freelancerReported: true;
  readonly byEmail: true;
  readonly emailDate: string;
  readonly emailSubject?: string;
  readonly emailSender?: string;
  readonly noteSha256: string;
  readonly recordedAt: number;
  readonly signature: string;
};

export type EmailAcceptanceInput = {
  readonly enterpriseId: string;
  readonly jobId: string;
  readonly recordedBy: string;
  readonly recordedByUserId?: string;
  readonly freelancerName: string;
  readonly emailDate: string;
  readonly emailSubject?: string;
  readonly emailSender?: string;
  readonly now?: number;
};

export type EmailAcceptanceRefusal = { readonly refused: string };

const PURPOSE = "email-acceptance";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function bindingsOf(record: Omit<EmailAcceptanceRecord, "noteSha256" | "signature">): string {
  return JSON.stringify({
    purpose: PURPOSE,
    id: record.id,
    enterpriseId: record.enterpriseId,
    jobId: record.jobId,
    resultSha256: record.resultSha256,
    recordedBy: record.recordedBy,
    recordedByUserId: record.recordedByUserId ?? null,
    freelancerName: record.freelancerName,
    freelancerReported: true,
    byEmail: true,
    emailDate: record.emailDate,
    emailSubject: record.emailSubject ?? null,
    emailSender: record.emailSender ?? null,
    recordedAt: record.recordedAt,
  });
}

function noteHash(record: Omit<EmailAcceptanceRecord, "noteSha256" | "signature">): string {
  return crypto.createHash("sha256").update(bindingsOf(record)).digest("hex");
}

function payloadOf(record: Omit<EmailAcceptanceRecord, "signature">): string {
  return JSON.stringify({
    ...JSON.parse(bindingsOf(record)),
    noteSha256: record.noteSha256,
  });
}

function sign(record: Omit<EmailAcceptanceRecord, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(record)).digest("hex");
}

function verified(record: EmailAcceptanceRecord): boolean {
  try {
    const { signature, ...rest } = record;
    const expected = Buffer.from(sign(rest));
    const actual = Buffer.from(String(signature ?? ""));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function loadAll(): EmailAcceptanceRecord[] {
  const records: EmailAcceptanceRecord[] = [];
  for (const text of loadEmailAcceptanceRows()) {
    try {
      records.push(JSON.parse(text) as EmailAcceptanceRecord);
    } catch {
      // Skip unreadable rows.
    }
  }
  return records.filter(verified);
}

/** Why a note cannot be recorded, or undefined when it can. SIDE EFFECT: Reads identity and jobs. */
export function refuseEmailAcceptance(input: EmailAcceptanceInput, job?: Job): string | undefined {
  if (!isOwner(input.enterpriseId, input.recordedBy)) {
    return "Only the owner can record that a freelancer accepted work by email. Nothing was recorded.";
  }
  if (!maySignOff(input.enterpriseId, input.recordedBy)) {
    return `${input.recordedBy} may not sign off work at this business, so the note was not recorded.`;
  }
  const name = input.freelancerName.trim();
  if (!name) return "Name the freelancer who accepted this by email. Nothing was recorded.";
  if (!input.emailDate.trim()) return "Give the date of the email. Nothing was recorded.";
  const current = job ?? getJob(input.jobId);
  if (!current || current.status !== "completed" || !current.output) {
    return "There is no finished result to attach this note to. Nothing was recorded.";
  }
  return undefined;
}

/**
 * Records the note with the owner's sign-off. Never creates a grant or a
 * sign-off in the freelancer's name, and never stores an email body.
 * SIDE EFFECT: Writes a signed record and a Timeline event.
 */
export function recordEmailAcceptance(input: EmailAcceptanceInput, job: Job): EmailAcceptanceRecord | EmailAcceptanceRefusal {
  const refused = refuseEmailAcceptance(input, job);
  if (refused) return { refused };
  if (!job.output) return { refused: "There is no finished result to attach this note to. Nothing was recorded." };
  const recordedAt = input.now ?? Date.now();
  const unsigned = {
    id: crypto.randomUUID(),
    enterpriseId: input.enterpriseId,
    jobId: job.id,
    resultSha256: hashResult(job.output),
    recordedBy: input.recordedBy,
    ...(input.recordedByUserId ? { recordedByUserId: input.recordedByUserId } : {}),
    freelancerName: input.freelancerName.trim(),
    freelancerReported: true as const,
    byEmail: true as const,
    emailDate: input.emailDate.trim(),
    ...(input.emailSubject?.trim() ? { emailSubject: input.emailSubject.trim() } : {}),
    ...(input.emailSender?.trim() ? { emailSender: input.emailSender.trim() } : {}),
    recordedAt,
  };
  const withHash = { ...unsigned, noteSha256: noteHash(unsigned) };
  const signed: EmailAcceptanceRecord = { ...withHash, signature: sign(withHash) };
  saveEmailAcceptanceRow(signed.id, signed.enterpriseId, signed.jobId, JSON.stringify(signed));
  broadcastEvent(
    "staff.email_acceptance",
    "info",
    formatEmailAcceptanceLine(signed)
  );
  return signed;
}

/** "Signed off by John. Recorded by John: Dana accepted this by email, 24 Nov ("Re: chapter 3 edits")." PURE. */
export function formatEmailAcceptanceLine(record: EmailAcceptanceRecord, signedOffBy?: string): string {
  const who = signedOffBy ?? record.recordedBy;
  const subject = record.emailSubject ? ` ("${record.emailSubject}")` : "";
  return `Signed off by ${who}. Recorded by ${record.recordedBy}: ${record.freelancerName} accepted this by email, ${record.emailDate}${subject}.`;
}

export function emailAcceptanceForJob(jobId: string): EmailAcceptanceRecord | undefined {
  return loadAll()
    .filter((record) => record.jobId === jobId)
    .sort((a, b) => b.recordedAt - a.recordedAt)[0];
}

/** Owner's weekly list: one line each, the work, what was accepted, and the email date. SIDE EFFECT: Reads jobs and notes. */
export function formatWeeklyEmailAcceptances(enterpriseId: string, now = Date.now()): string {
  const since = now - WEEK_MS;
  const lines = loadAll()
    .filter((record) => record.enterpriseId === enterpriseId && record.recordedAt >= since)
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .map((record) => {
      const job = getJob(record.jobId);
      const work = job?.task ?? record.jobId;
      return `${work} — ${record.freelancerName} accepted this by email, ${record.emailDate}.`;
    });
  if (lines.length === 0) return "No freelancer email acceptances were recorded this week.";
  return ["Freelancer email acceptances this week:", "", ...lines].join("\n");
}

/** SIDE EFFECT: Deletes every emailed-acceptance note (tests and /reset). */
export function clearEmailAcceptances(): void {
  clearPersistedEmailAcceptances();
}
