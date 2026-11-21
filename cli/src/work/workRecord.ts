/**
 * A named piece of work: a law practice's matter, a publisher's book, a deal
 * within a book, or any other piece of work a business names.
 *
 * Every first draft belongs to exactly one piece of work, set once and never
 * moved (Job.workId). The record says what the work is called, what kind it
 * is, which book a deal belongs to, the client it is for, and, on a law
 * practice, its matter number and matter type. "No AI" is set on the record
 * itself and read up the chain every time it is checked (workStore.ts
 * effectiveNoAi), never copied onto a deal.
 *
 * The record is HMAC-signed with the local approval signing key, so an edit
 * in the data directory makes it fail to verify, and work whose record does
 * not verify is treated as locked. Anyone who can read that key can re-sign
 * it (THREAT_MODEL.md items 1, 2 and 8).
 *
 * Everything here is pure: the store (workStore.ts) reads and writes.
 */

import crypto from "node:crypto";

import { formatNzDay } from "../core/nzTime";

export const WORK_KINDS = ["matter", "book", "deal", "work"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

/**
 * Matter types a law practice may use for AI drafting (Amy, addendum 1).
 * Employment is non-contentious only: a grievance, a personal grievance claim
 * or a dismissal is a dispute. Property and conveyancing has no precedents in
 * v1, but the type exists so the matter is set up correctly.
 */
export const UNLOCKED_MATTER_TYPES = ["commercial", "employment", "property", "general-advice"] as const;

/**
 * Matter types that never reach an AI worker. Fixed in code, with no off
 * switch and no exception for a single matter (Grace, Amy).
 */
export const FIXED_LOCKED_MATTER_TYPES = [
  "will",
  "court",
  "dispute",
  "enduring-power-of-attorney",
  "estate-administration",
  "relationship-property",
] as const;

export const BUILT_IN_MATTER_TYPES = [...UNLOCKED_MATTER_TYPES, ...FIXED_LOCKED_MATTER_TYPES] as const;
export type BuiltInMatterType = (typeof BUILT_IN_MATTER_TYPES)[number];
/** A built-in type, or one the owner added (practiceSetting.ts). */
export type MatterType = string;

export const MATTER_TYPE_LABELS: Readonly<Record<BuiltInMatterType, string>> = {
  commercial: "Commercial contracts",
  employment: "Employment (non-contentious)",
  property: "Property and conveyancing",
  "general-advice": "General advice",
  will: "Will",
  court: "Court work",
  dispute: "Dispute",
  "enduring-power-of-attorney": "Enduring power of attorney",
  "estate-administration": "Estate administration",
  "relationship-property": "Relationship property or prenuptial agreement",
};

/**
 * Which precedents each matter type may offer. A precedent is never suggested
 * for a type it is not listed for. Step 1 keeps the list; the precedent
 * library that reads it is step 3.
 */
export const MATTER_TYPE_PRECEDENTS: Readonly<Record<BuiltInMatterType, readonly string[]>> = {
  commercial: ["mutual-nda", "one-way-nda", "supplier-services-agreement"],
  employment: ["employment-agreement"],
  property: [],
  "general-advice": [],
  will: [],
  court: [],
  dispute: [],
  "enduring-power-of-attorney": [],
  "estate-administration": [],
  "relationship-property": [],
};

/**
 * A type the owner added. It starts locked until the owner unlocks it, and the
 * unlock applies only to matters opened afterwards (unlockedAt), so no matter
 * already open as that type ever becomes unlocked (Grace, addendum 1).
 */
export type CustomMatterType = { readonly id: string; readonly label: string; readonly locked: boolean; readonly unlockedAt?: number };

/** The deal -> book walk stops here. */
export const MAX_WORK_DEPTH = 2;
export const MAX_WORK_NAME_LENGTH = 200;
export const MATTER_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/.]{0,39}$/;
export const MATTER_TYPE_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
export const MAX_CHANGE_REASON_LENGTH = 500;

/** Amy, addendum 1: the exact refusal for anything but a numbered, typed matter on a law practice. */
export const LAW_PRACTICE_MATTER_ONLY = "On a law-practice account, open a matter with a number and type first.";

export const UNVERIFIED_WORK = "This work's record does not verify, so nothing on it can go to an AI worker.";

export type WorkRecord = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly name: string;
  readonly kind: WorkKind;
  /** A deal's book. Only a deal has one. */
  readonly parentWorkId?: string;
  readonly clientId?: string;
  readonly matterNumber?: string;
  /** Set when the matter is opened, before any material is attached. */
  readonly matterType?: MatterType;
  readonly noAi: boolean;
  /** Stored now, enforced in step 3. Off by default. */
  readonly paidEscalationAllowed: boolean;
  /** One more for every change. */
  readonly version: number;
  readonly createdAt: number;
  readonly createdBy: string;
  readonly changedAt?: number;
  readonly changedBy?: string;
  /**
   * Set once, when the work is cancelled (workChanges.ts cancelWork). It is
   * never cleared: cancelled work is not reopened, and nothing is deleted.
   */
  readonly cancelledAt?: number;
  readonly cancelledBy?: string;
  readonly cancelledByUserId?: string;
  readonly cancelReason?: string;
  /**
   * The cancelled work this replaces, newest in its chain. A signed link for
   * reference and carry-over only: it never makes the cancelled work's
   * material available.
   */
  readonly replacesWorkId?: string;
  /** What was carried over from replacesWorkId, and whether its record was confirmed. */
  readonly carryOver?: CarryOver;
  /**
   * The matter's type is held locked because a carry-over check failed,
   * until the owner changes the type, with a reason.
   */
  readonly typeHeld?: true;
  /**
   * When the matter's type last changed (workChanges.ts changeMatterType).
   * A sign-off given before it falls away, and a Task created before it is
   * stopped at start, before each model call and at finish, where its result
   * is set aside by Arturo (workLocks.ts).
   */
  readonly typeChangedAt?: number;
  readonly signature: string;
};

export type CarryOver = {
  readonly from: string;
  /** False when the record it replaces was missing or did not verify. */
  readonly checked: boolean;
  readonly noAi: boolean;
  readonly lockedType?: string;
  /**
   * The owner reopened a cancelled locked matter's number as this unlocked
   * type, with a reason (Grace's only route from locked to unlocked).
   */
  readonly reopenedAs?: string;
};

export type UnsignedWorkRecord = Omit<WorkRecord, "signature">;

export type WorkStanding =
  | { readonly state: "verified"; readonly work: WorkRecord }
  | { readonly state: "unverified"; readonly id: string }
  | { readonly state: "missing"; readonly id: string };

/** What a record attests to. The purpose keeps it from verifying as anything else. PURE: No side effects. */
export function createWorkRecordPayload(work: UnsignedWorkRecord): string {
  return JSON.stringify({
    purpose: "work-record",
    id: work.id,
    enterpriseId: work.enterpriseId,
    name: work.name,
    kind: work.kind,
    parentWorkId: work.parentWorkId ?? null,
    clientId: work.clientId ?? null,
    matterNumber: work.matterNumber ?? null,
    matterType: work.matterType ?? null,
    noAi: work.noAi,
    paidEscalationAllowed: work.paidEscalationAllowed,
    version: work.version,
    createdAt: work.createdAt,
    createdBy: work.createdBy,
    changedAt: work.changedAt ?? null,
    changedBy: work.changedBy ?? null,
    // Fields added with cancelling are signed only when present, so a record
    // signed before them still verifies, and removing one breaks it.
    cancelledAt: work.cancelledAt,
    cancelledBy: work.cancelledBy,
    cancelledByUserId: work.cancelledByUserId,
    cancelReason: work.cancelReason,
    replacesWorkId: work.replacesWorkId,
    carryOver: work.carryOver
      ? { from: work.carryOver.from, checked: work.carryOver.checked, noAi: work.carryOver.noAi, lockedType: work.carryOver.lockedType, reopenedAs: work.carryOver.reopenedAs }
      : undefined,
    typeHeld: work.typeHeld,
    typeChangedAt: work.typeChangedAt,
  });
}

/** PURE: No side effects. */
export function signWorkRecord(work: UnsignedWorkRecord, secret: string): string {
  return crypto.createHmac("sha256", secret).update(createWorkRecordPayload(work)).digest("hex");
}

/** PURE: No side effects. */
export function verifyWorkRecordSignature(work: WorkRecord, secret: string): boolean {
  const expected = Buffer.from(signWorkRecord(work, secret));
  const actual = Buffer.from(String(work.signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** PURE: No side effects. */
export function isWorkKind(value: string): value is WorkKind {
  return (WORK_KINDS as readonly string[]).includes(value);
}

/** PURE: No side effects. */
export function isBuiltInMatterType(value: string): value is BuiltInMatterType {
  return (BUILT_IN_MATTER_TYPES as readonly string[]).includes(value);
}

/** PURE: No side effects. */
export function isFixedLockedMatterType(value: string): boolean {
  return (FIXED_LOCKED_MATTER_TYPES as readonly string[]).includes(value);
}

/**
 * Whether a matter type is locked. The fixed types are locked whatever any
 * setting says; an owner-added type is locked until the owner unlocks it; an
 * unknown type, including any "other", is locked.
 *
 * With openedAt (a matter's createdAt), an owner-added type unlocked after
 * the matter was opened is still locked for it: unlocking applies only to
 * matters opened afterwards (Grace, addendum 1). An unlocked added type with
 * no recorded unlock time is treated as locked for every matter (fail closed).
 *
 * PURE: No side effects.
 */
export function isLockedMatterType(type: string, custom: readonly CustomMatterType[] = [], openedAt?: number): boolean {
  if (isFixedLockedMatterType(type)) return true;
  if ((UNLOCKED_MATTER_TYPES as readonly string[]).includes(type)) return false;
  if (type === "other") return true;
  const added = custom.find((one) => one.id === type);
  if (!added || added.locked) return true;
  if (openedAt === undefined) return false;
  return added.unlockedAt === undefined || openedAt < added.unlockedAt;
}

/**
 * Whether this matter's own type is locked: its type (for a matter opened
 * when it was), or a type held after a failed carry-over check. Work that
 * isn't a matter, or has no type, has no type lock here.
 *
 * PURE: No side effects.
 */
export function isWorkTypeLocked(work: Pick<WorkRecord, "kind" | "matterType" | "typeHeld" | "createdAt">, custom: readonly CustomMatterType[] = []): boolean {
  if (work.kind !== "matter") return false;
  if (work.typeHeld) return true;
  return work.matterType !== undefined && isLockedMatterType(work.matterType, custom, work.createdAt);
}

/**
 * Who may change a matter's type, decided by the function from the fixed
 * lists of locked and unlocked types, never by the menu (Amy after the demo;
 * Grace's ruling and her answers to Mia's v5 questions, addendum 1):
 *
 *   - locked to unlocked: never ("refused"). The only route is reopening a
 *     cancelled locked matter's number as an unlocked type (createWork);
 *   - locked to locked: anyone who can sign off, with a reason ("signer");
 *   - unlocked to locked (tightening): anyone working at the business, with
 *     an optional short reason that never holds up the lock ("anyone");
 *   - unlocked to unlocked: the owner only, with a reason ("owner").
 *
 * PURE: No side effects.
 */
export function typeChangeRule(fromLocked: boolean, toLocked: boolean): "refused" | "signer" | "anyone" | "owner" {
  if (fromLocked) return toLocked ? "signer" : "refused";
  return toLocked ? "anyone" : "owner";
}

/**
 * The precedents a piece of work may be offered now, built afresh from its
 * signed type on every read: nothing is kept from an earlier type, so after a
 * type change the list is the new type's and nothing ticked before is sent
 * again until someone ticks it. A locked matter is offered none.
 *
 * PURE: No side effects.
 */
export function suggestedPrecedents(work: Pick<WorkRecord, "kind" | "matterType" | "typeHeld" | "createdAt">, custom: readonly CustomMatterType[] = []): readonly string[] {
  if (work.kind !== "matter" || !work.matterType || isWorkTypeLocked(work, custom)) return [];
  return precedentsForMatterType(work.matterType);
}

/** Whether a type is one this business can choose. PURE: No side effects. */
export function isKnownMatterType(type: string, custom: readonly CustomMatterType[] = []): boolean {
  return isBuiltInMatterType(type) || custom.some((one) => one.id === type);
}

/** The words for a type. PURE: No side effects. */
export function matterTypeLabel(type: string, custom: readonly CustomMatterType[] = []): string {
  return isBuiltInMatterType(type) ? MATTER_TYPE_LABELS[type] : custom.find((one) => one.id === type)?.label ?? type;
}

/** The precedents a matter type may offer. PURE: No side effects. */
export function precedentsForMatterType(type: string): readonly string[] {
  return isBuiltInMatterType(type) ? MATTER_TYPE_PRECEDENTS[type] : [];
}

/** Why a typed reason will not do (reason_missing, reason_too_long), or undefined. PURE: No side effects. */
export function refuseChangeReason(reason: string | undefined): WorkRefusal | undefined {
  const tidy = (reason ?? "").replace(/\s+/g, " ").trim();
  if (!tidy) return { code: "reason_missing" };
  if (tidy.length > MAX_CHANGE_REASON_LENGTH) return { code: "reason_too_long" };
  return undefined;
}

/** The sentence the terminal shows for an owner-only change (the brief's fixed wording). */
export const OWNER_CHANGE_ON_PAGE_TEXT = "Make this change on the company page, signed in as the owner.";

/** What a tightening lock is logged with when no reason is given (Grace). */
export const NO_REASON_GIVEN = "No reason given";

/**
 * Why a piece of work could not be opened or changed, as a fixed code (Mia's
 * Q6 and her spec's section 9). The terminal and the company page each word
 * it from WORK_REFUSAL_WORDING, one table, so the two can't drift apart.
 * The terminal's wording names no flags, except the brief's fixed owner-only
 * sentence.
 */
export const WORK_REFUSAL_CODES = [
  "name_required",
  "name_too_long",
  "law_practice_matter_only",
  "kind_unknown",
  "parent_required",
  "parent_not_allowed",
  "parent_not_found",
  "parent_unverified",
  "parent_other_business",
  "parent_not_book",
  "parent_cycle",
  "parent_too_deep",
  "parent_cancelled",
  "client_not_found",
  "matter_fields_on_non_matter",
  "matter_number_pattern",
  "matter_type_unknown",
  "matter_number_in_use",
  "matter_number_cancelled",
  "replaces_still_open",
  "replaces_already_replaced",
  "replaces_other_kind",
  "replaces_other_book",
  "person_unknown",
  // Mia's section 9 codes for changes, named by Sam.
  "type_locked_to_unlocked",
  "carry_over_unverified",
  "owner_only",
  "not_at_business",
  "cancel_not_signer",
  "reason_missing",
  "reason_too_long",
  "sign_in_off",
  "unverified_work",
  // The other refusals a change can give, so none is a loose string.
  "work_not_found",
  "work_cancelled",
  "already_cancelled",
  "other_business",
  "as_required",
  "person_suspended",
  "not_a_matter",
  "type_unchanged",
  "type_change_not_signer",
  "no_ai_unchanged",
  "escalation_unchanged",
  "practice_unverified",
  "practice_unchanged",
  "type_other",
  "type_id_pattern",
  "type_label",
  "type_exists",
  "type_no_off_switch",
  "type_not_added",
  "type_already_unlocked",
] as const;
export type WorkRefusalCode = (typeof WORK_REFUSAL_CODES)[number];
export type WorkRefusal = { readonly code: WorkRefusalCode; readonly values?: Readonly<Record<string, string>> };

type Words = (values: Readonly<Record<string, string>>) => string;

/** "this matter", "this book", "this deal" or "this piece of work", from a kind value. PURE. */
const thisKind = (kind: string | undefined) => (kind === "matter" || kind === "book" || kind === "deal" ? `this ${kind}` : "this piece of work");

/**
 * Each refusal's wording at the terminal and on the company page (Mia's
 * section 9, and her section 1 page errors). The page never names terminal
 * flags, and since follow-up 3 the terminal doesn't either.
 */
export const WORK_REFUSAL_WORDING: Readonly<Record<WorkRefusalCode, { readonly terminal: Words; readonly page: Words }>> = {
  name_required: {
    terminal: () => "Give the work a name, such as \"Matter 2026-014\" or \"Mole's Big Day, German rights\".",
    page: () => "Give it a name.",
  },
  name_too_long: {
    terminal: () => `Keep the name under ${MAX_WORK_NAME_LENGTH} characters.`,
    page: () => `Keep the name under ${MAX_WORK_NAME_LENGTH} characters.`,
  },
  law_practice_matter_only: { terminal: () => LAW_PRACTICE_MATTER_ONLY, page: () => LAW_PRACTICE_MATTER_ONLY },
  kind_unknown: {
    terminal: () => `Choose what kind of work it is: ${WORK_KINDS.join(", ")}.`,
    page: () => "Choose what kind of work it is.",
  },
  parent_required: {
    terminal: () => "A deal belongs to a book. Name its book.",
    page: () => "A deal belongs to a book. Choose the book.",
  },
  parent_not_allowed: {
    terminal: () => "Only a deal belongs to other work (its book).",
    page: () => "Only a deal belongs to a book.",
  },
  parent_not_found: {
    terminal: (v) => `There is no work called ${v.id}.`,
    page: () => "That book isn't recorded at this business. Choose the book again.",
  },
  parent_unverified: {
    terminal: (v) => `The record of ${v.id} does not verify, so nothing can be added under it.`,
    page: () => "That book's record doesn't verify, so nothing can be added under it.",
  },
  parent_other_business: {
    terminal: (v) => `There is no work called ${v.id} at this business.`,
    page: () => "That is not part of your business.",
  },
  parent_not_book: {
    terminal: () => "A deal's parent must be a book.",
    page: () => "A deal belongs to a book. Choose the book.",
  },
  parent_cycle: {
    terminal: () => "That would make the work belong to itself.",
    page: () => "That would make the work belong to itself.",
  },
  parent_too_deep: {
    terminal: () => `Work can be nested at most ${MAX_WORK_DEPTH} deep (a deal within a book).`,
    page: () => "A deal belongs to a book, and a book belongs to nothing else.",
  },
  parent_cancelled: {
    terminal: () => "A new deal can't be opened under a cancelled book.",
    page: (v) => `${v.name} was cancelled, so no new deal can be opened in it.`,
  },
  client_not_found: {
    terminal: (v) => `No client ${v.id} is recorded for this business.`,
    page: (v) => `No client ${v.id} is recorded for this business.`,
  },
  matter_fields_on_non_matter: {
    terminal: () => "Only a matter has a matter number and a matter type.",
    page: () => "Only a matter has a matter number and a matter type.",
  },
  matter_number_pattern: {
    terminal: () => "A matter number is up to 40 letters, digits, dashes, slashes or dots, starting with a letter or digit.",
    page: () => "Up to 40 letters, digits, dashes, slashes or dots, starting with a letter or digit.",
  },
  matter_type_unknown: {
    terminal: (v) => `Choose one of this business's matter types${v.types ? `: ${v.types}` : ""}.`,
    page: () => "Choose one of this business's matter types.",
  },
  matter_number_in_use: {
    terminal: (v) => `Matter number ${v.number} is already used at this business.`,
    page: (v) => `Matter number ${v.number} is already used by ${v.name}, which is still open. Use another number.`,
  },
  matter_number_cancelled: {
    terminal: (v) => `Matter number ${v.number} was used by ${v.name}, cancelled ${v.date || "earlier"}. Name the cancelled matter it replaces, or use another number.`,
    page: (v) => `${v.number} is already used by cancelled ${v.name}. Choose "This replaces ${v.name}" to reuse it, or use another number.`,
  },
  replaces_still_open: {
    terminal: (v) => `${v.name} is still open, so nothing can replace it. Only cancelled work is replaced.`,
    page: (v) => `${v.name} is still open, so nothing can replace it.`,
  },
  replaces_already_replaced: {
    terminal: (v) => `${v.name} was already replaced by ${v.newer}, which is still open.`,
    page: (v) => `${v.name} was already replaced by ${v.newer}, which is still open.`,
  },
  replaces_other_kind: {
    terminal: (v) => `${v.name} is a ${v.kind}, so a ${v.newKind} can't replace it.`,
    page: (v) => `${v.name} is a ${v.kind}, so a ${v.newKind} can't replace it.`,
  },
  replaces_other_book: {
    terminal: (v) => `A deal replaces only a cancelled deal in the same book. ${v.name} is in another book.`,
    page: (v) => `A deal replaces only a cancelled deal in the same book. ${v.name} is in another book.`,
  },
  person_unknown: {
    terminal: (v) => `Nobody called ${v.name || "that"} works at this business.`,
    page: (v) => `Nobody called ${v.name || "that"} works at this business.`,
  },
  type_locked_to_unlocked: {
    terminal: () => "A locked matter type can't be changed to an unlocked one. Cancel the matter with a reason and open a new one.",
    page: (v) => `${v.type || "Locked"} matters can't be changed to an unlocked type. If it was opened with the wrong type, cancel it with a reason and open a new matter.`,
  },
  carry_over_unverified: {
    terminal: () => "No AI is on and the type is locked because Arturo couldn't confirm the record this replaces.",
    page: () => "No AI is on and the type is locked because Arturo couldn't confirm the record this replaces.",
  },
  owner_only: {
    terminal: () => OWNER_CHANGE_ON_PAGE_TEXT,
    page: () => "Only the owner can change this, signed in, with a reason.",
  },
  not_at_business: {
    terminal: (v) => `Nobody called ${v.name || "that"} works at this business. Anyone working at this business may turn "no AI" on.`,
    page: () => "Only people registered at this business can turn No AI on here.",
  },
  cancel_not_signer: {
    terminal: () => "Only someone who may sign off work can cancel it.",
    page: (v) => `Only someone who can sign off work can cancel ${thisKind(v.kind)}.`,
  },
  reason_missing: {
    terminal: () => "Give a reason, in a few words. It is kept in the signed log.",
    page: () => "Give a reason, in a few words. It is kept in the signed log.",
  },
  reason_too_long: {
    terminal: () => `Keep the reason under ${MAX_CHANGE_REASON_LENGTH} characters.`,
    page: () => `Keep the reason under ${MAX_CHANGE_REASON_LENGTH} characters.`,
  },
  sign_in_off: {
    terminal: () => "Turn sign-in on first. The law-practice setting is turned on by the owner, signed in.",
    page: () => "Turn sign-in on first.",
  },
  unverified_work: {
    terminal: () => UNVERIFIED_WORK,
    page: () => "This work's record doesn't verify, so nothing on it can go to an AI worker.",
  },
  work_not_found: {
    terminal: (v) => `There is no work called ${v.id || "that"}.`,
    page: () => "There is no work with that id at this business.",
  },
  work_cancelled: {
    terminal: (v) => `${v.name} was cancelled, so it can't be changed. To pick it up again, open a new piece of work.`,
    page: (v) => `${v.name} was cancelled, so it can't be changed. To pick it up again, open a new ${v.kind === "matter" ? "matter" : "piece of work"}.`,
  },
  already_cancelled: {
    terminal: (v) => `${v.name} was already cancelled. Nothing was changed.`,
    page: (v) => `${v.name} was already cancelled. Nothing was changed.`,
  },
  other_business: {
    terminal: () => "That is not part of this business.",
    page: () => "That is not part of your business.",
  },
  as_required: {
    terminal: (v) => `Say who you are with --as "<your name>". ${v.who || "Anyone working at this business"} may do this.`,
    page: () => "Sign in first.",
  },
  person_suspended: {
    terminal: (v) => `${v.name}'s access is suspended.`,
    page: (v) => `${v.name}'s access is suspended.`,
  },
  not_a_matter: {
    terminal: () => "Only a matter has a matter type.",
    page: () => "Only a matter has a matter type.",
  },
  type_unchanged: {
    terminal: (v) => `${v.name} is already ${v.type}. Nothing was changed.`,
    page: (v) => `${v.name} is already ${v.type}. Nothing was changed.`,
  },
  type_change_not_signer: {
    terminal: () => "Only someone who may sign off work can change a locked matter's type.",
    page: () => "Only someone who can sign off work can change a locked matter's type.",
  },
  no_ai_unchanged: {
    terminal: (v) => `"No AI" is already ${v.state} for ${v.name}. Nothing was changed.`,
    page: (v) => `No AI is already ${v.state} for ${v.name}. Nothing was changed.`,
  },
  escalation_unchanged: {
    terminal: (v) => `Paid escalation is already ${v.state} for ${v.name}. Nothing was changed.`,
    page: (v) => `Paid escalation is already ${v.state} for ${v.name}. Nothing was changed.`,
  },
  practice_unverified: {
    terminal: () => "This business's practice setting does not verify, so it is read as a law practice and cannot be changed here.",
    page: () => "This setting's record doesn't verify, so Arturo treats this business as a law practice. It can't be changed here.",
  },
  practice_unchanged: {
    terminal: (v) => `The law-practice setting is already ${v.state}. Nothing was changed.`,
    page: (v) => `Law-practice settings are already ${v.state}. Nothing was changed.`,
  },
  type_other: {
    terminal: () => 'There is no "Other" type. Name the kind of matter it is.',
    page: () => 'There is no "Other" type. Name the kind of matter it is.',
  },
  type_id_pattern: {
    terminal: () => "A matter type's short name is 2 to 40 lower-case letters, digits or dashes, starting with a letter.",
    page: () => "The short name is 2 to 40 lower-case letters, digits or dashes, starting with a letter.",
  },
  type_label: {
    terminal: () => "Give the type a label of up to 80 characters.",
    page: () => "Give the type a name for the list, up to 80 characters.",
  },
  type_exists: {
    terminal: (v) => `There is already a matter type called ${v.id}.`,
    page: (v) => `There is already a matter type called ${v.id}.`,
  },
  type_no_off_switch: {
    terminal: (v) => `${v.type} matters are locked with no off switch. Only a matter type the owner added can be unlocked.`,
    page: (v) => `${v.type} matters never go to an AI worker, and this lock has no off switch.`,
  },
  type_not_added: {
    terminal: (v) => `There is no added matter type called ${v.id}.`,
    page: (v) => `There is no added matter type called ${v.id}.`,
  },
  type_already_unlocked: {
    terminal: (v) => `${v.type} is already unlocked. Nothing was changed.`,
    page: (v) => `${v.type} is already unlocked. Nothing was changed.`,
  },
};

/** A refusal in the terminal's or the page's words. PURE: No side effects. */
export function workRefusalText(refusal: WorkRefusal, where: "terminal" | "page"): string {
  return WORK_REFUSAL_WORDING[refusal.code][where](refusal.values ?? {});
}

/** One matter number held at the business, open or cancelled. */
export type HeldMatterNumber = { readonly number: string; readonly id: string; readonly name: string; readonly cancelled: boolean; readonly createdAt: number; readonly cancelledAt?: number };

export type WorkRecordInput = {
  readonly enterpriseId: string;
  readonly name: string;
  readonly kind: string;
  readonly parentWorkId?: string;
  readonly clientId?: string;
  readonly matterNumber?: string;
  readonly matterType?: string;
  /** The cancelled work this replaces, newest in its chain, already resolved. */
  readonly replaces?: WorkRecord;
};

export type WorkRecordContext = {
  readonly lookup: (id: string) => WorkStanding;
  /** Whether the business is a law practice (an unverified setting counts as yes). */
  readonly lawPractice: boolean;
  readonly customMatterTypes: readonly CustomMatterType[];
  /** The business of a client, if it is recorded. */
  readonly clientBusiness: (clientId: string) => string | undefined;
  /** Matter numbers already held at this business, by open and cancelled work. */
  readonly matterNumbers: readonly HeldMatterNumber[];
};

/**
 * Why a new piece of work cannot be recorded, as a fixed code, or undefined.
 * Checked before anything is written.
 *
 * A matter number is unique among work that hasn't been cancelled. A number
 * held only by cancelled work may be reused by naming the cancelled work it
 * replaces (input.replaces, resolved to the newest record in its chain).
 *
 * PURE: No side effects (beyond the lookups passed in).
 */
export function refuseWorkRecord(input: WorkRecordInput, context: WorkRecordContext): WorkRefusal | undefined {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return { code: "name_required" };
  if (name.length > MAX_WORK_NAME_LENGTH) return { code: "name_too_long" };
  // On a law practice only a matter with a number and a type is opened: a
  // general piece of work would skip the matter type, and with it the locks.
  if (context.lawPractice && (input.kind !== "matter" || !input.matterNumber?.trim() || !input.matterType?.trim())) {
    return { code: "law_practice_matter_only" };
  }
  if (!isWorkKind(input.kind)) return { code: "kind_unknown" };
  const parentId = input.parentWorkId?.trim() || undefined;
  if (input.kind === "deal" && !parentId) return { code: "parent_required" };
  if (input.kind !== "deal" && parentId) return { code: "parent_not_allowed" };
  if (parentId) {
    const refusal = refuseParentChain(parentId, input.enterpriseId, context.lookup);
    if (refusal) return refusal;
  }
  if (input.clientId !== undefined) {
    if (context.clientBusiness(input.clientId) !== input.enterpriseId) return { code: "client_not_found", values: { id: input.clientId } };
  }
  if (input.kind !== "matter" && (input.matterNumber !== undefined || input.matterType !== undefined)) {
    return { code: "matter_fields_on_non_matter" };
  }
  const number = input.matterNumber?.trim();
  if (number !== undefined && !MATTER_NUMBER_PATTERN.test(number)) return { code: "matter_number_pattern" };
  if (input.matterType !== undefined && !isKnownMatterType(input.matterType, context.customMatterTypes)) {
    return { code: "matter_type_unknown", values: { types: [...BUILT_IN_MATTER_TYPES, ...context.customMatterTypes.map((one) => one.id)].join(", ") } };
  }
  if (input.replaces) {
    const old = input.replaces;
    if (old.kind !== input.kind) return { code: "replaces_other_kind", values: { name: old.name, kind: old.kind, newKind: input.kind } };
    if (old.kind === "deal" && old.parentWorkId !== parentId) return { code: "replaces_other_book", values: { name: old.name } };
  }
  if (number) {
    const holders = context.matterNumbers.filter((held) => held.number.toLowerCase() === number.toLowerCase());
    const open = holders.find((held) => !held.cancelled);
    if (open) return { code: "matter_number_in_use", values: { number, name: open.name } };
    const cancelled = holders.filter((held) => held.cancelled).sort((a, b) => b.createdAt - a.createdAt);
    if (cancelled.length && !(input.replaces && cancelled.some((held) => held.id === input.replaces!.id))) {
      return { code: "matter_number_cancelled", values: { number, name: cancelled[0].name, id: cancelled[0].id, date: formatNzDay(cancelled[0].cancelledAt) } };
    }
  }
  return undefined;
}

/**
 * Why a parent cannot be a deal's book: missing, unverified, at another
 * business, not a book, cancelled, a cycle, or a chain longer than
 * MAX_WORK_DEPTH.
 *
 * PURE: No side effects (beyond the lookup).
 */
export function refuseParentChain(parentId: string, enterpriseId: string, lookup: (id: string) => WorkStanding): WorkRefusal | undefined {
  const parent = lookup(parentId);
  if (parent.state === "missing") return { code: "parent_not_found", values: { id: parentId } };
  if (parent.state === "unverified") return { code: "parent_unverified", values: { id: parentId } };
  if (parent.work.enterpriseId !== enterpriseId) return { code: "parent_other_business", values: { id: parentId } };
  if (parent.work.kind !== "book") return { code: "parent_not_book" };
  if (parent.work.cancelledAt !== undefined) return { code: "parent_cancelled", values: { name: parent.work.name } };
  const seen = new Set<string>();
  let current: WorkRecord | undefined = parent.work;
  let depth = 1;
  while (current?.parentWorkId) {
    if (seen.has(current.id)) return { code: "parent_cycle" };
    seen.add(current.id);
    depth += 1;
    if (depth >= MAX_WORK_DEPTH) return { code: "parent_too_deep" };
    const next = lookup(current.parentWorkId);
    if (next.state !== "verified") return { code: "parent_unverified", values: { id: current.parentWorkId } };
    current = next.work;
  }
  return undefined;
}

/**
 * A title as the cancelled-title match reads it: capitals and apostrophes
 * ignored, spaces collapsed (John, addendum 1). Nothing cleverer.
 *
 * PURE: No side effects.
 */
export function matchableTitle(title: string): string {
  return title.toLowerCase().replace(/['\u2018\u2019\u02bc`]/g, "").replace(/\s+/g, " ").trim();
}

/** A fresh id for a piece of work. PURE apart from randomness. */
export function newWorkId(): string {
  return `work-${crypto.randomUUID()}`;
}
