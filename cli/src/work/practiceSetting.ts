/**
 * Whether a business is a law practice, the work types its owner added, and
 * whether AI work must belong to a typed piece of work (setup-and-staff
 * final v3). That general setting replaces the old law-only branches in
 * workLocks.ts. It switches on automatically for existing law practices, and
 * an unverified record counts as on (fail closed). The field is signed only
 * when present, so settings written before it still verify.
 *
 * Kept in its own signed record per business: settingsRepository.ts is one
 * global, unsigned key/value table, so it could not say which business a
 * setting belongs to or show an edit. An unverified record reads as a law
 * practice with no added types unlocked and the typed-work setting on.
 * Changing it is an owner-only change (workChanges.ts); this module only
 * reads and signs. Switching the typed-work setting off stays refused until
 * a terminal loosening route is designed.
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import crypto from "node:crypto";

import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { clearPersistedPracticeSettings, loadPracticeSettingRow, savePracticeSetting } from "../storage/practiceSettingRepository";
import type { CustomMatterType } from "./workRecord";

export type PracticeSetting = {
  readonly enterpriseId: string;
  readonly lawPractice: boolean;
  /**
   * Whether AI work must belong to a typed piece of work. Absent on records
   * signed before this field existed; getPracticeSetting then derives it
   * from lawPractice (on for a law practice, off otherwise).
   */
  readonly typedWorkRequired?: boolean;
  readonly customMatterTypes: readonly CustomMatterType[];
  readonly version: number;
  readonly changedBy: string;
  readonly changedByUserId?: string;
  readonly at: number;
  readonly reason?: string;
  readonly signature: string;
};

export type PracticeSettingStanding = {
  readonly lawPractice: boolean;
  /** Effective value, including migration and fail-closed unverified records. */
  readonly typedWorkRequired: boolean;
  readonly customMatterTypes: readonly CustomMatterType[];
  readonly state: "verified" | "none" | "unverified";
  readonly setting?: PracticeSetting;
};

/** PURE: No side effects. */
function payloadOf(setting: Omit<PracticeSetting, "signature">): string {
  return JSON.stringify({
    purpose: "practice-setting",
    enterpriseId: setting.enterpriseId,
    lawPractice: setting.lawPractice,
    // typedWorkRequired is signed only when present, so a setting signed before it still verifies.
    ...(setting.typedWorkRequired !== undefined ? { typedWorkRequired: setting.typedWorkRequired } : {}),
    // unlockedAt is signed only when present, so a setting signed before it still verifies.
    customMatterTypes: setting.customMatterTypes.map((one) => ({ id: one.id, label: one.label, locked: one.locked, ...(one.unlockedAt !== undefined ? { unlockedAt: one.unlockedAt } : {}) })),
    version: setting.version,
    changedBy: setting.changedBy,
    changedByUserId: setting.changedByUserId ?? null,
    at: setting.at,
    reason: setting.reason ?? null,
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function sign(setting: Omit<PracticeSetting, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(setting)).digest("hex");
}

/** A business's setting, verified. SIDE EFFECT: Reads the runtime database and the signing secret. */
/**
 * The effective typed-work setting. An unverified record counts as on.
 * A missing record is off. A verified record uses the signed field when
 * present, otherwise it follows lawPractice so existing law practices stay on.
 *
 * PURE: No side effects.
 */
export function effectiveTypedWorkRequired(input: {
  readonly state: PracticeSettingStanding["state"];
  readonly lawPractice: boolean;
  readonly typedWorkRequired?: boolean;
}): boolean {
  if (input.state === "unverified") return true;
  if (input.state === "none") return false;
  if (input.typedWorkRequired !== undefined) return input.typedWorkRequired === true;
  return input.lawPractice === true;
}

/** A business's setting, verified. SIDE EFFECT: Reads the runtime database and the signing secret. */
export function getPracticeSetting(enterpriseId: string): PracticeSettingStanding {
  const text = loadPracticeSettingRow(enterpriseId);
  if (text === undefined) return { lawPractice: false, typedWorkRequired: false, customMatterTypes: [], state: "none" };
  try {
    const setting = JSON.parse(text) as PracticeSetting;
    const { signature, ...rest } = setting;
    const expected = Buffer.from(sign({ ...rest, customMatterTypes: rest.customMatterTypes ?? [] }));
    const actual = Buffer.from(String(signature ?? ""));
    if (setting.enterpriseId === enterpriseId && Array.isArray(setting.customMatterTypes) && expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
      const lawPractice = setting.lawPractice === true;
      return {
        lawPractice,
        typedWorkRequired: effectiveTypedWorkRequired({ state: "verified", lawPractice, typedWorkRequired: setting.typedWorkRequired }),
        customMatterTypes: setting.customMatterTypes,
        state: "verified",
        setting,
      };
    }
  } catch {
    // Unreadable: falls through to fail closed.
  }
  return { lawPractice: true, typedWorkRequired: true, customMatterTypes: [], state: "unverified" };
}

/** Whether AI work must belong to a typed piece of work at this business. SIDE EFFECT: Reads the setting. */
export function isTypedWorkRequired(enterpriseId: string): boolean {
  return getPracticeSetting(enterpriseId).typedWorkRequired;
}

/** Signs and stores a business's setting. The caller has already checked who may. SIDE EFFECT: Writes one row. */
export function saveSignedPracticeSetting(setting: Omit<PracticeSetting, "signature">): PracticeSetting {
  const signed = { ...setting, signature: sign(setting) };
  savePracticeSetting(signed);
  return signed;
}

/** SIDE EFFECT: Deletes every practice setting (tests and /reset). */
export function clearPracticeSettings(): void {
  clearPersistedPracticeSettings();
}
