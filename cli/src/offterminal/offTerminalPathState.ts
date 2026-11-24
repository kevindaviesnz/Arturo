/**
 * Stored state of the off-terminal sign-off path at one business. The
 * path starts off. A waiting switch-on counts as on only once its wait
 * has elapsed (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import { SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import {
  clearPersistedOffTerminalPath,
  loadOffTerminalPathRow,
  saveOffTerminalPathRow,
} from "../storage/offTerminalPathRepository";

export type OffTerminalPathState = "off" | "waiting" | "on";

export type OffTerminalPathRecord = {
  readonly enterpriseId: string;
  readonly state: OffTerminalPathState;
  readonly reason?: string;
  readonly notifyTo?: string;
  readonly requestedBy: string;
  readonly requestedByUserId?: string;
  readonly requestedAt: number;
  readonly effectiveAt?: number;
  readonly cancelledBy?: string;
  readonly cancelledAt?: number;
};

export const PATH_OFF_REFUSAL =
  "Off-terminal sign-off is not on at this business, so no link was sent.";

export function switchOnWaitMs(): number {
  return SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
}

function parseRecord(recordJson: string | undefined): OffTerminalPathRecord | undefined {
  if (!recordJson) {
    return undefined;
  }
  try {
    const record = JSON.parse(recordJson) as OffTerminalPathRecord;
    if (!record || typeof record.enterpriseId !== "string") {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

/** SIDE EFFECT: Reads one business's path setting. */
export function getOffTerminalPath(enterpriseId: string): OffTerminalPathRecord | undefined {
  return parseRecord(loadOffTerminalPathRow(enterpriseId));
}

/** SIDE EFFECT: Writes one business's path setting. */
export function saveOffTerminalPath(record: OffTerminalPathRecord): void {
  saveOffTerminalPathRow(record.enterpriseId, JSON.stringify(record));
}

/**
 * Whether the path is in effect at `now`. A waiting switch-on whose wait
 * has elapsed counts as on. There is no "at the host computer" exception.
 */
export function isOffTerminalPathOn(enterpriseId: string, now = Date.now()): boolean {
  const record = getOffTerminalPath(enterpriseId);
  if (!record || record.state === "off") {
    return false;
  }
  if (record.state === "on") {
    return true;
  }
  return record.effectiveAt !== undefined && record.effectiveAt <= now;
}

/** SIDE EFFECT: Deletes every path setting (tests and /reset). */
export function clearOffTerminalPath(): void {
  clearPersistedOffTerminalPath();
}
