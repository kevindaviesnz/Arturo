/**
 * Passkey enrolment for off-terminal sign-off: the owner starts a
 * 30-minute setup link at the terminal, the person enrols on their own
 * device, there is a 12-hour wait, then the owner confirms at the
 * terminal (off-terminal sign-off brief). Starting and confirming are
 * never offered on the sign-off listener.
 *
 * SIDE EFFECT: May send mail, write the runtime database, and append to
 * the authority log.
 */

import crypto from "node:crypto";

import { getWorker } from "../control/workers";
import { formatNzTime } from "../core/nzTime";
import { getEnterprise } from "../enterprise/enterpriseStore";
import {
  listAuthorityChanges,
  listPeople,
  logAuthorityChange,
  refuseUnlessOwner,
  type Actor,
} from "../identity/companySignIn";
import { ENROLMENT_CONFIRM_WAIT_HOURS } from "../runtime/chainLimits";
import {
  clearPersistedPasskeys,
  deletePasskeyRow,
  loadPasskeyRow,
  loadPasskeyRowsForPerson,
  savePasskeyRow,
} from "../storage/passkeyRepository";
import { sendClaimOnceMail } from "./claimOnceEmail";
import {
  issueOffTerminalLink,
  lookupOffTerminalLink,
  consumeOffTerminalLink,
  revokeOffTerminalLinksForPerson,
  type IssuedOffTerminalLink,
} from "./offTerminalLinks";
import { getVerifiedEmail } from "./verifiedEmail";
import { requirePublicBaseUrl } from "./publicBaseUrl";
import {
  beginRegistration,
  completeRegistration,
  type PasskeyPublic,
} from "./webAuthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export type StoredPasskey = {
  readonly credentialId: string;
  readonly publicKeyBase64Url: string;
  readonly publicKeyHash: string;
  readonly counter: number;
  readonly deviceDescription: string;
  readonly enterpriseId: string;
  readonly person: string;
  readonly enrolledAt: number;
  readonly enrolledBy: string;
  readonly reason: string;
  readonly waitingUntil: number;
  readonly confirmedAt?: number;
  readonly confirmedBy?: string;
  readonly confirmation?: string;
  readonly cancelledAt?: number;
};

export type EnrolmentOffer = {
  readonly token: string;
  readonly url: string;
  readonly expiresAt: number;
  readonly offer: string;
  readonly person: string;
};

export type EnrolmentOutcome = { readonly message: string };
export type EnrolmentRefusal = { readonly refused: string };

const YES_ONLY = new Set(["y", "yes"]);

const pendingChallenges = new Map<string, { challenge: string; expiresAt: number; existingChecked: boolean }>();
const existingCheckedSessions = new Set<string>();

function waitMs(): number {
  return ENROLMENT_CONFIRM_WAIT_HOURS * 60 * 60 * 1000;
}

function publicKeyHash(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function parsePasskey(recordJson: string | undefined): StoredPasskey | undefined {
  if (!recordJson) {
    return undefined;
  }
  try {
    const record = JSON.parse(recordJson) as StoredPasskey;
    if (!record || typeof record.credentialId !== "string") {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

function persist(record: StoredPasskey): void {
  savePasskeyRow(record.credentialId, record.enterpriseId, record.person, JSON.stringify(record));
}

function personAt(enterpriseId: string, name: string) {
  const wanted = name.trim().toLowerCase();
  return listPeople(enterpriseId).find((person) => person.name.trim().toLowerCase() === wanted);
}

function hasAccount(enterpriseId: string, name: string): boolean {
  const person = personAt(enterpriseId, name);
  return Boolean(person && person.role);
}

function isHumanWorker(name: string): boolean {
  return getWorker(name)?.kind === "human";
}

function ownerNames(enterpriseId: string): string[] {
  return listPeople(enterpriseId)
    .filter((person) => person.role === "owner" && person.status !== "suspended")
    .map((person) => person.name);
}

export function listPasskeys(enterpriseId: string, person: string): StoredPasskey[] {
  return loadPasskeyRowsForPerson(enterpriseId, person)
    .map((row) => parsePasskey(row))
    .filter((row): row is StoredPasskey => row !== undefined && row.cancelledAt === undefined);
}

export function getPasskey(credentialId: string): StoredPasskey | undefined {
  return parsePasskey(loadPasskeyRow(credentialId));
}

/** A confirmed, waited-out credential that may be used to sign off. */
export function usablePasskeys(enterpriseId: string, person: string, now = Date.now()): StoredPasskey[] {
  return listPasskeys(enterpriseId, person).filter(
    (key) => key.confirmedAt !== undefined && key.waitingUntil <= now
  );
}

export function formatEnrolmentOffer(url: string, expiresAt: number): string {
  return [
    `Setup link (only for them, until ${formatNzTime(expiresAt)}):`,
    url,
    "",
    "They open it on their own device. They never need the command line.",
  ].join("\n");
}

export function formatConfirmPasskeyPrompt(key: StoredPasskey): string {
  return [
    `A new device check was set up for ${key.person}.`,
    `Device: ${key.deviceDescription}`,
    `Set up: ${formatNzTime(key.enrolledAt)}`,
    "",
    `Confirm only if ${key.person} told you themselves that they set this up.`,
    "Check with them through another channel, such as a call or in person.",
    "Type a confirmation, not only yes.",
  ].join("\n");
}

/**
 * Owner-only, at the terminal: starts a 30-minute setup link for a
 * registered person who already has an account and a verified email.
 */
export async function startPasskeyEnrolment(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly reason: string;
  readonly actor: Actor;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<EnrolmentOffer | EnrolmentRefusal> {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "start a device-check setup");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const reason = input.reason.trim();
  if (!reason || YES_ONLY.has(reason.toLowerCase())) {
    return { refused: "Say why this person should get a device check, in your own words, not only yes." };
  }
  const person = personAt(input.enterpriseId, input.person)?.name;
  if (!person) {
    return { refused: "Choose someone who works here." };
  }
  if (!isHumanWorker(person)) {
    return { refused: "A device check is only for a person, not an AI worker." };
  }
  if (!hasAccount(input.enterpriseId, person)) {
    return { refused: `Give ${person} an account first, by giving them the right to sign off or inviting them.` };
  }
  const personEmail = getVerifiedEmail(input.enterpriseId, person);
  if (!personEmail) {
    return { refused: `Record and verify an email address for ${person} first.` };
  }
  const owners = ownerNames(input.enterpriseId);
  const ownerEmails = owners
    .map((name) => getVerifiedEmail(input.enterpriseId, name))
    .filter((email): email is string => Boolean(email));
  if (ownerEmails.length === 0) {
    return { refused: "Record and verify an email address for the owner first, so they get the notice." };
  }

  const now = input.now ?? Date.now();
  const issued = issueOffTerminalLink({
    kind: "enrolment",
    enterpriseId: input.enterpriseId,
    person,
    now,
    env: input.env,
  });
  if ("refused" in issued) {
    return issued;
  }

  const by = input.actor?.workerName ?? "the terminal";
  logAuthorityChange({
    enterpriseId: input.enterpriseId,
    what: `started device-check enrolment: ${reason}`,
    person,
    by,
    at: now,
    ...(input.actor?.userId ? { byUserId: input.actor.userId } : {}),
  });

  const name = getEnterprise(input.enterpriseId)?.name ?? "the business";
  const text =
    `Open this link on your own device to set up a device check. It works until ${formatNzTime(issued.link.expiresAt)}. ` +
    `Arturo never asks for your password, by email or on the page.\n${issued.url}`;
  const sent = await sendClaimOnceMail({
    to: personEmail,
    subject: `A setup link for ${name}`,
    text,
  });
  if (sent !== "accepted") {
    consumeOffTerminalLink(issued.token, now);
    return { refused: "The setup link could not be emailed, so it was not issued." };
  }

  return {
    token: issued.token,
    url: issued.url,
    expiresAt: issued.link.expiresAt,
    person,
    offer: formatEnrolmentOffer(issued.url, issued.link.expiresAt),
  };
}

function relyingParty(env: NodeJS.ProcessEnv | undefined): { origin: string; rpID: string } | EnrolmentRefusal {
  try {
    const origin = requirePublicBaseUrl(env ?? process.env);
    return { origin, rpID: new URL(origin).hostname };
  } catch (error) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
}

function sessionKey(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/** WebAuthn registration options for a valid enrolment link. */
export async function enrolmentOptions(input: {
  readonly token: string;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<{ options: Awaited<ReturnType<typeof beginRegistration>> } | EnrolmentRefusal> {
  const now = input.now ?? Date.now();
  const link = lookupOffTerminalLink(input.token, { now });
  if ("refused" in link || link.kind !== "enrolment") {
    return { refused: "This link no longer works" };
  }
  const rp = relyingParty(input.env);
  if ("refused" in rp) {
    return rp;
  }
  const existing = listPasskeys(link.enterpriseId, link.person);
  if (existing.some((key) => key.confirmedAt !== undefined) && !existingCheckedSessions.has(sessionKey(input.token))) {
    return { refused: "An existing device check has to be used first, before a new one can be set up." };
  }
  const options = await beginRegistration({
    rpName: getEnterprise(link.enterpriseId)?.name ?? "Arturo",
    rpID: rp.rpID,
    userName: link.person,
    userDisplayName: link.person,
    excludeCredentialIds: existing.map((key) => key.credentialId),
  });
  pendingChallenges.set(sessionKey(input.token), {
    challenge: options.challenge,
    expiresAt: now + 5 * 60 * 1000,
    existingChecked: existingCheckedSessions.has(sessionKey(input.token)),
  });
  return { options };
}

/** Test helper: marks that an existing key was checked for a further enrolment. */
export function markExistingKeyCheckedForTests(token: string): void {
  existingCheckedSessions.add(sessionKey(token));
}

/**
 * Finishes enrolment from the person's device. A failed or expired
 * attempt saves no credential. The new key cannot sign off until the
 * 12-hour wait has ended and the owner has confirmed it.
 */
export async function completeEnrolment(input: {
  readonly token: string;
  readonly response: RegistrationResponseJSON;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<EnrolmentOutcome | EnrolmentRefusal> {
  const now = input.now ?? Date.now();
  const link = lookupOffTerminalLink(input.token, { now });
  if ("refused" in link || link.kind !== "enrolment") {
    return { refused: "This link no longer works" };
  }
  const rp = relyingParty(input.env);
  if ("refused" in rp) {
    return rp;
  }
  const pending = pendingChallenges.get(sessionKey(input.token));
  if (!pending || pending.expiresAt <= now) {
    return { refused: "We couldn't check it's you. Nothing was saved." };
  }
  const existing = listPasskeys(link.enterpriseId, link.person);
  if (existing.some((key) => key.confirmedAt !== undefined) && !pending.existingChecked) {
    pendingChallenges.delete(sessionKey(input.token));
    return { refused: "An existing device check has to be used first, before a new one can be set up." };
  }

  const verified = await completeRegistration({
    response: input.response,
    expectedChallenge: pending.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
  });
  pendingChallenges.delete(sessionKey(input.token));
  if (!verified.verified || !verified.credential) {
    return { refused: "We couldn't check it's you. Nothing was saved." };
  }

  const waitingUntil = now + waitMs();
  const record: StoredPasskey = {
    credentialId: verified.credential.credentialId,
    publicKeyBase64Url: toBase64Url(verified.credential.publicKey),
    publicKeyHash: publicKeyHash(verified.credential.publicKey),
    counter: verified.credential.counter,
    deviceDescription: verified.credential.deviceDescription,
    enterpriseId: link.enterpriseId,
    person: link.person,
    enrolledAt: now,
    enrolledBy: "setup link",
    reason: "device check enrolment",
    waitingUntil,
  };
  persist(record);
  consumeOffTerminalLink(input.token, now);

  const when = formatNzTime(waitingUntil);
  const notice = `${link.person} can sign off from ${when}. Cancel`;
  const recipients = new Set<string>();
  const personEmail = getVerifiedEmail(link.enterpriseId, link.person);
  if (personEmail) {
    recipients.add(personEmail);
  }
  for (const owner of ownerNames(link.enterpriseId)) {
    const email = getVerifiedEmail(link.enterpriseId, owner);
    if (email) {
      recipients.add(email);
    }
  }
  for (const to of recipients) {
    await sendClaimOnceMail({
      to,
      subject: notice,
      text: `${notice}\nAnyone who can sign off may cancel this at the Arturo computer. Arturo never asks for your password, by email or on the page.`,
    });
  }

  logAuthorityChange({
    enterpriseId: link.enterpriseId,
    what: `device check enrolled, waiting until ${when} (credential ${record.credentialId}, public-key hash ${record.publicKeyHash})`,
    person: link.person,
    by: link.person,
    at: now,
  });

  return {
    message: `A device check was set up for ${link.person}. It can be confirmed after ${when}.`,
  };
}

/** The owner cancels a waiting enrolment. The credential is not kept. */
export function cancelPasskeyEnrolment(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly credentialId?: string;
  readonly actor: Actor;
  readonly now?: number;
}): EnrolmentOutcome | EnrolmentRefusal {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "cancel a device-check setup");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const now = input.now ?? Date.now();
  const person = personAt(input.enterpriseId, input.person)?.name ?? input.person;
  const waiting = listPasskeys(input.enterpriseId, person).filter(
    (key) => key.confirmedAt === undefined && (input.credentialId === undefined || key.credentialId === input.credentialId)
  );
  if (waiting.length === 0) {
    return { refused: "There is no device check waiting to be confirmed." };
  }
  const by = input.actor?.workerName ?? "the terminal";
  for (const key of waiting) {
    deletePasskeyRow(key.credentialId);
    logAuthorityChange({
      enterpriseId: input.enterpriseId,
      what: `cancelled device-check enrolment (credential ${key.credentialId})`,
      person,
      by,
      at: now,
      ...(input.actor?.userId ? { byUserId: input.actor.userId } : {}),
    });
  }
  return { message: `The device-check setup for ${person} was cancelled. Nothing was kept.` };
}

/**
 * Owner-only confirmation at the terminal, after the 12-hour wait.
 * The confirmation is typed, never a bare yes, and the public-key hash
 * is written into the authority log.
 */
export function confirmPasskeyEnrolment(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly confirmation: string;
  readonly actor: Actor;
  readonly credentialId?: string;
  readonly now?: number;
}): EnrolmentOutcome | EnrolmentRefusal {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "confirm a device check");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const confirmation = input.confirmation.trim();
  const person = personAt(input.enterpriseId, input.person)?.name ?? input.person;
  if (!confirmation || YES_ONLY.has(confirmation.toLowerCase()) || !confirmation.toLowerCase().includes(person.toLowerCase())) {
    return { refused: "Type a confirmation that names the person, not only yes." };
  }
  const now = input.now ?? Date.now();
  const waiting = listPasskeys(input.enterpriseId, person).filter(
    (key) =>
      key.confirmedAt === undefined &&
      (input.credentialId === undefined || key.credentialId === input.credentialId)
  );
  if (waiting.length === 0) {
    return { refused: "There is no device check waiting to be confirmed." };
  }
  if (waiting.length > 1 && !input.credentialId) {
    return { refused: "Say which device check to confirm." };
  }
  const key = waiting[0];
  if (!key) {
    return { refused: "There is no device check waiting to be confirmed." };
  }
  if (key.waitingUntil > now) {
    return { refused: `This device check can be confirmed after ${formatNzTime(key.waitingUntil)}.` };
  }
  const by = input.actor?.workerName ?? "the terminal";
  const confirmed: StoredPasskey = {
    ...key,
    confirmedAt: now,
    confirmedBy: by,
    confirmation,
  };
  persist(confirmed);
  logAuthorityChange({
    enterpriseId: input.enterpriseId,
    what:
      `confirmed device check (credential ${confirmed.credentialId}, public-key hash ${confirmed.publicKeyHash}): ${confirmation}`,
    person,
    by,
    at: now,
    ...(input.actor?.userId ? { byUserId: input.actor.userId } : {}),
  });
  return {
    message: `A passkey was added for ${person} at ${formatNzTime(now)}.`,
  };
}

/** Removing a passkey is instant and kills every link already issued for that person. */
export function removePasskey(input: {
  readonly enterpriseId: string;
  readonly person: string;
  readonly credentialId: string;
  readonly actor: Actor;
  readonly now?: number;
}): EnrolmentOutcome | EnrolmentRefusal {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "remove a device check");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const now = input.now ?? Date.now();
  const key = getPasskey(input.credentialId);
  const person = personAt(input.enterpriseId, input.person)?.name ?? input.person;
  if (!key || key.enterpriseId !== input.enterpriseId || key.person !== person || key.cancelledAt) {
    return { refused: "There is no device check like that for this person." };
  }
  deletePasskeyRow(key.credentialId);
  revokeOffTerminalLinksForPerson(input.enterpriseId, person, now);
  const by = input.actor?.workerName ?? "the terminal";
  logAuthorityChange({
    enterpriseId: input.enterpriseId,
    what: `removed a device check (credential ${key.credentialId}, public-key hash ${key.publicKeyHash})`,
    person,
    by,
    at: now,
    ...(input.actor?.userId ? { byUserId: input.actor.userId } : {}),
  });
  return { message: `The device check for ${person} was removed. Links already issued to them no longer work.` };
}

/** Whether a later swap of the stored public key still matches the authority log. */
export function passkeyMatchesAuthorityLog(key: StoredPasskey): boolean {
  const entries = listAuthorityChanges(key.enterpriseId);
  return entries.some(
    (entry) =>
      entry.person === key.person &&
      entry.what.includes(key.credentialId) &&
      entry.what.includes(key.publicKeyHash)
  );
}

/** SIDE EFFECT: Deletes stored credentials and in-memory challenges (tests and /reset). */
export function clearPasskeys(): void {
  clearPersistedPasskeys();
  pendingChallenges.clear();
  existingCheckedSessions.clear();
}
