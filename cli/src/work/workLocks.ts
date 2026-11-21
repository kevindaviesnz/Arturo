/**
 * The locks on named work, checked in code wherever work can reach an AI
 * worker: when a Task is created, when it starts, before each model call,
 * when it finishes and at sign-off. Each check reads the signed records again;
 * nothing is copied onto the Task except the work's id.
 *
 * Also the rule for when a law practice's Task must belong to a matter
 * (Grace, addendum 1): a client named with --client, any document attached, a
 * precedent draft or a checker, a --follows source that belongs to work (the
 * new Task inherits it), or an instruction that names a listed client. A Task
 * that names a client with any work under "no AI" is refused outright, at any
 * business. Client details pasted without the client's name are not caught.
 *
 * SIDE EFFECT: Reads the runtime database and the signing secret.
 */

import { clientsNamedInText, type ClientRecord } from "../clients/clientRecords";
import { getClientRecord, listClientRecords } from "../clients/clientStore";
import { listPeople } from "../identity/companySignIn";
import { getPracticeSetting } from "./practiceSetting";
import { isLockedMatterType, LAW_PRACTICE_MATTER_ONLY, matterTypeLabel, type WorkRecord } from "./workRecord";
import { effectiveNoAi, listWorkFor, resolveWorkChain } from "./workStore";

export type LockCheckPoint = "create" | "start" | "send" | "finish" | "signoff";

/** A Task Arturo itself creates for drafting (step 3 onwards), never typed. */
export type DraftKind = "precedent-draft" | "checker";

/**
 * Why nothing on this work may go to an AI worker now, or undefined. In
 * order: a chain that fails closed, another business, cancelled work (or a
 * cancelled book), a type held after a failed carry-over check, a locked
 * matter type, a law practice's matter with no number, then "no AI" on the
 * work or its book.
 *
 * SIDE EFFECT: Reads work records and the practice setting.
 */
export function refuseWorkUnderLocks(input: {
  readonly workId?: string;
  readonly enterpriseId?: string;
  readonly when: LockCheckPoint;
  /**
   * When the Task was created. At start, before each model call and at
   * finish, a Task created before its matter's type changed doesn't go on:
   * not started, it is cancelled; running, it makes no further call and its
   * result is set aside by Arturo (Grace: a type change sets aside any
   * running result, and nothing ticked under the old type is re-sent).
   */
  readonly taskCreatedAt?: number;
}): string | undefined {
  if (!input.workId) return undefined;
  const resolved = resolveWorkChain(input.workId);
  if ("failClosed" in resolved) return resolved.failClosed;
  const work = resolved.chain[0];
  if (input.enterpriseId && work.enterpriseId !== input.enterpriseId) return `${input.workId} is not work of this business.`;
  // Cancelled work, or a deal in a cancelled book: nothing starts on it, and
  // no go-ahead or sign-off is given on it (Grace, addendum 1).
  const cancelled = resolved.chain.find((one) => one.cancelledAt !== undefined);
  if (cancelled) {
    return cancelled.id === work.id
      ? `${work.name} was cancelled, so nothing can start on it and no go-ahead can be given on it.`
      : `${cancelled.name}, which ${work.name} belongs to, was cancelled, so nothing can start on it.`;
  }
  const setting = getPracticeSetting(work.enterpriseId);
  // Work that is not a matter (opened before the business became a law
  // practice) skips the matter type and its locks, so on a law practice it
  // never goes to an AI worker.
  if (setting.lawPractice && !resolved.chain.some((one) => one.kind === "matter")) {
    return `${work.name} is not a matter. ${LAW_PRACTICE_MATTER_ONLY}`;
  }
  for (const one of resolved.chain) {
    if (one.kind !== "matter") continue;
    if (input.taskCreatedAt !== undefined && input.when !== "create" && input.when !== "signoff" && one.typeChangedAt !== undefined && input.taskCreatedAt < one.typeChangedAt) {
      return `${one.name}'s matter type changed after this Task was created, so it doesn't go on. Ask for the work again.`;
    }
    if (one.typeHeld) return `${one.name}'s type is held locked because Arturo couldn't confirm the record it replaces. Only the owner can change it, with a reason.`;
    if (one.matterType && isLockedMatterType(one.matterType, setting.customMatterTypes, one.createdAt)) {
      return `${one.name} is a ${matterTypeLabel(one.matterType, setting.customMatterTypes).toLowerCase()} matter, a type that never goes to an AI worker.`;
    }
    if (setting.lawPractice && !one.matterType) return `${one.name} has no matter type yet, so nothing on it can go to an AI worker.`;
    if (setting.lawPractice && !one.matterNumber) return `${one.name} has no matter number. A law practice's work goes to an AI worker only on a numbered matter.`;
  }
  const noAi = effectiveNoAi(work.id);
  if (noAi.noAi) return noAi.because;
  return undefined;
}

/** Whether a business is treated as a law practice (an unverified setting counts). SIDE EFFECT: Reads the practice setting. */
export function isLawPractice(enterpriseId: string): boolean {
  return getPracticeSetting(enterpriseId).lawPractice;
}

/** The business's clients named in a text, by the fixed rule. SIDE EFFECT: Reads client records. */
export function clientsNamedIn(enterpriseId: string, text: string, exceptClientId?: string): ClientRecord[] {
  return clientsNamedInText(text, listClientRecords(enterpriseId), exceptClientId);
}

/** A piece of work for this client that has "no AI" on, at it or above it. SIDE EFFECT: Reads work records. */
export function noAiWorkForClient(enterpriseId: string, clientId: string): WorkRecord | undefined {
  return listWorkFor(enterpriseId).work.find((work) => work.clientId === clientId && effectiveNoAi(work.id).noAi);
}

/**
 * Whether more than one person at the business can sign in (an active
 * account with a password). Until then the "no AI" client refusal may name
 * the other matter, because the only person who can read it is the one who
 * opened it; after that it doesn't (Amy, addendum 1).
 *
 * SIDE EFFECT: Reads identity state.
 */
export function secondPersonSignsIn(enterpriseId: string): boolean {
  try {
    return listPeople(enterpriseId).filter((person) => person.hasPassword && person.status === "active").length > 1;
  } catch {
    // Can't tell: don't name the other matter.
    return true;
  }
}

export type UnboundTaskInput = {
  readonly enterpriseId: string;
  readonly workId?: string;
  readonly clientId?: string;
  /** Any document or Artefact attached, including from a watched folder. */
  readonly hasDocuments: boolean;
  readonly draftKind?: DraftKind;
  /** The instruction as the person typed it, without any record Arturo added. */
  readonly instruction: string;
};

/**
 * Why a Task cannot be created as it stands, or undefined:
 *
 *   - anywhere, a Task for, or naming, a client with any work under "no AI"
 *     is refused outright;
 *   - on a law practice, a Task with no piece of work is refused when
 *     --client is given, a document is attached, it is a precedent draft or a
 *     checker, or its instruction names a listed client.
 *
 * Inheriting a --follows source's work is the caller's (createTask): by the
 * time this runs, a Task that follows work already carries its workId.
 *
 * SIDE EFFECT: Reads client and work records and the practice setting.
 */
export function refuseTaskWithoutWork(input: UnboundTaskInput): string | undefined {
  const named = clientsNamedIn(input.enterpriseId, input.instruction);
  const forClient = input.clientId ? getClientRecord(input.clientId) : undefined;
  for (const client of [...(forClient && forClient.enterpriseId === input.enterpriseId ? [forClient] : []), ...named]) {
    const blocked = noAiWorkForClient(input.enterpriseId, client.id);
    if (blocked) {
      // Once a second person can sign in, the refusal says only that the
      // client has such work, without naming it (Amy, addendum 1).
      return secondPersonSignsIn(input.enterpriseId)
        ? `${client.name.trim()} has ${blocked.kind === "matter" ? "a matter" : "work"} with "no AI" on, so nothing for or naming them goes to an AI worker.`
        : `${client.name.trim()} has work with "no AI" on (${blocked.name}), so nothing for or naming them goes to an AI worker.`;
    }
  }
  if (input.workId || !isLawPractice(input.enterpriseId)) return undefined;
  const because = input.clientId
    ? "names a client with --client"
    : input.hasDocuments
      ? "has a document attached"
      : input.draftKind === "precedent-draft"
        ? "is a first draft from a precedent"
        : input.draftKind === "checker"
          ? "is a check of a draft"
          : named.length
            ? `names ${named.map((client) => client.name.trim()).join(" and ")}, on your client list`
            : undefined;
  if (!because) return undefined;
  return `On a law practice, work that ${because} must belong to a matter. Add --work <matter> (see /work list).`;
}
