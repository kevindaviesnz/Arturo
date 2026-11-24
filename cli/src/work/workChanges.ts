/**
 * Opening named work and changing it: "no AI", a matter's type, paid
 * escalation, and the business's law-practice setting and work types.
 *
 * Who may do what:
 *   - anyone who works at the business may open work; on a law practice,
 *     only a matter with a number and a type (workRecord.ts);
 *   - anyone working at the business may turn "no AI" on (the safe
 *     direction), at the terminal too, with no reason;
 *   - only the owner, signed in on the company page, may turn "no AI" off,
 *     switch on paid escalation, turn the law-practice setting on or off,
 *     add or unlock a work type, change a matter from one unlocked type to
 *     another, or reopen a cancelled locked matter's number as an unlocked
 *     type. The terminal is refused inside refuseUnlessOwner itself, so the
 *     page and the terminal follow one rule. Each owner-only change that
 *     loosens something needs a typed reason, signed into the change log.
 *   - a matter's type (changeMatterType) follows typeChangeRule, decided in
 *     the function for every caller: locked to unlocked never; locked to
 *     locked by anyone who can sign off, with a reason; unlocked to locked by
 *     anyone at the business, with an optional reason that never holds up
 *     the lock; unlocked to unlocked by the owner, with a reason. Every type
 *     change makes earlier sign-offs fall away (runtime/resultSignOff.ts),
 *     cancels Tasks not started, sets aside running results through the
 *     system actor when they finish (workLocks.ts, typeChangedAt), and
 *     rebuilds the suggestion list from the new type; nothing is re-sent.
 *
 * Every refusal is a fixed code (workRecord.ts WORK_REFUSAL_CODES), worded
 * for the terminal when there is no signed-in account and for the page when
 * there is.
 *
 * Every refusal is decided before anything is written. Every change is
 * signed on the record and appended to the signed, hash-chained change log.
 *
 * Turning "no AI" on cancels every Task on that work, and on every deal of a
 * book, that has not started. A Task already running is not stopped: its
 * result is set aside by Arturo when it finishes (workerRuntime.ts).
 *
 * Cancelling (cancelWork) is for someone who can sign off work, with a typed
 * reason. It signs each record as cancelled (a book and every deal in it,
 * one log entry each, under the same reason), cancels Tasks not started, and
 * leaves running ones to be set aside. Nothing is deleted, and cancelled work
 * can't be changed or reopened. A matter number is unique among work that
 * isn't cancelled (in code and by a partial unique index); reusing a
 * cancelled one, and replacing a cancelled book or deal, needs a signed link
 * naming the work it replaces (resolveReplacement). The link is followed to
 * its newest record, which must verify; "no AI" and a locked type carry over
 * only from it. If it can't be confirmed, the new work opens with "no AI" on
 * and, for a matter, its type held locked. A cancelled book or deal with the
 * same title is offered as the link, never required.
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { getClientRecord } from "../clients/clientStore";
import { peopleOf } from "../clients/clientCommands";
import { listPeople, maySignOff, refuseUnlessOwner, signInOn, type Actor } from "../identity/companySignIn";
import { resolveConfiguredProvider } from "../llm/llmClient";
import { providerLabel } from "../llm/modelCatalog";
import { CANCELLABLE_JOB_STATUSES, cancelJob, listJobs } from "../runtime/jobQueue";
import { loadWorkRecordRow } from "../storage/workRepository";
import { getPracticeSetting, saveSignedPracticeSetting } from "./practiceSetting";
import {
  BUILT_IN_MATTER_TYPES,
  isBuiltInMatterType,
  isFixedLockedMatterType,
  isKnownMatterType,
  isLockedMatterType,
  isWorkTypeLocked,
  matterTypeLabel,
  MATTER_TYPE_ID_PATTERN,
  matchableTitle,
  newWorkId,
  NO_REASON_GIVEN,
  refuseChangeReason,
  refuseWorkRecord,
  suggestedPrecedents,
  typeChangeRule,
  workRefusalText,
  type CarryOver,
  type WorkRecord,
  type WorkRefusal,
} from "./workRecord";
import { effectiveNoAi, getWork, insertSignedWork, listWorkChanges, listWorkFor, logWorkChange, replaceSignedWork, resolveWorkChain } from "./workStore";
import { listWorkSends, type WorkSend } from "./workSendLog";

/** A refusal: its fixed code, and its words for whoever asked (the page when signed in, the terminal otherwise). */
type Refusal = { readonly refused: string; readonly refusal: WorkRefusal };

/** A coded refusal, worded for the page when an account is signed in, for the terminal otherwise. PURE. */
const refuse = (refusal: WorkRefusal, actor?: Actor): Refusal => ({ refused: workRefusalText(refusal, actor ? "page" : "terminal"), refusal });

/** A typed reason, refused as reason_missing or reason_too_long. PURE. */
const reasonRefusal = (reason: string | undefined, actor: Actor): Refusal | undefined => {
  const problem = refuseChangeReason(reason);
  return problem ? refuse(problem, actor) : undefined;
};

/**
 * An owner-only change: owner_only for anyone but the owner signed in (the
 * terminal keeps the brief's fixed sentence), other_business for an account
 * from elsewhere. Decided by refuseUnlessOwner.
 *
 * SIDE EFFECT: None beyond reading the account.
 */
const ownerOnly = (actor: Actor, enterpriseId: string, doing: string): Refusal | undefined => {
  if (!refuseUnlessOwner(actor, enterpriseId, doing, "refused")) return undefined;
  return refuse({ code: actor && !actor.roles.has(enterpriseId) ? "other_business" : "owner_only" }, actor);
};

/** The configured provider, by name. SIDE EFFECT: Reads the model settings. */
const providerName = (): string => providerLabel(resolveConfiguredProvider().provider as Parameters<typeof providerLabel>[0]);

const tidy = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
const byOf = (actor: Actor, as?: string) => actor?.workerName ?? (tidy(as) || "the terminal");
const userOf = (actor: Actor) => (actor ? { byUserId: actor.userId } : {});

/** A person of the business by name, as Arturo knows them. SIDE EFFECT: Reads Worker state. */
function personAt(enterpriseId: string, name: string): string | undefined {
  const named = tidy(name).toLowerCase();
  return peopleOf(enterpriseId).find((person) => person.toLowerCase() === named);
}

export type CreateWorkInput = {
  readonly enterpriseId: string;
  readonly name: string;
  readonly kind: string;
  readonly parentWorkId?: string;
  readonly clientId?: string;
  readonly matterNumber?: string;
  readonly matterType?: string;
  readonly noAi?: boolean;
  /** The cancelled work this replaces (any record in its chain; the newest is used). */
  readonly replacesWorkId?: string;
  /** The person declined the link offered for a cancelled book or deal with the same title. */
  readonly separate?: boolean;
  /** Their answer, after declining, to whether to turn "no AI" on. */
  readonly noAiAfterDeclining?: boolean;
  /**
   * The owner's reason for reopening a cancelled locked matter's number as an
   * unlocked type (Grace's only route from locked to unlocked). Without it,
   * that choice comes back as a reopen-unlocked prompt and nothing is written.
   */
  readonly reopenReason?: string;
  readonly actor: Actor;
  readonly as?: string;
  readonly now?: number;
};

export type WorkRefused = Refusal;

/** A question to answer before the work opens. Nothing has been written. */
export type CreateWorkPrompt =
  | { readonly kind: "title-match"; readonly matches: readonly { readonly id: string; readonly name: string; readonly cancelledAt: number; readonly noAi: boolean }[] }
  | { readonly kind: "ask-no-ai"; readonly matched: { readonly id: string; readonly name: string } }
  | {
      /** The owner chose an unlocked type for a cancelled locked matter's number: confirm with a reason. */
      readonly kind: "reopen-unlocked";
      readonly from: { readonly id: string; readonly name: string };
      readonly lockedType: string;
      readonly lockedTypeLabel: string;
      readonly type: string;
      readonly typeLabel: string;
      readonly provider: string;
      /** Grace's confirm line, with the real type and provider, then the link line. */
      readonly lines: readonly string[];
    };

export type CreateWorkOutcome = { readonly work: WorkRecord } | WorkRefused | { readonly prompt: CreateWorkPrompt };

/**
 * Grace's confirm line for reopening a cancelled locked matter's number as an
 * unlocked type, with the real type and provider. PURE: No side effects.
 */
export function reopenUnlockedLine(lockedTypeLabel: string, provider: string): string {
  return `This matter was opened as ${lockedTypeLabel}. Material for it can be sent to ${provider}.`;
}

/** The stored record's claimed link, read without trusting it. SIDE EFFECT: Reads one row. */
function claimedLink(id: string): string | undefined {
  try {
    const claimed = (JSON.parse(loadWorkRecordRow(id) ?? "{}") as { replacesWorkId?: unknown }).replacesWorkId;
    return typeof claimed === "string" ? claimed : undefined;
  } catch {
    return undefined;
  }
}

export type ReplacementCheck =
  | { readonly state: "verified"; readonly named: WorkRecord; readonly newest: WorkRecord }
  | { readonly state: "failed"; readonly from: string; readonly named?: WorkRecord }
  | { readonly refusal: WorkRefusal };

/**
 * The cancelled work a new piece of work replaces (Grace, addendum 1): the
 * chain is followed from the record named to the newest record in it, and
 * the newest record's HMAC is checked again. A missing or unverified record
 * anywhere it matters, a record at another business, or a loop fails the
 * check: the new work then opens with "no AI" on and its type locked. Open
 * work is never replaced.
 *
 * SIDE EFFECT: Reads work records and the signing secret.
 */
export function resolveReplacement(enterpriseId: string, namedId: string): ReplacementCheck {
  const id = tidy(namedId);
  const first = getWork(id);
  if (first.state !== "verified" || first.work.enterpriseId !== enterpriseId) return { state: "failed", from: id };
  const { work: all, unverified } = listWorkFor(enterpriseId);
  let current = first.work;
  const seen = new Set<string>([current.id]);
  for (;;) {
    // A record that doesn't verify may be the newer one, so the chain can't be confirmed.
    if (unverified.some((other) => claimedLink(other) === current.id)) return { state: "failed", from: id, named: first.work };
    const next = all.filter((one) => one.replacesWorkId === current.id).sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!next) break;
    if (seen.has(next.id)) return { state: "failed", from: id, named: first.work };
    seen.add(next.id);
    current = next;
  }
  if (current.cancelledAt === undefined) {
    return current.id === first.work.id
      ? { refusal: { code: "replaces_still_open", values: { name: current.name } } }
      : { refusal: { code: "replaces_already_replaced", values: { name: first.work.name, newer: current.name } } };
  }
  const fresh = getWork(current.id);
  if (fresh.state !== "verified") return { state: "failed", from: id, named: first.work };
  return { state: "verified", named: first.work, newest: fresh.work };
}

/**
 * Cancelled books or deals whose title matches, ignoring capitals and
 * apostrophes, and that nothing has replaced yet. A deal matches only in the
 * same book. Books have no unique number, so this only offers the link.
 *
 * SIDE EFFECT: Reads work records.
 */
export function cancelledTitleMatches(enterpriseId: string, name: string, kind: string, parentWorkId?: string): WorkRecord[] {
  if (kind !== "book" && kind !== "deal") return [];
  const { work } = listWorkFor(enterpriseId);
  const replaced = new Set(work.map((one) => one.replacesWorkId).filter(Boolean));
  const wanted = matchableTitle(name);
  return work.filter((one) => one.cancelledAt !== undefined && one.kind === kind && !replaced.has(one.id)
    && (kind !== "deal" || one.parentWorkId === parentWorkId) && matchableTitle(one.name) === wanted);
}

/**
 * Opens a piece of work. Everything is checked first; on any refusal or
 * question nothing is written.
 *
 * Replacing cancelled work: with replacesWorkId, the newest record in that
 * chain is checked (resolveReplacement), and "no AI" and a locked work type
 * are carried over only if it had them. If the check fails, the work opens
 * with "no AI" on and, for a matter, its type held locked. A matter number
 * held by cancelled work is reused only this way.
 *
 * A book or deal whose title matches a cancelled one is offered the link
 * first (a prompt), never required to take it. Declining it asks straight
 * away whether to turn "no AI" on, when the cancelled one had it on.
 *
 * SIDE EFFECT: Writes one record and one change-log entry.
 */
export function createWork(input: CreateWorkInput): CreateWorkOutcome {
  const refusedWith = (refusal: WorkRefusal) => refuse(refusal, input.actor);
  if (input.as !== undefined && !input.actor && !personAt(input.enterpriseId, input.as)) {
    return refusedWith({ code: "person_unknown", values: { name: tidy(input.as) } });
  }
  const setting = getPracticeSetting(input.enterpriseId);
  const clientId = tidy(input.clientId) || undefined;
  const matterNumber = tidy(input.matterNumber) || undefined;
  let matterType = tidy(input.matterType).toLowerCase() || undefined;
  const parentWorkId = tidy(input.parentWorkId) || undefined;
  const replacement = tidy(input.replacesWorkId) ? resolveReplacement(input.enterpriseId, tidy(input.replacesWorkId)) : undefined;
  if (replacement && "refusal" in replacement) return refusedWith(replacement.refusal);
  const replaces = replacement ? (replacement.state === "verified" ? replacement.newest : replacement.named) : undefined;
  const all = listWorkFor(input.enterpriseId).work;
  const refusal = refuseWorkRecord(
    { enterpriseId: input.enterpriseId, name: input.name, kind: input.kind, parentWorkId, clientId, matterNumber, matterType, ...(replaces ? { replaces } : {}) },
    {
      lookup: getWork,
      lawPractice: setting.lawPractice,
      customMatterTypes: setting.customMatterTypes,
      clientBusiness: (id) => getClientRecord(id)?.enterpriseId,
      matterNumbers: all.filter((work) => work.matterNumber).map((work) => ({ number: work.matterNumber!, id: work.id, name: work.name, cancelled: work.cancelledAt !== undefined, createdAt: work.createdAt, ...(work.cancelledAt !== undefined ? { cancelledAt: work.cancelledAt } : {}) })),
    }
  );
  if (refusal) return refusedWith(refusal);
  let noAi = input.noAi === true;
  if (!replacement) {
    const matches = cancelledTitleMatches(input.enterpriseId, input.name, input.kind, parentWorkId);
    if (matches.length && !input.separate) {
      return { prompt: { kind: "title-match", matches: matches.map((one) => ({ id: one.id, name: one.name, cancelledAt: one.cancelledAt!, noAi: effectiveNoAi(one.id).noAi })) } };
    }
    const hadNoAi = matches.find((one) => effectiveNoAi(one.id).noAi);
    if (hadNoAi && !noAi && input.noAiAfterDeclining === undefined) {
      return { prompt: { kind: "ask-no-ai", matched: { id: hadNoAi.id, name: hadNoAi.name } } };
    }
    if (hadNoAi && input.noAiAfterDeclining === true) noAi = true;
  }
  let carryOver: CarryOver | undefined;
  let typeHeld = false;
  let reopened: { readonly from: string; readonly reason: string } | undefined;
  const now = input.now ?? Date.now();
  if (replacement && replacement.state === "verified") {
    const old = replacement.newest;
    const custom = setting.customMatterTypes;
    const lockedType = old.kind === "matter" && old.matterType && isWorkTypeLocked(old, custom) ? old.matterType : undefined;
    if (old.noAi) noAi = true;
    // The only route from locked to unlocked (Grace's ruling): reopening a
    // cancelled locked matter's number as an unlocked type. The owner only,
    // signed in on the page, with a typed reason, signed and logged with the
    // link to the cancelled record. Any other choice keeps the locked type.
    const wantsUnlocked = lockedType !== undefined && matterType !== undefined && matterType !== lockedType
      && isKnownMatterType(matterType, custom) && !isLockedMatterType(matterType, custom, now);
    if (wantsUnlocked) {
      const owner = ownerOnly(input.actor, input.enterpriseId, "reopen a locked matter's number as an unlocked type");
      if (owner) return owner;
      if (input.reopenReason === undefined) {
        const provider = providerName();
        const lockedTypeLabel = matterTypeLabel(lockedType!, custom);
        return {
          prompt: {
            kind: "reopen-unlocked",
            from: { id: old.id, name: old.name },
            lockedType: lockedType!,
            lockedTypeLabel,
            type: matterType!,
            typeLabel: matterTypeLabel(matterType!, custom),
            provider,
            lines: [reopenUnlockedLine(lockedTypeLabel, provider), `It is signed and logged with a link to ${old.name}.`],
          },
        };
      }
      const reasonProblem = reasonRefusal(input.reopenReason, input.actor);
      if (reasonProblem) return reasonProblem;
      reopened = { from: lockedType!, reason: tidy(input.reopenReason) };
    } else {
      if (lockedType) matterType = lockedType;
      if (old.typeHeld) typeHeld = true;
    }
    carryOver = { from: old.id, checked: true, noAi: old.noAi, ...(lockedType ? { lockedType } : {}), ...(reopened ? { reopenedAs: matterType! } : {}) };
  } else if (replacement) {
    noAi = true;
    typeHeld = input.kind === "matter";
    carryOver = { from: replacement.from, checked: false, noAi: true };
  }
  const by = input.actor?.workerName ?? (input.as !== undefined ? personAt(input.enterpriseId, input.as)! : "the terminal");
  let work: WorkRecord;
  try {
    work = insertSignedWork({
      id: newWorkId(),
      enterpriseId: input.enterpriseId,
      name: tidy(input.name),
      kind: input.kind as WorkRecord["kind"],
      ...(parentWorkId ? { parentWorkId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(matterNumber ? { matterNumber } : {}),
      ...(matterType ? { matterType } : {}),
      noAi,
      paidEscalationAllowed: false,
      version: 1,
      createdAt: now,
      createdBy: by,
      ...(carryOver ? { replacesWorkId: carryOver.from, carryOver } : {}),
      ...(typeHeld ? { typeHeld: true as const } : {}),
    });
  } catch (error) {
    // The database's own check: another opening took the number first.
    if (matterNumber && /UNIQUE/i.test(String((error as Error)?.message))) {
      return refusedWith({ code: "matter_number_in_use", values: { number: matterNumber, name: "other open work" } });
    }
    throw error;
  }
  logWorkChange({
    enterpriseId: work.enterpriseId,
    workId: work.id,
    what: `opened ${work.kind} "${work.name}"${matterType ? `, type ${matterType}` : ""}${matterNumber ? `, number ${matterNumber}` : ""}${work.noAi ? ', with "no AI" on' : ""}${carryOver ? `, replacing ${carryOver.from}${carryOver.checked ? "" : " (its record could not be confirmed)"}` : ""}${reopened ? `, reopened as an unlocked type (it was ${reopened.from})` : ""}`,
    by,
    ...userOf(input.actor),
    ...(reopened ? { reason: reopened.reason } : {}),
    at: now,
  });
  return { work };
}

/** Work at the business by id, verified. PURE apart from the read. */
function verifiedWork(workId: string, actor?: Actor): WorkRecord | Refusal {
  const standing = getWork(tidy(workId));
  if (standing.state === "missing") return refuse({ code: "work_not_found", values: { id: tidy(workId) } }, actor);
  if (standing.state === "unverified") return refuse({ code: "unverified_work" }, actor);
  return standing.work;
}

/** Work that may still be changed: verified and not cancelled. PURE apart from the read. */
function changeableWork(workId: string, actor?: Actor): WorkRecord | Refusal {
  const work = verifiedWork(workId, actor);
  if ("refused" in work) return work;
  if (work.cancelledAt !== undefined) return refuse({ code: "work_cancelled", values: { name: work.name, kind: work.kind } }, actor);
  return work;
}

/** The Tasks on this work or on any deal within it, by status. SIDE EFFECT: Reads Tasks and work records. */
function tasksUnder(workId: string): { readonly cancellable: string[]; readonly running: string[]; readonly workIds: string[] } {
  const workIds = new Set<string>([workId]);
  const cancellable: string[] = [];
  const running: string[] = [];
  for (const job of listJobs()) {
    if (!job.workId) continue;
    const resolved = resolveWorkChain(job.workId);
    const under = job.workId === workId || ("chain" in resolved && resolved.chain.some((work) => work.id === workId));
    if (!under) continue;
    workIds.add(job.workId);
    if (CANCELLABLE_JOB_STATUSES.includes(job.status)) cancellable.push(job.id);
    else if (job.status === "running") running.push(job.id);
  }
  for (const standing of listWorkUnder(workId)) workIds.add(standing);
  return { cancellable, running, workIds: [...workIds] };
}

/** Ids of the deals whose chain reaches this work. SIDE EFFECT: Reads work records. */
function listWorkUnder(workId: string): string[] {
  const standing = getWork(workId);
  if (standing.state !== "verified") return [];
  return listWorkFor(standing.work.enterpriseId).work
    .filter((work) => work.id !== workId)
    .filter((work) => {
      const resolved = resolveWorkChain(work.id);
      return "chain" in resolved && resolved.chain.some((one) => one.id === workId);
    })
    .map((work) => work.id);
}

export type NoAiEffects = {
  /** Tasks that have not started: cancelled when "no AI" goes on. */
  readonly cancellable: string[];
  /** Tasks running now: not stopped; their results are set aside when they finish. */
  readonly running: string[];
  /** What was sent to an AI worker for this work and its deals, each entry checked. */
  readonly sent: WorkSend[];
};

/**
 * What turning "no AI" on would do, for the confirm sheet. Writes nothing.
 *
 * SIDE EFFECT: Reads Tasks, work records and the send log.
 */
export function describeNoAiEffects(workId: string): NoAiEffects {
  const under = tasksUnder(workId);
  return { cancellable: under.cancellable, running: under.running, sent: listWorkSends(under.workIds).sends };
}

/** The confirm sheet's fixed wording (Mia). PURE: No side effects. */
export const NO_AI_CONFIRM_LINES = [
  "Nothing more will be sent to an AI worker.",
  "Material already sent can't be recalled.",
  "Work already running is not stopped by this.",
] as const;

/**
 * The one line the confirm sheet for turning "no AI" off states (Grace,
 * addendum 1), naming the provider configured now.
 *
 * SIDE EFFECT: Reads the model settings.
 */
export function noAiOffConfirmLine(): string {
  const { provider } = resolveConfiguredProvider();
  return `Material for this matter can be sent to ${providerLabel(provider as Parameters<typeof providerLabel>[0])} again.`;
}

/**
 * Who may turn "no AI" on, or tighten a matter's type: anyone working on the
 * matter. Arturo has no record of who works on which matter, so the closest
 * rule it can enforce is used: any registered person at that business whose
 * access is not suspended, signed in on the page (the actor) or named with
 * --as at the terminal. Returns the name the change is recorded under.
 *
 * SIDE EFFECT: Reads identity and Worker state.
 */
function personAtBusiness(enterpriseId: string, actor: Actor, as: string | undefined): { readonly by: string } | Refusal {
  if (actor) return actor.roles.get(enterpriseId) === undefined ? refuse({ code: "other_business" }, actor) : { by: actor.workerName };
  if (as === undefined || !tidy(as)) return refuse({ code: "as_required", values: { who: "Anyone working at this business" } }, actor);
  const person = listPeople(enterpriseId).find((one) => one.name.toLowerCase() === tidy(as).toLowerCase());
  if (!person) return refuse({ code: "not_at_business", values: { name: tidy(as) } }, actor);
  if (person.status === "suspended") return refuse({ code: "person_suspended", values: { name: person.name } }, actor);
  return { by: person.name };
}

/**
 * Turns "no AI" on or off for one piece of work.
 *
 * On: anyone working at the business (personAtBusiness), at the terminal too,
 * with no reason needed. Every Task on this work or its deals that has not
 * started is cancelled; running ones are listed, and their results are set
 * aside when they finish.
 * Off: only the owner, signed in on the company page, with a typed reason
 * that is signed into the change-log entry. It reverses a client's opt-out;
 * the reason is a record of why, not proof of consent.
 *
 * SIDE EFFECT: May change one record, cancel Tasks and append to the change log.
 */
export function setWorkNoAi(input: { readonly workId: string; readonly noAi: boolean; readonly actor: Actor; readonly as?: string; readonly reason?: string; readonly now?: number }):
  | { readonly message: string; readonly cancelled: string[]; readonly willBeSetAside: string[]; readonly sent: WorkSend[] }
  | Refusal {
  const work = changeableWork(input.workId, input.actor);
  if ("refused" in work) return work;
  if (input.noAi) {
    const who = personAtBusiness(work.enterpriseId, input.actor, input.as);
    if ("refused" in who) return who;
  } else {
    const refusal = ownerOnly(input.actor, work.enterpriseId, 'turn "no AI" off');
    if (refusal) return refusal;
    const reasonProblem = reasonRefusal(input.reason, input.actor);
    if (reasonProblem) return reasonProblem;
  }
  if (work.noAi === input.noAi) return refuse({ code: "no_ai_unchanged", values: { state: input.noAi ? "on" : "off", name: work.name } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor, input.as !== undefined ? personAt(work.enterpriseId, input.as) : undefined);
  const before = input.noAi ? describeNoAiEffects(work.id) : { cancellable: [], running: [], sent: [] };
  const changed = replaceSignedWork(work, { noAi: input.noAi }, by, now);
  logWorkChange({ enterpriseId: work.enterpriseId, workId: work.id, what: input.noAi ? 'turned "no AI" on' : 'turned "no AI" off', by, ...userOf(input.actor), ...(input.noAi ? {} : { reason: tidy(input.reason) }), at: now });
  const cancelled: string[] = [];
  for (const id of before.cancellable) {
    try {
      cancelJob(id, `Cancelled: "no AI" was turned on for ${changed.name} by ${by}.`);
      cancelled.push(id);
    } catch {
      // Started in the meantime: its result is set aside when it finishes.
    }
  }
  if (!input.noAi) {
    return { message: `"No AI" is off for ${changed.name}. ${noAiOffConfirmLine()} Nothing is sent until someone asks for work on it.`, cancelled, willBeSetAside: [], sent: [] };
  }
  return {
    message: [
      `"No AI" is on for ${changed.name}.`,
      ...NO_AI_CONFIRM_LINES,
      cancelled.length ? `Cancelled before they started: ${cancelled.join(", ")}.` : "No waiting work needed cancelling.",
      ...(before.running.length ? [`Running now, and set aside when it finishes: ${before.running.join(", ")}.`] : []),
    ].join("\n"),
    cancelled,
    willBeSetAside: before.running,
    sent: before.sent,
  };
}

/**
 * Who can sign off work at this business, for a change only they may make:
 * on the page the signed-in account, at the terminal the person named with
 * --as. Returns the name the change is recorded under.
 *
 * SIDE EFFECT: Reads identity and Worker state.
 */
function signerAt(work: WorkRecord, actor: Actor, as: string | undefined, notSigner: WorkRefusal): { readonly by: string } | Refusal {
  if (actor) {
    if (!actor.roles.has(work.enterpriseId)) return refuse({ code: "other_business" }, actor);
    return maySignOff(work.enterpriseId, actor.workerName) ? { by: actor.workerName } : refuse(notSigner, actor);
  }
  if (!tidy(as)) return refuse({ code: "as_required", values: { who: "Only someone who can sign off work" } }, actor);
  const person = peopleOf(work.enterpriseId).find((one) => one.toLowerCase() === tidy(as).toLowerCase());
  if (!person) return refuse({ code: "person_unknown", values: { name: tidy(as) } }, actor);
  return maySignOff(work.enterpriseId, person) ? { by: person } : refuse(notSigner, actor);
}

export type MatterTypeChanged = {
  readonly message: string;
  /** Which rule applied, decided here from the fixed lists, never by the menu. */
  readonly rule: "signer" | "anyone" | "owner";
  /** Tasks not started, cancelled now: nothing ticked under the old type is sent. */
  readonly cancelled: string[];
  /** Tasks running now: their results are set aside by Arturo when they finish. */
  readonly willBeSetAside: string[];
  /** The suggestion list rebuilt for the new type (none for a locked type). */
  readonly precedents: readonly string[];
  /** False when a tightening reason couldn't be kept: the lock stands, logged as "No reason given". */
  readonly reasonSaved: boolean;
};

/**
 * Changes a matter's type. This function, not the menu, decides which rule
 * applies (typeChangeRule), from the matter's type as it was opened and the
 * new one, against the fixed lists of locked and unlocked types, before
 * anything is re-signed. The page, the terminal and any other caller are
 * refused the same way:
 *
 *   - locked to unlocked: refused (type_locked_to_unlocked). The only route
 *     is cancelling and reopening the number (createWork, owner only);
 *   - locked to locked: anyone who can sign off, with a reason;
 *   - unlocked to locked: anyone working at the business. The reason is
 *     optional and never holds up the lock: without one, or if it can't be
 *     kept, the entry is signed with "No reason given", and a reason added
 *     later goes in its own signed entry (addTypeChangeReason);
 *   - unlocked to unlocked: the owner only, signed in, with a reason;
 *   - a type held after a failed carry-over check is released by the owner
 *     only, with a reason, as before.
 *
 * Every change records typeChangedAt on the signed record. From then on a
 * sign-off given before it falls away (resultSignOff.ts), a Task created
 * before it is cancelled if not started, a running one is set aside by the
 * system actor when it finishes and makes no further model call
 * (workLocks.ts), and the suggestion list is the new type's. Nothing is sent
 * again automatically.
 *
 * SIDE EFFECT: May change one record, append to the change log and cancel Tasks.
 */
export function changeMatterType(input: { readonly workId: string; readonly matterType: string; readonly reason?: string; readonly actor: Actor; readonly as?: string; readonly now?: number }): MatterTypeChanged | Refusal {
  const actor = input.actor;
  const work = changeableWork(input.workId, actor);
  if ("refused" in work) return work;
  if (work.kind !== "matter") return refuse({ code: "not_a_matter" }, actor);
  const custom = getPracticeSetting(work.enterpriseId).customMatterTypes;
  const type = tidy(input.matterType).toLowerCase();
  if (!isKnownMatterType(type, custom)) {
    return refuse({ code: "matter_type_unknown", values: { types: [...BUILT_IN_MATTER_TYPES, ...custom.map((one) => one.id)].join(", ") } }, actor);
  }
  const fromLocked = isWorkTypeLocked(work, custom);
  const toLocked = isLockedMatterType(type, custom, work.createdAt);
  const decided = typeChangeRule(fromLocked, toLocked);
  // A held type stands for a record Arturo couldn't confirm: only the owner
  // chooses its type, with a reason, even the same one.
  const rule = work.typeHeld ? "owner" : decided;
  if (rule === "refused") {
    return refuse({ code: "type_locked_to_unlocked", values: { type: matterTypeLabel(work.matterType ?? "", custom) } }, actor);
  }
  if (type === work.matterType && !work.typeHeld) {
    return refuse({ code: "type_unchanged", values: { name: work.name, type: matterTypeLabel(type, custom).toLowerCase() } }, actor);
  }
  let by: string;
  let reason: string;
  let reasonSaved = true;
  if (rule === "owner") {
    const owner = ownerOnly(actor, work.enterpriseId, "change a matter's type");
    if (owner) return owner;
    const reasonProblem = reasonRefusal(input.reason, actor);
    if (reasonProblem) return reasonProblem;
    by = byOf(actor);
    reason = tidy(input.reason);
  } else if (rule === "signer") {
    const who = signerAt(work, actor, input.as, { code: "type_change_not_signer" });
    if ("refused" in who) return who;
    const reasonProblem = reasonRefusal(input.reason, actor);
    if (reasonProblem) return reasonProblem;
    by = who.by;
    reason = tidy(input.reason);
  } else {
    const who = personAtBusiness(work.enterpriseId, actor, input.as);
    if ("refused" in who) return who;
    by = who.by;
    // The reason never holds up the lock (Grace).
    const given = tidy(input.reason);
    reasonSaved = refuseChangeReason(given)?.code !== "reason_too_long";
    reason = given && reasonSaved ? given : NO_REASON_GIVEN;
  }
  const now = input.now ?? Date.now();
  const before = tasksUnder(work.id);
  const changed = replaceSignedWork(work, { matterType: type, typeHeld: undefined, typeChangedAt: now }, by, now);
  logWorkChange({
    enterpriseId: work.enterpriseId,
    workId: work.id,
    what: `work type changed from ${work.matterType ?? "none"} to ${type}${work.typeHeld ? ", releasing the held type" : ""}`,
    by,
    ...userOf(actor),
    reason,
    at: now,
  });
  const cancelled: string[] = [];
  for (const id of before.cancellable) {
    try {
      cancelJob(id, `Cancelled: the work type of ${changed.name} was changed by ${by}. Nothing ticked before is sent again until someone asks.`);
      cancelled.push(id);
    } catch {
      // Started in the meantime: its result is set aside when it finishes.
    }
  }
  const label = matterTypeLabel(type, custom);
  return {
    message: [
      `${changed.name} is now ${label.toLowerCase()}${toLocked ? ", which never goes to an AI worker" : ""}.`,
      "Any sign-off on this matter falls away, and any running result is set aside. Nothing ticked before is sent again until someone ticks it.",
      ...(cancelled.length ? [`Cancelled before they started: ${cancelled.join(", ")}.`] : []),
      ...(before.running.length ? [`Running now, and set aside by Arturo when it finishes: ${before.running.join(", ")}.`] : []),
      ...(reasonSaved ? [] : ["Locked. The reason couldn't be saved. You can add it to the log."]),
    ].join("\n"),
    rule,
    cancelled,
    willBeSetAside: before.running,
    precedents: suggestedPrecedents(changed, custom),
    reasonSaved,
  };
}

/**
 * Adds a reason to a matter's last type change, in its own signed entry,
 * never beside the entry already signed (Grace: "A reason added after the
 * lock is signed goes in its own signed entry"). Anyone working at the
 * business may add one, as anyone may tighten.
 *
 * SIDE EFFECT: May append to the change log.
 */
export function addTypeChangeReason(input: { readonly workId: string; readonly reason: string; readonly actor: Actor; readonly as?: string; readonly now?: number }): { readonly message: string } | Refusal {
  const actor = input.actor;
  const work = verifiedWork(input.workId, actor);
  if ("refused" in work) return work;
  if (work.kind !== "matter") return refuse({ code: "not_a_matter" }, actor);
  const who = personAtBusiness(work.enterpriseId, actor, input.as);
  if ("refused" in who) return who;
  const reasonProblem = reasonRefusal(input.reason, actor);
  if (reasonProblem) return reasonProblem;
  const last = listWorkChanges(work.enterpriseId, work.id).filter((entry) => entry.what.startsWith("matter type changed from ") || entry.what.startsWith("work type changed from ")).at(-1);
  if (!last) return refuse({ code: "type_unchanged", values: { name: work.name, type: matterTypeLabel(work.matterType ?? "", getPracticeSetting(work.enterpriseId).customMatterTypes).toLowerCase() } }, actor);
  const now = input.now ?? Date.now();
  logWorkChange({ enterpriseId: work.enterpriseId, workId: work.id, what: `reason added for the work type change at ${last.at}`, by: who.by, ...userOf(actor), reason: tidy(input.reason), at: now });
  return { message: `The reason was added to the log for ${work.name}, in its own signed entry.` };
}

/**
 * Allows paid escalation to a second provider for one piece of work, or stops
 * allowing it. Stored now and enforced in step 3. Switching it on is the
 * owner's alone, on the company page; switching it off is the safe direction.
 *
 * SIDE EFFECT: May change one record and append to the change log.
 */
export function allowPaidEscalation(input: { readonly workId: string; readonly allowed: boolean; readonly actor: Actor; readonly reason?: string; readonly now?: number }): { readonly message: string } | Refusal {
  const work = changeableWork(input.workId, input.actor);
  if ("refused" in work) return work;
  if (input.allowed) {
    const refusal = ownerOnly(input.actor, work.enterpriseId, "switch on paid escalation");
    if (refusal) return refusal;
    const reasonProblem = reasonRefusal(input.reason, input.actor);
    if (reasonProblem) return reasonProblem;
  } else if (input.actor && !input.actor.roles.has(work.enterpriseId)) {
    return refuse({ code: "other_business" }, input.actor);
  }
  if (work.paidEscalationAllowed === input.allowed) return refuse({ code: "escalation_unchanged", values: { state: input.allowed ? "on" : "off", name: work.name } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor);
  replaceSignedWork(work, { paidEscalationAllowed: input.allowed }, by, now);
  logWorkChange({ enterpriseId: work.enterpriseId, workId: work.id, what: input.allowed ? "paid escalation switched on" : "paid escalation switched off", by, ...userOf(input.actor), ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}), at: now });
  return { message: `Paid escalation is ${input.allowed ? "on" : "off"} for ${work.name}.` };
}

/** The business's setting as it stands, ready to change, or why it cannot be. SIDE EFFECT: Reads the setting. */
function settingToChange(enterpriseId: string, actor: Actor) {
  const standing = getPracticeSetting(enterpriseId);
  if (standing.state === "unverified") return refuse({ code: "practice_unverified" }, actor);
  return standing;
}

/**
 * Turns the law-practice setting on or off. Only the owner, signed in on the
 * company page; turning it on needs sign-in on, and turning it off a typed
 * reason. Matters already locked stay locked: the type is signed on each.
 *
 * SIDE EFFECT: May write the setting and append to the change log.
 */
export function setLawPractice(input: { readonly enterpriseId: string; readonly on: boolean; readonly reason?: string; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = ownerOnly(input.actor, input.enterpriseId, "change the law-practice setting");
  if (refusal) return refusal;
  if (input.on && !signInOn(input.enterpriseId)) return refuse({ code: "sign_in_off" }, input.actor);
  if (!input.on) {
    const reasonProblem = reasonRefusal(input.reason, input.actor);
    if (reasonProblem) return reasonProblem;
  }
  const standing = settingToChange(input.enterpriseId, input.actor);
  if ("refused" in standing) return standing;
  if (standing.lawPractice === input.on) return refuse({ code: "practice_unchanged", values: { state: input.on ? "on" : "off" } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor);
  saveSignedPracticeSetting({
    enterpriseId: input.enterpriseId,
    lawPractice: input.on,
    // Turning a law practice on also switches the typed-work setting on.
    // Turning the law-practice setting off must not loosen it.
    typedWorkRequired: input.on ? true : standing.typedWorkRequired,
    customMatterTypes: standing.customMatterTypes,
    version: (standing.setting?.version ?? 0) + 1,
    changedBy: by,
    ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
    at: now,
    ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}),
  });
  logWorkChange({ enterpriseId: input.enterpriseId, what: input.on ? "law-practice setting turned on" : "law-practice setting turned off", by, ...userOf(input.actor), ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}), at: now });
  return {
    message: input.on
      ? "This business is now a law practice: every matter needs a matter number and a work type, and will, court, dispute and the other locked types never go to an AI worker."
      : "The law-practice setting is off. Matters already of a locked type stay locked, and each affected matter says the setting is off.",
  };
}

/**
 * Turns the general setting "AI work must belong to a typed piece of work"
 * on or off. Tightening (on) takes effect at once, owner-only. Switching it
 * off is an owner-only loosening step and stays refused until a terminal
 * route is designed (Grace).
 *
 * SIDE EFFECT: May write the setting and append to the change log.
 */
export function setTypedWorkRequired(input: { readonly enterpriseId: string; readonly on: boolean; readonly reason?: string; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = ownerOnly(input.actor, input.enterpriseId, "change whether AI work must belong to a typed piece of work");
  if (refusal) return refusal;
  if (!input.on) return refuse({ code: "typed_work_off_not_available" }, input.actor);
  if (!signInOn(input.enterpriseId)) return refuse({ code: "sign_in_off" }, input.actor);
  const standing = settingToChange(input.enterpriseId, input.actor);
  if ("refused" in standing) return standing;
  if (standing.typedWorkRequired === true) return refuse({ code: "typed_work_unchanged", values: { state: "on" } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor);
  saveSignedPracticeSetting({
    enterpriseId: input.enterpriseId,
    lawPractice: standing.lawPractice,
    typedWorkRequired: true,
    customMatterTypes: standing.customMatterTypes,
    version: (standing.setting?.version ?? 0) + 1,
    changedBy: by,
    ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
    at: now,
    ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}),
  });
  logWorkChange({ enterpriseId: input.enterpriseId, what: "AI work must belong to a typed piece of work: turned on", by, ...userOf(input.actor), ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}), at: now });
  return { message: "AI work must belong to a typed piece of work at this business. The setting is on." };
}

/**
 * Adds a work type. A new type starts locked until the owner unlocks it.
 * There is no unlocked "Other".
 *
 * SIDE EFFECT: May write the setting and append to the change log.
 */
export function addMatterType(input: { readonly enterpriseId: string; readonly id: string; readonly label: string; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  const refusal = ownerOnly(input.actor, input.enterpriseId, "add a work type");
  if (refusal) return refusal;
  const id = tidy(input.id).toLowerCase();
  const label = tidy(input.label);
  if (id === "other") return refuse({ code: "type_other" }, input.actor);
  if (!MATTER_TYPE_ID_PATTERN.test(id)) return refuse({ code: "type_id_pattern" }, input.actor);
  if (!label || label.length > 80) return refuse({ code: "type_label" }, input.actor);
  const standing = settingToChange(input.enterpriseId, input.actor);
  if ("refused" in standing) return standing;
  if (isBuiltInMatterType(id) || standing.customMatterTypes.some((one) => one.id === id)) return refuse({ code: "type_exists", values: { id } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor);
  saveSignedPracticeSetting({
    enterpriseId: input.enterpriseId,
    lawPractice: standing.lawPractice,
    typedWorkRequired: standing.typedWorkRequired,
    customMatterTypes: [...standing.customMatterTypes, { id, label, locked: true }],
    version: (standing.setting?.version ?? 0) + 1,
    changedBy: by,
    ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
    at: now,
  });
  logWorkChange({ enterpriseId: input.enterpriseId, what: `work type ${id} ("${label}") added, locked`, by, ...userOf(input.actor), at: now });
  return { message: `Added ${label}. It is locked: nothing on it goes to an AI worker until you unlock it.` };
}

/**
 * Unlocks a work type the owner added, with a typed reason. The fixed locked
 * types (will, court, dispute and the others) have no off switch.
 *
 * The unlock applies only to matters opened afterwards (Grace's ruling): the
 * time is signed into the setting (unlockedAt), and a matter opened before it
 * stays locked (isLockedMatterType with the matter's createdAt), so no
 * existing locked matter ever becomes unlocked. An added type marked unlocked
 * with no recorded time is read as locked for every matter, and may be
 * unlocked again to record one.
 *
 * SIDE EFFECT: May write the setting and append to the change log.
 */
export function unlockMatterType(input: { readonly enterpriseId: string; readonly id: string; readonly reason: string; readonly actor: Actor; readonly now?: number }): { readonly message: string } | Refusal {
  // Only a type the owner added can be unlocked. The six built-in locked
  // types have no off switch in v1, so they are refused first, the same way
  // for everyone, at the terminal and on the page, before anything is read
  // or written.
  const id = tidy(input.id).toLowerCase();
  if (isFixedLockedMatterType(id)) return refuse({ code: "type_no_off_switch", values: { type: matterTypeLabel(id) } }, input.actor);
  if (id === "other") return refuse({ code: "type_other" }, input.actor);
  const refusal = ownerOnly(input.actor, input.enterpriseId, "unlock a work type");
  if (refusal) return refusal;
  const reasonProblem = reasonRefusal(input.reason, input.actor);
  if (reasonProblem) return reasonProblem;
  const standing = settingToChange(input.enterpriseId, input.actor);
  if ("refused" in standing) return standing;
  const type = standing.customMatterTypes.find((one) => one.id === id);
  if (!type) return refuse({ code: "type_not_added", values: { id } }, input.actor);
  if (!type.locked && type.unlockedAt !== undefined) return refuse({ code: "type_already_unlocked", values: { type: type.label } }, input.actor);
  const now = input.now ?? Date.now();
  const by = byOf(input.actor);
  saveSignedPracticeSetting({
    enterpriseId: input.enterpriseId,
    lawPractice: standing.lawPractice,
    typedWorkRequired: standing.typedWorkRequired,
    customMatterTypes: standing.customMatterTypes.map((one) => (one.id === id ? { ...one, locked: false, unlockedAt: now } : one)),
    version: (standing.setting?.version ?? 0) + 1,
    changedBy: by,
    ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
    at: now,
    reason: tidy(input.reason),
  });
  logWorkChange({ enterpriseId: input.enterpriseId, what: `work type ${id} unlocked`, by, ...userOf(input.actor), reason: tidy(input.reason), at: now });
  return { message: `${type.label} is unlocked. Matters opened from now on as ${type.label} may go to an AI worker when someone asks and gives the go-ahead. Matters already open as ${type.label} stay locked.` };
}

/** A deal of a book, as the cancel sheet lists it. */
export type CancelDeal = { readonly id: string; readonly name: string; readonly state: "cancelled" | "no-ai" | "allowed"; readonly running: boolean };

export type CancelEffects = {
  readonly work: WorkRecord;
  /** What this cancels: the work, then each deal of a book not cancelled already. */
  readonly items: readonly WorkRecord[];
  /** A book's deals, by name, with their state in words. */
  readonly deals: readonly CancelDeal[];
  /** Tasks not started: cancelled. */
  readonly cancellable: readonly string[];
  /** Tasks running: their results are set aside by Arturo when they finish. */
  readonly running: readonly string[];
  readonly runningDeals: number;
  /** New work replacing it starts with "no AI" on, because this has it on. */
  readonly carriesNoAi: boolean;
  /** New work replacing it keeps this locked type. */
  readonly carriesLockedType?: string;
  /** This matter's locked type, by label, for the cancel sheet's "never goes to an AI worker" line. */
  readonly lockedTypeLabel?: string;
};

/**
 * What cancelling would do, for the confirm sheet. Writes nothing.
 *
 * SIDE EFFECT: Reads work records and Tasks.
 */
export function describeCancelEffects(workId: string): CancelEffects | Refusal {
  const work = verifiedWork(workId);
  if ("refused" in work) return work;
  if (work.cancelledAt !== undefined) return refuse({ code: "already_cancelled", values: { name: work.name } });
  const custom = getPracticeSetting(work.enterpriseId).customMatterTypes;
  const under = work.kind === "book"
    ? listWorkUnder(work.id).map((id) => getWork(id)).flatMap((standing) => (standing.state === "verified" ? [standing.work] : []))
    : [];
  const tasks = tasksUnder(work.id);
  const runningOn = (id: string) => listJobs().some((job) => job.workId === id && job.status === "running");
  const deals: CancelDeal[] = under.map((deal) => ({
    id: deal.id,
    name: deal.name,
    state: deal.cancelledAt !== undefined ? "cancelled" : effectiveNoAi(deal.id).noAi ? "no-ai" : "allowed",
    running: deal.cancelledAt === undefined && runningOn(deal.id),
  }));
  const lockedType = work.kind === "matter" && work.matterType && isWorkTypeLocked(work, custom) ? work.matterType : undefined;
  return {
    work,
    items: [work, ...under.filter((deal) => deal.cancelledAt === undefined)],
    deals,
    cancellable: tasks.cancellable,
    running: tasks.running,
    runningDeals: deals.filter((deal) => deal.running).length,
    carriesNoAi: work.noAi,
    ...(lockedType ? { carriesLockedType: matterTypeLabel(lockedType, custom) } : {}),
    lockedTypeLabel: work.kind === "matter" && isWorkTypeLocked(work, custom) && work.matterType ? matterTypeLabel(work.matterType, custom) : undefined,
  };
}

/**
 * Who may cancel: only someone who can sign off work at this business, the
 * same rule as stopping a route (Grace, addendum 1, Correction 2). On the
 * page that is the signed-in account; at the terminal, the person named with
 * --as.
 *
 * SIDE EFFECT: Reads identity and Worker state.
 */
function cancellerOf(work: WorkRecord, actor: Actor, as: string | undefined): { readonly by: string } | Refusal {
  return signerAt(work, actor, as, { code: "cancel_not_signer", values: { kind: work.kind } });
}

/**
 * Cancels a piece of work, for good (Grace, addendum 1). Only someone who can
 * sign off, with a typed reason signed into the log entry with their account
 * and the time. Nothing is deleted, and it can't be reopened.
 *
 *   - Tasks not started are cancelled. A running one is not stopped: its
 *     result is set aside by Arturo when it finishes (workerRuntime.ts, the
 *     finish check in refuseWorkUnderLocks).
 *   - Cancelling a book cancels its deals, within MAX_WORK_DEPTH, each with
 *     its own signed log entry under the same reason. Cancelling one deal
 *     leaves its book open.
 *   - From then on nothing starts on it and no go-ahead or sign-off is given
 *     on it (refuseWorkUnderLocks), and no deal opens under a cancelled book.
 *
 * Everything is checked before the first write.
 *
 * SIDE EFFECT: Changes records, appends to the change log and cancels Tasks.
 */
export function cancelWork(input: { readonly workId: string; readonly reason: string; readonly actor: Actor; readonly as?: string; readonly now?: number }):
  | { readonly message: string; readonly cancelledWork: string[]; readonly cancelled: string[]; readonly willBeSetAside: string[] }
  | Refusal {
  const effects = describeCancelEffects(input.workId);
  if ("refused" in effects) return input.actor ? refuse(effects.refusal, input.actor) : effects;
  const work = effects.work;
  const who = cancellerOf(work, input.actor, input.as);
  if ("refused" in who) return who;
  const reasonProblem = reasonRefusal(input.reason, input.actor);
  if (reasonProblem) return reasonProblem;
  const now = input.now ?? Date.now();
  const reason = tidy(input.reason);
  for (const item of effects.items) {
    replaceSignedWork(item, { cancelledAt: now, cancelledBy: who.by, ...(input.actor ? { cancelledByUserId: input.actor.userId } : {}), cancelReason: reason }, who.by, now);
    logWorkChange({
      enterpriseId: item.enterpriseId,
      workId: item.id,
      what: item.id === work.id ? `cancelled ${item.kind} "${item.name}"` : `cancelled deal "${item.name}", with its book "${work.name}"`,
      by: who.by,
      ...userOf(input.actor),
      reason,
      at: now,
    });
  }
  const cancelled: string[] = [];
  for (const id of effects.cancellable) {
    try {
      cancelJob(id, `Cancelled: ${work.name} was cancelled by ${who.by}.`);
      cancelled.push(id);
    } catch {
      // Started in the meantime: its result is set aside when it finishes.
    }
  }
  const deals = effects.items.length - 1;
  return {
    message: [
      `Cancelled ${work.name}${deals ? ` and its ${deals} deal${deals === 1 ? "" : "s"}` : ""}. Nothing new can start on it, and nothing was deleted.`,
      cancelled.length ? `Cancelled before they started: ${cancelled.join(", ")}.` : "Nothing was waiting to start.",
      ...(effects.running.length ? [`Running now, and set aside by Arturo when it finishes: ${effects.running.join(", ")}.`] : []),
    ].join("\n"),
    cancelledWork: effects.items.map((item) => item.id),
    cancelled,
    willBeSetAside: [...effects.running],
  };
}
