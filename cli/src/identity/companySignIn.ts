/**
 * Signing in to the company page, so more than one person can use it.
 *
 * Until now the page trusted whoever was at the computer: every decision
 * named a person picked from a list ("Sign off as John Smith", "You are"),
 * and that name went into signed records although nobody proved it. Once a
 * business turns sign-in on, the page answers only someone signed in as one
 * of its people, and every decision is made as that person and no other
 * (company/companyAccess.ts).
 *
 * People, roles and sessions reuse what the review server already had
 * (organisationIdentity.ts): a User per person, a membership in the business
 * with a role (owner, admin, member, reviewer), the User bound to the
 * person's Human Worker, and hashed session tokens. Added here:
 *
 *   - turning sign-in on for a business, by its owner, once, signed;
 *   - invite codes the owner issues (no email needed), used once, within
 *     three days, to choose a password. A lost password is a new code from
 *     the owner: there is no self-service recovery;
 *   - passwords, hashed with scrypt, and limits on wrong guesses;
 *   - the right to sign off work, which only the owner gives or takes away,
 *     each change signed (SignOffGrant). With sign-in on, a person signs off
 *     on the page only with a grant whose signature verifies, so changing a
 *     person's mode in the data directory is not enough;
 *   - every change of who holds authority (sign-in, invites, roles,
 *     suspensions, sign-off rights) appended to a signed, hash-chained log
 *     (authority_changes), so an edit or a removal in the middle shows.
 *
 * Signatures use the local approval signing key, so someone who can read the
 * data directory and that key can forge them (THREAT_MODEL.md item 1).
 */

import crypto from "node:crypto";

import { peopleOf } from "../clients/clientCommands";
import { endDraftsForInvolving } from "../staffing/draftsFor";
import { formatRoleChangeHandBackConfirm, openHandBacksForLostRight, waitingDraftsForPerson } from "../staffing/handBack";
import { recordStaffChangeEvent } from "../staffing/staffChanges";
import { isApprovalCapableMode } from "../control/humanWorkerMode";
import { addWorker, getWorker, setHumanWorkerSignOff } from "../control/workers";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { runtimeDb } from "../storage/runtimeDatabase";
import {
  appendAuthorityChange,
  clearPersistedSignIn,
  consumeSignInInvite,
  insertCompanySignIn,
  loadAuthorityChanges,
  loadCompanySignIns,
  loadSignInInvite,
  loadSignInPassword,
  loadSignOffGrant,
  replaceSignInInvite,
  saveSignInPassword,
  saveSignOffGrant,
} from "../storage/signInRepository";
import {
  assignWorkerOwnership,
  authenticateUserSession,
  getUser,
  getWorkerOwnership,
  issueUserSession,
  listEnterpriseMemberships,
  provisionUser,
  revokeUserSession,
  setEnterpriseMembership,
  type EnterpriseMembership,
} from "./organisationIdentity";
import { revokeOffTerminalLinksForPerson } from "../offterminal/offTerminalLinks";

export type Role = EnterpriseMembership["role"];

export type CompanySignIn = { readonly enterpriseId: string; readonly ownerWorker: string; readonly ownerUserId: string; readonly at: number; readonly signature: string };
export type SignInPassword = { readonly userId: string; readonly salt: string; readonly hash: string; readonly setAt: number };
export type SignInInvite = { readonly userId: string; readonly enterpriseId: string; readonly workerName: string; readonly issuedBy: string; readonly issuedAt: number; readonly expiresAt: number };
export type SignOffGrant = {
  readonly enterpriseId: string;
  readonly workerName: string;
  readonly granted: boolean;
  readonly by: string;
  readonly byUserId?: string;
  readonly at: number;
  readonly note?: string;
  readonly signature: string;
};
export type AuthorityChange = {
  readonly enterpriseId: string;
  readonly what: string;
  readonly person: string;
  readonly by: string;
  readonly byUserId?: string;
  readonly at: number;
  readonly prevSha256: string;
  readonly signature: string;
};

/** Someone signed in, as Arturo knows them. */
export type Account = {
  readonly userId: string;
  readonly workerName: string;
  readonly displayName: string;
  /** Their businesses with sign-in on, where their membership is active, and their role in each. */
  readonly roles: ReadonlyMap<string, Role>;
};

/** Who is acting: a signed-in person, or the trusted host at the terminal (undefined). */
export type Actor = Account | undefined;

export const INVITE_LIFETIME_MS = 3 * 24 * 60 * 60 * 1000;
export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const GUESS_WINDOW_MS = 15 * 60 * 1000;
const GUESS_LIMIT = 8;
const ISSUER = "arturo-company";

type Refusal = { readonly refused: string };

/** SIDE EFFECT: Reads the signing secret. */
function sign(purpose: string, payload: Record<string, unknown>): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(JSON.stringify({ purpose, ...payload })).digest("hex");
}

/** SIDE EFFECT: Reads the signing secret. */
function verify(purpose: string, payload: Record<string, unknown>, signature: string): boolean {
  const expected = Buffer.from(sign(purpose, payload));
  const actual = Buffer.from(String(signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

const sha256 = (text: string) => crypto.createHash("sha256").update(text).digest("hex");
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The business's sign-in record, if it is on and its signature verifies. SIDE EFFECT: Reads sign-in state. */
function signInRecord(enterpriseId: string): CompanySignIn | undefined {
  const record = loadCompanySignIns().find((one) => one.enterpriseId === enterpriseId);
  if (!record) return undefined;
  const { signature, ...payload } = record;
  return verify("company-sign-in", payload, signature) ? record : undefined;
}

/** Whether this business has turned sign-in on. SIDE EFFECT: Reads sign-in state. */
export function signInOn(enterpriseId: string | undefined): boolean {
  return Boolean(enterpriseId && signInRecord(enterpriseId));
}

/**
 * Whether the company page needs everyone to sign in: once any business on
 * this installation has turned sign-in on (a record that fails to verify
 * counts too, so an edited record fails closed).
 *
 * SIDE EFFECT: Reads sign-in state.
 */
export function signInRequired(): boolean {
  return loadCompanySignIns().length > 0;
}

/** SIDE EFFECT: Reads the authority log and the signing secret. */
export function logAuthorityChange(change: Omit<AuthorityChange, "prevSha256" | "signature">): void {
  const earlier = loadAuthorityChanges();
  const prevSha256 = earlier.length ? sha256(JSON.stringify(earlier[earlier.length - 1])) : "";
  const payload = { ...change, prevSha256 };
  appendAuthorityChange({ ...payload, signature: sign("authority-change", payload) });
}

/**
 * Checks the log of authority changes: every entry signed, and each naming
 * the one before. Returns the position of the first entry that fails, or -1.
 *
 * SIDE EFFECT: Reads the authority log and the signing secret.
 */
export function verifyAuthorityLog(): number {
  const entries = loadAuthorityChanges();
  for (const [index, entry] of entries.entries()) {
    const { signature, ...payload } = entry;
    const prev = index ? sha256(JSON.stringify(entries[index - 1])) : "";
    if (entry.prevSha256 !== prev || !verify("authority-change", payload, signature)) return index;
  }
  return -1;
}

/** SIDE EFFECT: Reads the authority log. */
export function listAuthorityChanges(enterpriseId: string): AuthorityChange[] {
  return loadAuthorityChanges().filter((entry) => entry.enterpriseId === enterpriseId);
}

/** The person of a business by name or email, as Arturo knows them. SIDE EFFECT: Reads Worker state. */
function personAt(enterpriseId: string, name: string): string | undefined {
  return peopleOf(enterpriseId).find((person) => same(person, name) || same(getWorker(person)?.displayName ?? "", name) || (Boolean(name.trim()) && same(getWorker(person)?.email ?? "", name)));
}

/** Why an email address will not do, or undefined. PURE: No side effects. */
export function emailProblem(email: string): string | undefined {
  const tidy = email.trim();
  if (!tidy) return "Give your email address. You sign in with it.";
  if (tidy.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tidy)) return "That does not look like an email address.";
  return undefined;
}

/** SIDE EFFECT: Saves one person's email. */
function setEmail(workerName: string, email: string): void {
  const worker = getWorker(workerName);
  if (worker && email.trim()) addWorker({ ...worker, email: email.trim() });
}

/**
 * First day: the owner who has just set the business up chooses their email
 * and password, and sign-in is on from the start, with them signed in. No
 * invite code: they are the one at this computer setting it up.
 *
 * SIDE EFFECT: Turns sign-in on, saves the owner's email and password, and starts a session.
 */
export function startWithOwner(input: { readonly enterpriseId: string; readonly owner: string; readonly email: string; readonly password: string; readonly now?: number }): { readonly token: string; readonly name: string } | Refusal {
  const problem = emailProblem(input.email) ?? passwordProblem(input.password);
  if (problem) return { refused: problem };
  const on = turnOnSignIn({ enterpriseId: input.enterpriseId, owner: input.owner, ...(input.now ? { now: input.now } : {}) });
  if ("refused" in on) return on;
  setEmail(on.owner, input.email);
  return redeemInvite({ code: on.code, password: input.password, ...(input.now ? { now: input.now } : {}) });
}

/**
 * The owner of a business with sign-in on who has never chosen a password,
 * if there is one: they may choose it on this computer without a code.
 *
 * SIDE EFFECT: Reads sign-in state.
 */
export function ownerWithoutPassword(): { readonly enterpriseId: string; readonly owner: string } | undefined {
  for (const record of loadCompanySignIns()) {
    const { signature, ...payload } = record;
    if (!verify("company-sign-in", payload, signature)) continue;
    if (!loadSignInPassword(record.ownerUserId) && membershipOf(record.enterpriseId, record.ownerWorker)?.status === "active") {
      return { enterpriseId: record.enterpriseId, owner: getWorker(record.ownerWorker)?.displayName ?? record.ownerWorker };
    }
  }
  return undefined;
}

/**
 * Lets that owner choose their email and password, on this computer only
 * (the caller checks), and signs them in. Any invite code they had is spent.
 *
 * SIDE EFFECT: Saves the owner's email and password, and starts a session.
 */
export function claimOwnerAccount(input: { readonly email: string; readonly password: string; readonly now?: number }): { readonly token: string; readonly name: string } | Refusal {
  const owner = ownerWithoutPassword();
  if (!owner) return { refused: "The owner already has a password. Sign in, or ask for a new invite code." };
  const problem = emailProblem(input.email) ?? passwordProblem(input.password);
  if (problem) return { refused: problem };
  const invite = issueInvite({ enterpriseId: owner.enterpriseId, person: owner.owner, actor: undefined, ...(input.now ? { now: input.now } : {}) });
  if ("refused" in invite) return invite;
  setEmail(invite.person, input.email);
  return redeemInvite({ code: invite.code, password: input.password, ...(input.now ? { now: input.now } : {}) });
}

/** SIDE EFFECT: Reads the person's binding. */
function userIdOf(enterpriseId: string, workerName: string): string | undefined {
  const ownership = getWorkerOwnership(workerName);
  return ownership?.enterpriseId === enterpriseId ? ownership.userId : undefined;
}

/** A person's membership, if any. SIDE EFFECT: Reads memberships. */
function membershipOf(enterpriseId: string, workerName: string): EnterpriseMembership | undefined {
  const userId = userIdOf(enterpriseId, workerName);
  return userId ? listEnterpriseMemberships(enterpriseId).find((one) => one.userId === userId) : undefined;
}

/**
 * Makes sure a person has a User bound to them, with a membership, keeping
 * any role they already have.
 *
 * SIDE EFFECT: May create a User, a membership and a binding.
 */
function ensureUser(enterpriseId: string, workerName: string, role: Role): string {
  const worker = getWorker(workerName)!;
  const user = provisionUser({ issuer: ISSUER, subject: `${enterpriseId}:${workerName}`, displayName: worker.displayName ?? workerName });
  if (!listEnterpriseMemberships(enterpriseId).some((one) => one.userId === user.id)) {
    setEnterpriseMembership({ enterpriseId, userId: user.id, role, status: "active" });
  }
  assignWorkerOwnership({ workerName, enterpriseId, userId: user.id });
  return user.id;
}

/** SIDE EFFECT: Reads the signing secret and writes one grant. */
function recordGrant(enterpriseId: string, workerName: string, granted: boolean, by: string, byUserId: string | undefined, at: number, note?: string): void {
  const payload = { enterpriseId, workerName, granted, by, ...(byUserId ? { byUserId } : {}), at, ...(note ? { note } : {}) };
  saveSignOffGrant({ ...payload, signature: sign("sign-off-grant", payload) });
}

/**
 * Whether a person may sign off work and give go-aheads for this business:
 * by their mode alone while sign-in is off, and with sign-in on only with a
 * grant from the owner whose signature verifies.
 *
 * SIDE EFFECT: Reads Worker, sign-in and grant state.
 */
/** Whether this person is an active owner of the business. SIDE EFFECT: Reads memberships. */
export function isOwner(enterpriseId: string, workerName: string): boolean {
  const membership = membershipOf(enterpriseId, workerName);
  return membership?.role === "owner" && membership.status === "active";
}

export function maySignOff(enterpriseId: string | undefined, workerName: string): boolean {
  if (!isApprovalCapableMode(getWorker(workerName)?.humanMode)) return false;
  // The owner can always sign off, so a hand-back never lands on nobody.
  if (enterpriseId && isOwner(enterpriseId, workerName)) return true;
  if (!enterpriseId || !signInOn(enterpriseId)) return true;
  const grant = loadSignOffGrant(enterpriseId, workerName);
  if (!grant) return false;
  const { signature, ...payload } = grant;
  if (!verify("sign-off-grant", payload, signature) || !grant.granted) return false;
  return membershipOf(enterpriseId, workerName)?.status === "active";
}

/** A new invite code: four groups of five letters and digits that are hard to mix up. PURE apart from randomness. */
function newCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  const bytes = crypto.randomBytes(20);
  const letters = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return letters.match(/.{5}/g)!.join("-");
}

const codeKey = (code: string) => sha256(code.replace(/[\s-]/g, "").toUpperCase());

/**
 * Turns sign-in on for a business. Every person who works there gets an
 * account (the owner as owner, everyone else as a member), each person who
 * can sign off now keeps that right under a grant recorded in the owner's
 * name, and the owner gets an invite code to choose their password.
 *
 * From then on the company page needs everyone to sign in.
 *
 * SIDE EFFECT: Writes accounts, memberships, grants, the sign-in record and the authority log.
 */
export function turnOnSignIn(input: { readonly enterpriseId: string; readonly owner: string; readonly now?: number }): { readonly code: string; readonly owner: string; readonly expiresAt: number } | Refusal {
  const enterprise = getEnterprise(input.enterpriseId);
  if (!enterprise) return { refused: "Choose your company first." };
  if (loadCompanySignIns().some((one) => one.enterpriseId === enterprise.id)) return { refused: `${enterprise.name} already has sign-in turned on.` };
  const owner = personAt(enterprise.id, input.owner);
  if (!owner) return { refused: `Say who the owner is: someone who works at ${enterprise.name}.` };
  if (!isApprovalCapableMode(getWorker(owner)?.humanMode)) return { refused: `${owner} cannot sign off work, so they cannot be the owner. Choose someone who can.` };
  const now = input.now ?? Date.now();
  const ownerUserId = ensureUser(enterprise.id, owner, "owner");
  setEnterpriseMembership({ enterpriseId: enterprise.id, userId: ownerUserId, role: "owner", status: "active" });
  for (const person of peopleOf(enterprise.id)) {
    if (person === owner) continue;
    ensureUser(enterprise.id, person, "member");
  }
  const payload = { enterpriseId: enterprise.id, ownerWorker: owner, ownerUserId, at: now };
  if (!insertCompanySignIn({ ...payload, signature: sign("company-sign-in", payload) })) return { refused: `${enterprise.name} already has sign-in turned on.` };
  logAuthorityChange({ enterpriseId: enterprise.id, what: "turned sign-in on, as owner", person: owner, by: owner, byUserId: ownerUserId, at: now });
  for (const person of peopleOf(enterprise.id)) {
    if (!isApprovalCapableMode(getWorker(person)?.humanMode)) continue;
    recordGrant(enterprise.id, person, true, owner, ownerUserId, now, "kept when sign-in was turned on");
    logAuthorityChange({ enterpriseId: enterprise.id, what: "may sign off work (kept when sign-in was turned on)", person, by: owner, byUserId: ownerUserId, at: now });
  }
  const invite = issueInvite({ enterpriseId: enterprise.id, person: owner, actor: undefined, now });
  if ("refused" in invite) return invite;
  return { code: invite.code, owner, expiresAt: invite.expiresAt };
}

/** The sentence an owner-only change made at the terminal is refused with (brief section 5). */
export const OWNER_CHANGE_ON_PAGE = "Make this change on the company page, signed in as the owner.";

/**
 * Why an actor may not make an owner-only change at this business, or
 * undefined. The one check for every owner-only change, on the page and at
 * the terminal alike.
 *
 * With no actor (the trusted host at the terminal, or the page while sign-in
 * is off) the change is allowed by default, as it always was for managing
 * people. Changes the owner may make only on the company page with sign-in on
 * (named work's locks and "no AI", the law-practice setting, paid
 * escalation) pass terminal "refused", and are then refused with no actor.
 * The refusal stays inside the trusted host: anyone at the computer can read
 * the signing key (THREAT_MODEL.md item 1).
 *
 * PURE: No side effects.
 */
export function refuseUnlessOwner(actor: Actor, enterpriseId: string, doing: string, terminal: "trusted" | "refused" = "trusted"): string | undefined {
  if (!actor) return terminal === "refused" ? OWNER_CHANGE_ON_PAGE : undefined;
  return actor.roles.get(enterpriseId) === "owner" ? undefined : `Only the owner can ${doing}.`;
}

/**
 * An invite code for one person, so they can choose a password. Replaces any
 * code they had. Issued by the owner (or the trusted host at the terminal).
 *
 * SIDE EFFECT: May create the person's account, and writes the invite and the authority log.
 */
export function issueInvite(input: { readonly enterpriseId: string; readonly person: string; readonly actor: Actor; readonly now?: number }): { readonly code: string; readonly person: string; readonly expiresAt: number } | Refusal {
  const enterprise = getEnterprise(input.enterpriseId);
  if (!enterprise || !loadCompanySignIns().some((one) => one.enterpriseId === enterprise.id)) return { refused: "Turn sign-in on for this business first." };
  const refusal = refuseUnlessOwner(input.actor, enterprise.id, "invite people");
  if (refusal) return { refused: refusal };
  const person = personAt(enterprise.id, input.person);
  if (!person) return { refused: `${enterprise.name} has nobody called ${input.person.trim() || "that"}. Add them as a worker first.` };
  const membership = membershipOf(enterprise.id, person);
  if (membership?.status === "suspended") return { refused: `${person}'s access is suspended. Restore it first.` };
  const userId = ensureUser(enterprise.id, person, "member");
  const now = input.now ?? Date.now();
  const code = newCode();
  const by = input.actor?.workerName ?? "the terminal";
  replaceSignInInvite(codeKey(code), { userId, enterpriseId: enterprise.id, workerName: person, issuedBy: by, issuedAt: now, expiresAt: now + INVITE_LIFETIME_MS });
  logAuthorityChange({ enterpriseId: enterprise.id, what: "was given an invite code", person, by, ...(input.actor ? { byUserId: input.actor.userId } : {}), at: now });
  return { code, person, expiresAt: now + INVITE_LIFETIME_MS };
}

/** SIDE EFFECT: Ends every session of one person. */
function endSessions(userId: string): void {
  runtimeDb.prepare("DELETE FROM identity_sessions WHERE user_id = ?").run(userId);
}

/** Why a password will not do, or undefined. PURE: No side effects. */
export function passwordProblem(password: string): string | undefined {
  if (password.length < MIN_PASSWORD) return `Choose a password of at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return "Choose a shorter password.";
  return undefined;
}

/** SIDE EFFECT: Writes one password. */
function setPassword(userId: string, password: string, now: number): void {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  saveSignInPassword({ userId, salt, hash, setAt: now });
}

/** SIDE EFFECT: Reads one password. */
function passwordMatches(userId: string, password: string): boolean {
  const stored = loadSignInPassword(userId);
  if (!stored) return false;
  const actual = crypto.scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/**
 * Uses an invite code: the person chooses a password, every earlier session
 * of theirs ends, and they are signed in. A code works once.
 *
 * SIDE EFFECT: Consumes the invite, writes the password, and starts a session.
 */
export function redeemInvite(input: { readonly code: string; readonly password: string; readonly now?: number }): { readonly token: string; readonly name: string } | Refusal {
  const now = input.now ?? Date.now();
  const key = codeKey(input.code);
  const invite = loadSignInInvite(key);
  if (!invite || invite.expiresAt <= now) return { refused: "That code is not right, or has expired. Ask the owner for a new one." };
  const problem = passwordProblem(input.password);
  if (problem) return { refused: problem };
  if (membershipOf(invite.enterpriseId, invite.workerName)?.status !== "active" || getUser(invite.userId)?.disabled) {
    return { refused: "Your access has been suspended. Ask the owner." };
  }
  if (!consumeSignInInvite(key)) return { refused: "That code has already been used. Ask the owner for a new one." };
  setPassword(invite.userId, input.password, now);
  endSessions(invite.userId);
  logAuthorityChange({ enterpriseId: invite.enterpriseId, what: "chose a password with an invite code", person: invite.workerName, by: invite.workerName, byUserId: invite.userId, at: now });
  return { token: issueUserSession(invite.userId, now, SESSION_LIFETIME_MS), name: getWorker(invite.workerName)?.displayName ?? invite.workerName };
}

const guesses = new Map<string, number[]>();

/** Whether a key has had too many wrong passwords lately. SIDE EFFECT: Prunes the in-memory count. */
function tooManyGuesses(key: string, now: number): boolean {
  const recent = (guesses.get(key) ?? []).filter((at) => at > now - GUESS_WINDOW_MS);
  guesses.set(key, recent);
  return recent.length >= GUESS_LIMIT;
}

/** SIDE EFFECT: Clears the in-memory guess counts (tests). */
export function clearSignInGuesses(): void {
  guesses.clear();
}

/** The people who may sign in, by name: at a business with sign-in on, active, with a password. SIDE EFFECT: Reads identity state. */
function accountFor(userId: string): Account | undefined {
  const user = getUser(userId);
  if (!user || user.disabled) return undefined;
  const row = runtimeDb.prepare("SELECT worker_name AS workerName FROM enterprise_worker_memberships WHERE user_id = ?").get(userId) as { workerName: string } | undefined;
  if (!row) return undefined;
  const ownership = getWorkerOwnership(row.workerName)!;
  const roles = new Map<string, Role>();
  const membership = listEnterpriseMemberships(ownership.enterpriseId).find((one) => one.userId === userId);
  if (membership?.status === "active" && signInOn(ownership.enterpriseId)) roles.set(ownership.enterpriseId, membership.role);
  if (!roles.size) return undefined;
  return { userId, workerName: row.workerName, displayName: getWorker(row.workerName)?.displayName ?? row.workerName, roles };
}

/**
 * Signs a person in by their name and password. Too many wrong passwords
 * from one place, or for one name, wait fifteen minutes.
 *
 * SIDE EFFECT: Starts a session, or counts a wrong guess.
 */
export function signIn(input: { readonly name: string; readonly password: string; readonly from: string; readonly now?: number }): { readonly token: string; readonly name: string } | Refusal {
  const now = input.now ?? Date.now();
  const nameKey = `name:${input.name.trim().toLowerCase()}`;
  const fromKey = `from:${input.from}`;
  if (tooManyGuesses(nameKey, now) || tooManyGuesses(fromKey, now)) return { refused: "Too many wrong passwords. Wait fifteen minutes, or ask the owner for a new invite code." };
  const wrong = (): Refusal => {
    for (const key of [nameKey, fromKey]) guesses.set(key, [...(guesses.get(key) ?? []), now]);
    return { refused: "That name and password do not match." };
  };
  for (const record of loadCompanySignIns()) {
    const person = personAt(record.enterpriseId, input.name);
    const userId = person ? userIdOf(record.enterpriseId, person) : undefined;
    if (!userId) continue;
    if (!passwordMatches(userId, input.password)) return wrong();
    const account = accountFor(userId);
    if (!account) return { refused: "Your access has been suspended. Ask the owner." };
    return { token: issueUserSession(userId, now, SESSION_LIFETIME_MS), name: account.displayName };
  }
  return wrong();
}

/** Who a session belongs to, if it is still good. SIDE EFFECT: Reads identity state. */
export function accountFromSession(token: string | undefined): Account | undefined {
  const user = authenticateUserSession(token);
  return user ? accountFor(user.id) : undefined;
}

/** SIDE EFFECT: Ends one session. */
export function signOut(token: string | undefined): void {
  if (token) revokeUserSession(token);
}

export type PersonView = {
  readonly name: string;
  readonly role: Role | null;
  readonly status: "active" | "suspended" | null;
  readonly canSignOff: boolean;
  readonly hasPassword: boolean;
  readonly invited: boolean;
};

/** Everyone at a business and where they stand. SIDE EFFECT: Reads identity and Worker state. */
export function listPeople(enterpriseId: string): PersonView[] {
  return peopleOf(enterpriseId).map((name) => {
    const membership = membershipOf(enterpriseId, name);
    const userId = userIdOf(enterpriseId, name);
    const invited = userId ? Boolean(runtimeDb.prepare("SELECT 1 FROM sign_in_invites WHERE user_id = ?").get(userId)) : false;
    return {
      name,
      role: membership?.role ?? null,
      status: membership?.status ?? null,
      canSignOff: maySignOff(enterpriseId, name),
      hasPassword: userId ? Boolean(loadSignInPassword(userId)) : false,
      invited,
    };
  });
}

/** SIDE EFFECT: Reads memberships. */
function ownerCount(enterpriseId: string): number {
  return listEnterpriseMemberships(enterpriseId).filter((one) => one.role === "owner" && one.status === "active").length;
}

/**
 * Changes a person's role. Only the owner may, and a business always keeps
 * an owner.
 *
 * SIDE EFFECT: May change one membership and append to the authority log.
 */
export function setRole(input: { readonly enterpriseId: string; readonly person: string; readonly role: string; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = refuseUnlessOwner(input.actor, input.enterpriseId, "change what people may do");
  if (refusal) return { refused: refusal };
  if (!["owner", "admin", "member", "reviewer"].includes(input.role)) return { refused: "Choose one of the roles." };
  const person = personAt(input.enterpriseId, input.person);
  const membership = person ? membershipOf(input.enterpriseId, person) : undefined;
  if (!person || !membership) return { refused: "Invite them first." };
  if (membership.role === "owner" && input.role !== "owner" && ownerCount(input.enterpriseId) <= 1) return { refused: "A business needs an owner. Make someone else the owner first." };
  setEnterpriseMembership({ ...membership, role: input.role as Role });
  revokeOffTerminalLinksForPerson(input.enterpriseId, person, input.now ?? Date.now());
  logAuthorityChange({ enterpriseId: input.enterpriseId, what: `role is now ${input.role}`, person, by: input.actor?.workerName ?? "the terminal", ...(input.actor ? { byUserId: input.actor.userId } : {}), at: input.now ?? Date.now() });
  return { message: `${person} is now ${ROLE_WORDS[input.role as Role]}.` };
}

export const ROLE_WORDS: Readonly<Record<Role, string>> = {
  owner: "an owner",
  admin: "able to manage the business",
  member: "able to do the work",
  reviewer: "able to read only",
};

/**
 * Suspends a person's access, or restores it. Their sessions end and their
 * past records stay under their name. Only the owner may, never on
 * themselves.
 *
 * SIDE EFFECT: May change one membership, end sessions and append to the authority log.
 */
export function setSuspended(input: { readonly enterpriseId: string; readonly person: string; readonly suspended: boolean; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = refuseUnlessOwner(input.actor, input.enterpriseId, "suspend or restore access");
  if (refusal) return { refused: refusal };
  const person = personAt(input.enterpriseId, input.person);
  const membership = person ? membershipOf(input.enterpriseId, person) : undefined;
  if (!person || !membership) return { refused: "Invite them first." };
  if (input.actor && same(input.actor.workerName, person)) return { refused: "You cannot suspend yourself." };
  if (membership.role === "owner" && input.suspended && ownerCount(input.enterpriseId) <= 1) return { refused: "A business needs an owner." };
  setEnterpriseMembership({ ...membership, status: input.suspended ? "suspended" : "active" });
  if (input.suspended) {
    endSessions(membership.userId);
    revokeOffTerminalLinksForPerson(input.enterpriseId, person, input.now ?? Date.now());
  }
  logAuthorityChange({ enterpriseId: input.enterpriseId, what: input.suspended ? "access suspended" : "access restored", person, by: input.actor?.workerName ?? "the terminal", ...(input.actor ? { byUserId: input.actor.userId } : {}), at: input.now ?? Date.now() });
  return { message: input.suspended ? `${person} can no longer sign in. What they did stays on file under their name.` : `${person} can sign in again.` };
}

/**
 * Gives a person the right to sign off work and give go-aheads, or takes it
 * away. Only the owner may; the change is signed with the owner's account.
 *
 * SIDE EFFECT: Changes the person's mode, writes a signed grant and appends to the authority log.
 */
export function setSignOffRight(input: { readonly enterpriseId: string; readonly person: string; readonly canSignOff: boolean; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = refuseUnlessOwner(input.actor, input.enterpriseId, "decide who signs off work");
  if (refusal) return { refused: refusal };
  const person = personAt(input.enterpriseId, input.person);
  if (!person) return { refused: "Choose someone who works here." };
  if (!input.canSignOff && input.actor && same(input.actor.workerName, person)) return { refused: "You cannot take away your own right to sign off." };
  const now = input.now ?? Date.now();
  setHumanWorkerSignOff(person, input.canSignOff);
  const by = input.actor?.workerName ?? "the terminal";
  recordGrant(input.enterpriseId, person, input.canSignOff, by, input.actor?.userId, now);
  if (input.canSignOff) {
    // Tama overlap / Tama fix: granting the right creates the account in the
    // same signed step, so the signer appears in the staff list with a
    // membership and maySignOff can see the grant once sign-in is on.
    const existing = membershipOf(input.enterpriseId, person);
    const role = existing?.role ?? (ownerCount(input.enterpriseId) > 0 ? "member" : "owner");
    ensureUser(input.enterpriseId, person, role);
  } else {
    revokeOffTerminalLinksForPerson(input.enterpriseId, person, now);
    const waiting = waitingDraftsForPerson(input.enterpriseId, person);
    endDraftsForInvolving(input.enterpriseId, person, by, now);
    openHandBacksForLostRight({
      enterpriseId: input.enterpriseId,
      person,
      changedBy: by,
      ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
      at: now,
    });
    logAuthorityChange({ enterpriseId: input.enterpriseId, what: "may no longer sign off work", person, by, ...(input.actor ? { byUserId: input.actor.userId } : {}), at: now });
    recordStaffChangeEvent({ what: `took the sign-off right from ${person}`, by });
    const message = `${person} can no longer sign off work or give go-aheads.` + (
      waiting.length > 0 ? `\n\n${formatRoleChangeHandBackConfirm(waiting.length)}` : ""
    );
    return { message };
  }
  logAuthorityChange({ enterpriseId: input.enterpriseId, what: "may sign off work", person, by, ...(input.actor ? { byUserId: input.actor.userId } : {}), at: now });
  recordStaffChangeEvent({ what: `gave ${person} the right to sign off work and give go-aheads`, by });
  return { message: `${person} can now sign off work and give go-aheads.` };
}

/** SIDE EFFECT: Deletes every sign-in record and guess count (tests and /reset). */
export function clearSignIn(): void {
  clearPersistedSignIn();
  guesses.clear();
}
