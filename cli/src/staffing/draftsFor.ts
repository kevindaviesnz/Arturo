/**
 * A signed standing permission: an AI worker "drafts for" a named person
 * (setup-and-staff final v3). It is not called "assistant". The person it
 * drafts for signs off its drafts only if they can sign off at that moment.
 * If they cannot, the owner picks the signer from people who can sign off.
 *
 * Checked live before each draft with refuseStandingPermission. It lapses
 * when the person who set it loses the sign-off right, or when the person
 * it drafts for loses their role. Losing the sign-off right ends the
 * permissions that person set.
 *
 * SIDE EFFECT: Reads and writes the runtime database; reads the signing secret.
 */

import crypto from "node:crypto";

import { peopleOf } from "../clients/clientCommands";
import { maySignOff, type Actor } from "../identity/companySignIn";
import { currentProviderPolicy, refuseStandingPermission, type ProviderPolicy } from "../runtime/standingPermission";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import {
  clearPersistedDraftsFor,
  loadDraftsForRows,
  saveDraftsForRow,
} from "../storage/draftsForRepository";

export type DraftsForRecord = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly aiWorker: string;
  readonly draftsFor: string;
  readonly signer: string;
  readonly setBy: string;
  readonly setByUserId?: string;
  readonly at: number;
  readonly on: boolean;
  readonly withdrawnBy?: string;
  readonly withdrawnAt?: number;
  readonly provider: ProviderPolicy;
  readonly signature: string;
};

export type DraftsForRefusal = { readonly refused: string };

const PURPOSE = "drafts-for";

function payloadOf(record: Omit<DraftsForRecord, "signature">): string {
  return JSON.stringify({
    purpose: PURPOSE,
    id: record.id,
    enterpriseId: record.enterpriseId,
    aiWorker: record.aiWorker,
    draftsFor: record.draftsFor,
    signer: record.signer,
    setBy: record.setBy,
    setByUserId: record.setByUserId ?? null,
    at: record.at,
    on: record.on,
    withdrawnBy: record.withdrawnBy ?? null,
    withdrawnAt: record.withdrawnAt ?? null,
    provider: record.provider,
  });
}

function sign(record: Omit<DraftsForRecord, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(record)).digest("hex");
}

function verified(record: DraftsForRecord): boolean {
  try {
    const { signature, ...rest } = record;
    const expected = Buffer.from(sign(rest));
    const actual = Buffer.from(String(signature ?? ""));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function loadAll(): DraftsForRecord[] {
  const records: DraftsForRecord[] = [];
  for (const text of loadDraftsForRows()) {
    try {
      records.push(JSON.parse(text) as DraftsForRecord);
    } catch {
      // Skip unreadable rows.
    }
  }
  return records;
}

function write(record: Omit<DraftsForRecord, "signature">): DraftsForRecord {
  const signed: DraftsForRecord = { ...record, signature: sign(record) };
  saveDraftsForRow(signed.id, signed.enterpriseId, signed.aiWorker, JSON.stringify(signed));
  return signed;
}

function personNamed(enterpriseId: string, name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return undefined;
  return peopleOf(enterpriseId).find((person) => person.toLowerCase() === wanted);
}

function idFor(enterpriseId: string, aiWorker: string): string {
  return `${enterpriseId}::${aiWorker}`;
}

/**
 * Sets a signed "drafts for" permission. The signer is the person it drafts
 * for when they can sign off now; otherwise the caller must name a signer
 * who can sign off.
 *
 * SIDE EFFECT: May write one signed record.
 */
export function setDraftsFor(input: {
  readonly enterpriseId: string;
  readonly aiWorker: string;
  readonly draftsFor: string;
  readonly signer?: string;
  readonly actor: Actor;
  readonly as: string;
  readonly now?: number;
}): { readonly record: DraftsForRecord } | DraftsForRefusal {
  const draftsFor = personNamed(input.enterpriseId, input.draftsFor);
  if (!draftsFor) return { refused: `There is no person called ${input.draftsFor.trim() || "that"} at this business.` };
  let signer = draftsFor;
  if (!maySignOff(input.enterpriseId, draftsFor)) {
    const named = input.signer ? personNamed(input.enterpriseId, input.signer) : undefined;
    if (!named || !maySignOff(input.enterpriseId, named)) {
      return { refused: `${draftsFor} cannot sign off work at this business. Name someone who can sign off, to sign off these drafts.` };
    }
    signer = named;
  }
  const setBy = input.as.trim();
  if (!setBy) return { refused: "Say who is setting this, so the permission is signed." };
  const now = input.now ?? Date.now();
  const record = write({
    id: idFor(input.enterpriseId, input.aiWorker),
    enterpriseId: input.enterpriseId,
    aiWorker: input.aiWorker,
    draftsFor,
    signer,
    setBy,
    ...(input.actor?.userId ? { setByUserId: input.actor.userId } : {}),
    at: now,
    on: true,
    provider: currentProviderPolicy(),
  });
  return { record };
}

/** SIDE EFFECT: May write a withdrawn record. */
export function withdrawDraftsFor(input: {
  readonly enterpriseId: string;
  readonly aiWorker: string;
  readonly by: string;
  readonly now?: number;
}): void {
  const existing = loadAll().find((row) => row.enterpriseId === input.enterpriseId && row.aiWorker === input.aiWorker && row.on);
  if (!existing || !verified(existing)) return;
  const { signature: _signature, ...rest } = existing;
  write({
    ...rest,
    on: false,
    withdrawnBy: input.by,
    withdrawnAt: input.now ?? Date.now(),
  });
}

/**
 * Ends every drafts-for permission this person set, or that drafts for them.
 * Called when they lose the sign-off right or their role.
 *
 * SIDE EFFECT: May write withdrawn records.
 */
export function endDraftsForInvolving(enterpriseId: string, person: string, by: string, now?: number): number {
  const wanted = person.trim().toLowerCase();
  if (!wanted) return 0;
  const at = now ?? Date.now();
  let count = 0;
  for (const row of loadAll()) {
    if (row.enterpriseId !== enterpriseId || !row.on) continue;
    if (row.setBy.toLowerCase() !== wanted && row.draftsFor.toLowerCase() !== wanted) continue;
    const { signature: _signature, ...rest } = row;
    write({ ...rest, on: false, withdrawnBy: by, withdrawnAt: at });
    count += 1;
  }
  return count;
}

/**
 * Why this AI worker may not draft for its person right now, or undefined.
 * SIDE EFFECT: Reads the record, the signing secret, and sign-off rights.
 */
export function refuseDraftsFor(input: {
  readonly enterpriseId: string;
  readonly aiWorker: string;
  readonly forEnterpriseId?: string;
}): { readonly code: string; readonly message: string } | undefined {
  const row = loadAll().find((record) => record.enterpriseId === input.enterpriseId && record.aiWorker === input.aiWorker);
  const what = `The "drafts for" permission set on ${input.aiWorker}`;
  if (!row) return undefined;
  if (!verified(row)) {
    return { code: "permission_unverified", message: `${what} could not be verified, so it counts as off. It may have been saved by an earlier version of Arturo, or changed since. Someone who can sign off work can set it again.` };
  }
  if (!row.on) {
    const when = row.withdrawnBy ? ` by ${row.withdrawnBy}` : "";
    return { code: "permission_withdrawn", message: `${what} was withdrawn${when}, so nothing more goes on under it.` };
  }
  const standing = refuseStandingPermission({
    what,
    enterpriseId: row.enterpriseId,
    forEnterpriseId: input.forEnterpriseId ?? input.enterpriseId,
    setBy: row.setBy,
    provider: row.provider,
  });
  if (standing) return standing;
  if (!personNamed(row.enterpriseId, row.draftsFor)) {
    return { code: "permission_lapsed", message: `${what} drafts for ${row.draftsFor}, who no longer works here, so it lapsed and counts as withdrawn. Someone who can sign off work can set it again.` };
  }
  if (!maySignOff(row.enterpriseId, row.signer)) {
    return { code: "permission_lapsed", message: `${what} is signed off by ${row.signer}, who can no longer sign off work here, so it lapsed and counts as withdrawn. Someone who can sign off work can set it again.` };
  }
  return undefined;
}

/** The live drafts-for record, if it is on and verifies. SIDE EFFECT: Reads the store. */
export function getDraftsFor(enterpriseId: string, aiWorker: string): DraftsForRecord | undefined {
  const row = loadAll().find((record) => record.enterpriseId === enterpriseId && record.aiWorker === aiWorker);
  if (!row || !row.on || !verified(row)) return undefined;
  return row;
}

/** SIDE EFFECT: Reads the store. */
export function listDraftsFor(enterpriseId: string): readonly DraftsForRecord[] {
  return loadAll().filter((row) => row.enterpriseId === enterpriseId && row.on && verified(row));
}

/** SIDE EFFECT: Deletes every drafts-for record (tests). */
export function clearDraftsFor(): void {
  clearPersistedDraftsFor();
}
