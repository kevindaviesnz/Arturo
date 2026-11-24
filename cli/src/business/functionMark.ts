/**
 * One person-set mark per Function: locked, people only, or AI allowed
 * (setup-and-staff final v3). An unmarked Function means AI allowed, in every
 * business. A model never sets a mark, and a mark is never guessed from a
 * Function's name or description. Marks grant no abilities.
 *
 * A locked or people-only Function refuses AI (strictest wins with work-type
 * locks). Removing a locked or people-only mark, or changing people-only to
 * AI allowed, is owner-only, with a typed reason, and stays refused at the
 * terminal until a loosening route is designed. A locked Function cannot
 * become AI allowed by this route.
 *
 * An unverified record fails closed (treated as locked).
 *
 * SIDE EFFECT: Reads and writes the runtime database; reads the signing secret.
 */

import crypto from "node:crypto";

import { getBusinessFunctionDefinition } from "./businessFunctionDefinitionStore";
import { refuseUnlessOwner, type Actor } from "../identity/companySignIn";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import {
  clearPersistedFunctionMarks,
  deleteFunctionMarkRow,
  loadFunctionMarkRow,
  saveFunctionMarkRow,
} from "../storage/functionMarkRepository";

export const FUNCTION_MARKS = ["locked", "people-only", "ai-allowed"] as const;
export type FunctionMarkValue = (typeof FUNCTION_MARKS)[number];

/** A mark that refuses AI. Unmarked and "ai-allowed" do not. PURE. */
export function isBlockingFunctionMark(mark: FunctionMarkValue | undefined): boolean {
  return mark === "locked" || mark === "people-only";
}

export type FunctionMarkRecord = {
  readonly functionId: string;
  readonly enterpriseId: string;
  readonly mark: FunctionMarkValue;
  readonly version: number;
  readonly changedBy: string;
  readonly changedByUserId?: string;
  readonly at: number;
  readonly reason?: string;
  readonly signature: string;
};

export type FunctionMarkStanding = {
  readonly mark?: FunctionMarkValue;
  readonly state: "verified" | "none" | "unverified";
  readonly record?: FunctionMarkRecord;
};

export type FunctionMarkRefusal = { readonly refused: string; readonly code: string };

const MARK_LABEL: Record<FunctionMarkValue, string> = {
  locked: "locked",
  "people-only": "people only",
  "ai-allowed": "AI allowed",
};

/** PURE: No side effects. */
export function functionMarkLabel(mark: FunctionMarkValue): string {
  return MARK_LABEL[mark];
}

/** PURE: No side effects. */
function payloadOf(record: Omit<FunctionMarkRecord, "signature">): string {
  return JSON.stringify({
    purpose: "function-mark",
    functionId: record.functionId,
    enterpriseId: record.enterpriseId,
    mark: record.mark,
    version: record.version,
    changedBy: record.changedBy,
    changedByUserId: record.changedByUserId ?? null,
    at: record.at,
    reason: record.reason ?? null,
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function sign(record: Omit<FunctionMarkRecord, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(record)).digest("hex");
}

/**
 * The effective mark: unmarked (no record) means AI allowed; unverified fails
 * closed as locked. SIDE EFFECT: Reads the runtime database and the signing secret.
 */
export function getFunctionMark(functionId: string | undefined): FunctionMarkStanding {
  if (!functionId) return { state: "none" };
  const text = loadFunctionMarkRow(functionId);
  if (text === undefined) return { state: "none" };
  try {
    const record = JSON.parse(text) as FunctionMarkRecord;
    const { signature, ...rest } = record;
    const expected = Buffer.from(sign({ ...rest }));
    const actual = Buffer.from(String(signature ?? ""));
    if (
      record.functionId === functionId &&
      FUNCTION_MARKS.includes(record.mark) &&
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    ) {
      return { mark: record.mark, state: "verified", record };
    }
  } catch {
    // Unreadable: falls through to fail closed.
  }
  return { mark: "locked", state: "unverified" };
}

/** The effective mark for lock checks. Unmarked is AI allowed; unverified is locked. SIDE EFFECT: Reads the mark. */
export function effectiveFunctionMark(functionId: string | undefined): FunctionMarkValue | undefined {
  const standing = getFunctionMark(functionId);
  if (standing.state === "none") return undefined;
  return standing.mark;
}

/** Why work on this Function may not go to an AI worker, or undefined. SIDE EFFECT: Reads the mark and Function. */
export function refuseFunctionMark(functionId: string | undefined): string | undefined {
  const mark = effectiveFunctionMark(functionId);
  if (!isBlockingFunctionMark(mark)) return undefined;
  const definition = functionId ? getBusinessFunctionDefinition(functionId) : undefined;
  const name = definition?.label ?? "This Function";
  return mark === "locked"
    ? `${name} is a locked Function, so nothing on it goes to an AI worker.`
    : `${name} is a people-only Function, so nothing on it goes to an AI worker.`;
}

/** Why an AI worker may not be assigned, or undefined. SIDE EFFECT: Reads the mark. */
export function refuseAiStaffingOnFunction(functionId: string, role: "ai" | "human-approver"): string | undefined {
  if (role !== "ai") return undefined;
  const mark = effectiveFunctionMark(functionId);
  if (!isBlockingFunctionMark(mark)) return undefined;
  const definition = getBusinessFunctionDefinition(functionId);
  const name = definition?.label ?? "This Function";
  const why = mark === "locked" ? "locked" : "people only";
  return `${name} is ${why}, so an AI worker cannot be assigned to it. Marks grant no abilities.`;
}

const tidy = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

const isLoosening = (from: FunctionMarkValue | undefined, to: FunctionMarkValue | undefined): boolean => {
  // Removing a blocking mark (including to unmarked or ai-allowed), or
  // changing people-only to AI allowed.
  if (isBlockingFunctionMark(from) && !isBlockingFunctionMark(to)) return true;
  if (from === "people-only" && to === "ai-allowed") return true;
  return false;
};

/**
 * Sets one Function's mark, or removes it when `mark` is undefined. A model
 * never calls this. Loosening stays refused at the terminal. A locked Function
 * cannot become AI allowed by this route.
 *
 * SIDE EFFECT: May write the mark.
 */
export function setFunctionMark(input: {
  readonly functionId: string;
  readonly mark?: FunctionMarkValue;
  readonly reason?: string;
  readonly actor: Actor;
  readonly as?: string;
  readonly now?: number;
}): { readonly message: string } | FunctionMarkRefusal {
  const definition = getBusinessFunctionDefinition(input.functionId);
  if (!definition) return { refused: "That Function was not found, so the mark was not changed.", code: "function_mark_not_found" };
  const standing = getFunctionMark(input.functionId);
  const current = standing.state === "unverified" ? "locked" : standing.mark;
  const next = input.mark;
  if (current === next) {
    const already = next ? functionMarkLabel(next) : "unmarked (AI allowed)";
    return { refused: `${definition.label} is already ${already}. Nothing was changed.`, code: "function_mark_unchanged" };
  }
  if (current === "locked" && next === "ai-allowed") {
    return { refused: `${definition.label} is locked, so it cannot be marked AI allowed by this route. The mark was not changed.`, code: "function_mark_locked_to_ai_allowed" };
  }
  if (isLoosening(current, next)) {
    const who = refuseUnlessOwner(input.actor, definition.enterpriseId, "change this Function's mark", "refused");
    if (who) {
      return {
        refused: input.actor
          ? "Only the owner can remove a locked or people-only mark, or change a people-only mark to AI allowed, with a typed reason. The mark was not changed."
          : "Removing a locked or people-only mark, or changing a people-only mark to AI allowed, is an owner-only change and is not available at the terminal yet. The mark was not changed.",
        code: input.actor && input.actor.roles.has(definition.enterpriseId) ? "function_mark_loosen_not_available" : "function_mark_owner_only",
      };
    }
    // Even a signed-in owner is refused at the terminal until the loosening route exists.
    return {
      refused: "Removing a locked or people-only mark, or changing a people-only mark to AI allowed, is an owner-only change and is not available at the terminal yet. The mark was not changed.",
      code: "function_mark_loosen_not_available",
    };
  }
  const by = tidy(input.actor?.workerName ?? input.as);
  if (!by) return { refused: "Say who you are. A model cannot set a Function mark. The mark was not changed.", code: "function_mark_person_required" };
  const now = input.now ?? Date.now();
  if (next === undefined) {
    deleteFunctionMarkRow(input.functionId);
    return { message: `${definition.label} is unmarked, which means AI allowed.` };
  }
  const unsigned: Omit<FunctionMarkRecord, "signature"> = {
    functionId: input.functionId,
    enterpriseId: definition.enterpriseId,
    mark: next,
    version: (standing.record?.version ?? 0) + 1,
    changedBy: by,
    ...(input.actor ? { changedByUserId: input.actor.userId } : {}),
    at: now,
    ...(tidy(input.reason) ? { reason: tidy(input.reason) } : {}),
  };
  const signed: FunctionMarkRecord = { ...unsigned, signature: sign(unsigned) };
  saveFunctionMarkRow(input.functionId, JSON.stringify(signed));
  return { message: `${definition.label} is marked ${functionMarkLabel(next)}.` };
}

/** SIDE EFFECT: Deletes every Function mark (tests and /reset). */
export function clearFunctionMarks(): void {
  clearPersistedFunctionMarks();
}
