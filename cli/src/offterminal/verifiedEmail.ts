/**
 * Records and verifies a person's email address with a one-time code
 * before any off-terminal sign-off or enrolment link is sent
 * (off-terminal sign-off brief). Unverified worker emails are not enough.
 *
 * SIDE EFFECT: May send mail and write the runtime database.
 */

import crypto from "node:crypto";

import { formatNzTime } from "../core/nzTime";
import { emailProblem, listPeople, refuseUnlessOwner, type Actor } from "../identity/companySignIn";
import {
  clearPersistedVerifiedEmails,
  loadVerifiedEmailRow,
  saveVerifiedEmailRow,
} from "../storage/verifiedEmailRepository";
import { sendClaimOnceMail } from "./claimOnceEmail";

export const EMAIL_CODE_LIFE_MS = 30 * 60 * 1000;

export type VerifiedEmailRecord = {
  readonly enterpriseId: string;
  readonly person: string;
  readonly email: string;
  readonly verifiedAt?: number;
  readonly pendingCodeSha256?: string;
  readonly pendingExpiresAt?: number;
  readonly previousEmail?: string;
  readonly requestedBy: string;
  readonly requestedAt: number;
};

export type EmailOutcome = { readonly message: string };
export type EmailRefusal = { readonly refused: string };

function parseRecord(recordJson: string | undefined): VerifiedEmailRecord | undefined {
  if (!recordJson) {
    return undefined;
  }
  try {
    const record = JSON.parse(recordJson) as VerifiedEmailRecord;
    if (!record || typeof record.email !== "string") {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

function persist(record: VerifiedEmailRecord): void {
  saveVerifiedEmailRow(record.enterpriseId, record.person, JSON.stringify(record));
}

function codeHash(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function newCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function personAt(enterpriseId: string, name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  return listPeople(enterpriseId).find((person) => person.name.trim().toLowerCase() === wanted)?.name;
}

/** The verified address for a person, if they have completed the one-time code. */
export function getVerifiedEmail(enterpriseId: string, person: string): string | undefined {
  const named = personAt(enterpriseId, person) ?? person;
  const record = parseRecord(loadVerifiedEmailRow(enterpriseId, named));
  if (!record || record.verifiedAt === undefined) {
    return undefined;
  }
  return record.email;
}

/**
 * Starts verification of an email address. Only the owner may change an
 * address that is already verified, and that change notices the old address.
 */
export async function startEmailVerification(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly email: string;
  readonly actor: Actor;
  readonly now?: number;
}): Promise<EmailOutcome | EmailRefusal> {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "record an email address");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const person = personAt(input.enterpriseId, input.person);
  if (!person) {
    return { refused: "Choose someone who works here." };
  }
  const problem = emailProblem(input.email);
  if (problem) {
    return { refused: problem };
  }
  const email = input.email.trim();
  const now = input.now ?? Date.now();
  const existing = parseRecord(loadVerifiedEmailRow(input.enterpriseId, person));
  if (existing?.verifiedAt !== undefined && existing.email.toLowerCase() !== email.toLowerCase()) {
    const notice = await sendClaimOnceMail({
      to: existing.email,
      subject: "Your email address on Arturo is being changed",
      text:
        `The owner is changing the email address for ${person} on Arturo. ` +
        `Arturo never asks for your password, by email or on the page.`,
    });
    if (notice !== "accepted") {
      return { refused: "The notice to the old address could not be sent, so the address was not changed." };
    }
  }

  const code = newCode();
  const expiresAt = now + EMAIL_CODE_LIFE_MS;
  const sent = await sendClaimOnceMail({
    to: email,
    subject: "Your Arturo email check code",
    text:
      `Your email check code is ${code}. It expires at ${formatNzTime(expiresAt)}. ` +
      `Arturo never asks for your password, by email or on the page.`,
  });
  if (sent !== "accepted") {
    return { refused: "The email check could not be sent, so the address was not recorded." };
  }

  persist({
    enterpriseId: input.enterpriseId,
    person,
    email,
    requestedBy: input.actor?.workerName ?? "the terminal",
    requestedAt: now,
    pendingCodeSha256: codeHash(code),
    pendingExpiresAt: expiresAt,
    ...(existing?.verifiedAt !== undefined ? { previousEmail: existing.email } : {}),
  });
  return {
    message: `A check code was sent to ${email}. It expires at ${formatNzTime(expiresAt)}.`,
  };
}

/** Completes verification when the one-time code matches. */
export function confirmEmailVerification(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly code: string;
  readonly now?: number;
}): EmailOutcome | EmailRefusal {
  const person = personAt(input.enterpriseId, input.person);
  if (!person) {
    return { refused: "Choose someone who works here." };
  }
  const now = input.now ?? Date.now();
  const existing = parseRecord(loadVerifiedEmailRow(input.enterpriseId, person));
  if (
    !existing?.pendingCodeSha256 ||
    existing.pendingExpiresAt === undefined ||
    existing.pendingExpiresAt <= now ||
    existing.pendingCodeSha256 !== codeHash(input.code)
  ) {
    return { refused: "That code is not right, or has expired." };
  }
  persist({
    enterpriseId: existing.enterpriseId,
    person: existing.person,
    email: existing.email,
    verifiedAt: now,
    requestedBy: existing.requestedBy,
    requestedAt: existing.requestedAt,
    ...(existing.previousEmail ? { previousEmail: existing.previousEmail } : {}),
  });
  return { message: `${existing.email} is now verified for ${person}.` };
}

/** SIDE EFFECT: Deletes every verified-email record (tests and /reset). */
export function clearVerifiedEmails(): void {
  clearPersistedVerifiedEmails();
}
