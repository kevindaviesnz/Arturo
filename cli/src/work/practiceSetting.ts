/**
 * Whether a business is a law practice, and the matter types its owner added.
 *
 * Kept in its own signed record per business: settingsRepository.ts is one
 * global, unsigned key/value table, so it could not say which business a
 * setting belongs to or show an edit. An unverified record reads as a law
 * practice with no added types unlocked (fail closed). Changing it is an
 * owner-only change (workChanges.ts); this module only reads and signs.
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
export function getPracticeSetting(enterpriseId: string): PracticeSettingStanding {
  const text = loadPracticeSettingRow(enterpriseId);
  if (text === undefined) return { lawPractice: false, customMatterTypes: [], state: "none" };
  try {
    const setting = JSON.parse(text) as PracticeSetting;
    const { signature, ...rest } = setting;
    const expected = Buffer.from(sign({ ...rest, customMatterTypes: rest.customMatterTypes ?? [] }));
    const actual = Buffer.from(String(signature ?? ""));
    if (setting.enterpriseId === enterpriseId && Array.isArray(setting.customMatterTypes) && expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
      return { lawPractice: setting.lawPractice === true, customMatterTypes: setting.customMatterTypes, state: "verified", setting };
    }
  } catch {
    // Unreadable: falls through to fail closed.
  }
  return { lawPractice: true, customMatterTypes: [], state: "unverified" };
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
