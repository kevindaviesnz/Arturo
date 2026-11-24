/**
 * Owner-only switch-on of off-terminal sign-off, and turning it off.
 * Switching on is a loosening: a typed reason, a 12-hour wait, and an
 * email notice. Switching off is immediate. These controls stay at the
 * terminal and are never offered on the listener (off-terminal sign-off brief).
 *
 * SIDE EFFECT: May write the path setting, send a notice, and revoke links.
 */

import { formatNzTime } from "../core/nzTime";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { maySignOff, refuseUnlessOwner, type Actor } from "../identity/companySignIn";
import { WEB_SEARCH_REASON_MAX_CHARS } from "../runtime/chainLimits";
import { sendClaimOnceMail } from "./claimOnceEmail";
import { revokeOffTerminalLinksForEnterprise } from "./offTerminalLinks";
import {
  getOffTerminalPath,
  isOffTerminalPathOn,
  saveOffTerminalPath,
  switchOnWaitMs,
  type OffTerminalPathRecord,
} from "./offTerminalPathState";

export type OffTerminalPathOutcome = { readonly message: string; readonly effectiveAt?: number };
export type OffTerminalPathRefusal = { readonly refused: string };

const YES_ONLY = new Set(["y", "yes"]);

function isEmailAddress(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function reasonRefusal(reason: string): string | undefined {
  const trimmed = reason.trim();
  if (!trimmed || YES_ONLY.has(trimmed.toLowerCase())) {
    return "Say why off-terminal sign-off should be on, in your own words, not only yes.";
  }
  if (trimmed.length > WEB_SEARCH_REASON_MAX_CHARS) {
    return `Keep the reason under ${WEB_SEARCH_REASON_MAX_CHARS} characters.`;
  }
  return undefined;
}

function businessName(enterpriseId: string): string {
  return getEnterprise(enterpriseId)?.name ?? "this business";
}

/**
 * Starts a 12-hour switch-on. The notice must be accepted first; otherwise
 * nothing is changed. Until the wait ends, the path is still off.
 */
export async function requestOffTerminalPathOn(input: {
  readonly enterpriseId: string;
  readonly reason: string;
  readonly notifyTo: string;
  readonly actor: Actor;
  readonly now?: number;
}): Promise<OffTerminalPathOutcome | OffTerminalPathRefusal> {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "switch off-terminal sign-off on");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const reasonProblem = reasonRefusal(input.reason);
  if (reasonProblem) {
    return { refused: reasonProblem };
  }
  if (!isEmailAddress(input.notifyTo.trim())) {
    return { refused: "Say who should get the notice, as an email address." };
  }

  const now = input.now ?? Date.now();
  if (isOffTerminalPathOn(input.enterpriseId, now)) {
    return { refused: "Off-terminal sign-off is already on." };
  }
  const current = getOffTerminalPath(input.enterpriseId);
  if (current?.state === "waiting" && current.effectiveAt !== undefined && current.effectiveAt > now) {
    return {
      refused: `Off-terminal sign-off is already waiting to turn on at ${formatNzTime(current.effectiveAt)}. Cancel it first.`,
    };
  }

  const effectiveAt = now + switchOnWaitMs();
  const when = formatNzTime(effectiveAt);
  const name = businessName(input.enterpriseId);
  const text =
    `Off-terminal sign-off at ${name} will turn on at ${when}. Anyone who can sign off may cancel it at the Arturo computer.`;
  const outcome = await sendClaimOnceMail({
    to: input.notifyTo.trim(),
    subject: `Off-terminal sign-off at ${name} will turn on`,
    text,
  });
  if (outcome !== "accepted") {
    return { refused: "The notice could not be sent, so off-terminal sign-off was not switched on." };
  }

  const record: OffTerminalPathRecord = {
    enterpriseId: input.enterpriseId,
    state: "waiting",
    reason: input.reason.trim(),
    notifyTo: input.notifyTo.trim(),
    requestedBy: input.actor?.workerName ?? "the terminal",
    requestedAt: now,
    effectiveAt,
    ...(input.actor?.userId ? { requestedByUserId: input.actor.userId } : {}),
  };
  saveOffTerminalPath(record);
  return {
    message: `${text}`,
    effectiveAt,
  };
}

/**
 * Cancels a waiting switch-on. Anyone who can sign off may do this, at
 * the terminal only.
 */
export function cancelOffTerminalPathOn(input: {
  readonly enterpriseId: string;
  readonly actor: { readonly workerName: string; readonly userId?: string };
  readonly now?: number;
}): OffTerminalPathOutcome | OffTerminalPathRefusal {
  const now = input.now ?? Date.now();
  if (!maySignOff(input.enterpriseId, input.actor.workerName)) {
    return { refused: "Only someone who can sign off may cancel this." };
  }
  if (isOffTerminalPathOn(input.enterpriseId, now)) {
    return { refused: "Off-terminal sign-off is already on. The owner can turn it off." };
  }
  const current = getOffTerminalPath(input.enterpriseId);
  if (!current || current.state !== "waiting") {
    return { refused: "Off-terminal sign-off is not waiting to turn on." };
  }
  saveOffTerminalPath({
    ...current,
    state: "off",
    cancelledBy: input.actor.workerName,
    cancelledAt: now,
  });
  return { message: "The switch-on was cancelled. Off-terminal sign-off is still off." };
}

/**
 * Turns the path off at once. Issued links fail closed. Owner only, at
 * the terminal.
 */
export function turnOffTerminalPathOff(input: {
  readonly enterpriseId: string;
  readonly actor: Actor;
  readonly now?: number;
}): OffTerminalPathOutcome | OffTerminalPathRefusal {
  const ownerRefusal = refuseUnlessOwner(input.actor, input.enterpriseId, "turn off-terminal sign-off off");
  if (ownerRefusal) {
    return { refused: ownerRefusal };
  }
  const now = input.now ?? Date.now();
  const current = getOffTerminalPath(input.enterpriseId);
  saveOffTerminalPath({
    enterpriseId: input.enterpriseId,
    state: "off",
    requestedBy: input.actor?.workerName ?? "the terminal",
    requestedAt: now,
    ...(current?.reason ? { reason: current.reason } : {}),
    ...(input.actor?.userId ? { requestedByUserId: input.actor.userId } : {}),
  });
  revokeOffTerminalLinksForEnterprise(input.enterpriseId, now);
  return { message: "Off-terminal sign-off is off. Issued links no longer work." };
}
