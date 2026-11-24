/**
 * The work-type pick in "Start a task" (setup-and-staff final v3, Mia's
 * mockup). One numbered question after the description and before the
 * go-ahead. A model never picks. Existing labels for the four original
 * unlocked ids are left unchanged (brief Q4).
 *
 * PURE helpers plus a small last-pick memory. SIDE EFFECT: the last-pick
 * map is in memory only.
 */

import { wrapSetupText } from "../setup/setupSaves";
import {
  BUILT_IN_WORK_TYPES,
  FIXED_LOCKED_WORK_TYPES,
  isLockedMatterType,
  matterTypeLabel,
  type CustomMatterType,
} from "./workRecord";

export const SOMETHING_ELSE_TYPE = "something-else";
export const SOMETHING_ELSE_LABEL = "Something else";

const LOCK_NOTE = "(locked: a person does it)";

/** Words that add a lock, never remove one. PURE. */
export const WORD_CHECK_LOCKS: readonly { readonly type: string; readonly words: readonly string[] }[] = [
  { type: "will", words: ["will", "testament", "codicil"] },
  { type: "court", words: ["court", "litigation", "hearing"] },
  { type: "dispute", words: ["dispute", "claim against"] },
  { type: "enduring-power-of-attorney", words: ["enduring power", "enduring-power-of-attorney"] },
  { type: "estate-administration", words: ["estate administration", "probate"] },
  { type: "relationship-property", words: ["relationship property", "prenuptial", "prenup"] },
];

export type WorkTypeChoice = {
  readonly id: string;
  readonly label: string;
  readonly locked: boolean;
};

const lastPickByFunction = new Map<string, string>();

/** SIDE EFFECT: Remembers this person's last pick for the Function. */
export function rememberWorkTypePick(functionId: string, person: string, typeId: string): void {
  lastPickByFunction.set(`${functionId}::${person.trim().toLowerCase()}`, typeId);
}

/** SIDE EFFECT: Reads the last-pick memory. */
export function lastWorkTypePick(functionId: string | undefined, person: string | undefined): string | undefined {
  if (!functionId || !person) return undefined;
  return lastPickByFunction.get(`${functionId}::${person.trim().toLowerCase()}`);
}

/** SIDE EFFECT: Clears last-pick memory (tests). */
export function clearWorkTypePicks(): void {
  lastPickByFunction.clear();
}

/** Why a word-check adds a lock, or undefined. A word check never removes one. PURE. */
export function wordCheckLock(text: string): { readonly type: string; readonly word: string } | undefined {
  const lower = text.toLowerCase();
  for (const rule of WORD_CHECK_LOCKS) {
    const word = rule.words.find((item) => lower.includes(item));
    if (word) return { type: rule.type, word };
  }
  return undefined;
}

/** The types a business can pick, built-ins first, then owner-added. PURE. */
export function workTypesForPick(custom: readonly CustomMatterType[] = []): WorkTypeChoice[] {
  const built = BUILT_IN_WORK_TYPES.map((id) => ({
    id,
    label: matterTypeLabel(id, custom),
    locked: isLockedMatterType(id, custom),
  }));
  const added = custom.map((one) => ({
    id: one.id,
    label: one.label,
    locked: isLockedMatterType(one.id, custom),
  }));
  return [...built, ...added];
}

export function isPickedTypeLocked(id: string, custom: readonly CustomMatterType[] = [], description = ""): boolean {
  if (id === SOMETHING_ELSE_TYPE) return true;
  if (wordCheckLock(description)) return true;
  return isLockedMatterType(id, custom);
}

export type WorkTypeMenu = {
  readonly body: string;
  readonly options: readonly WorkTypeChoice[];
  readonly more: readonly WorkTypeChoice[];
  readonly wordCheck?: { readonly type: string; readonly word: string };
};

const PAGE = 7;

/**
 * Builds the numbered pick, wrapping at 40 columns, with the lock note on
 * its own indented line. Nothing is pre-selected. PURE aside from last-pick memory.
 */
export function formatWorkTypeMenu(input: {
  readonly custom?: readonly CustomMatterType[];
  readonly functionId?: string;
  readonly person?: string;
  readonly description?: string;
  readonly morePage?: boolean;
}): WorkTypeMenu {
  const custom = input.custom ?? [];
  const types = workTypesForPick(custom);
  const last = lastWorkTypePick(input.functionId, input.person);
  const lastType = last ? types.find((row) => row.id === last) : undefined;
  const rest = lastType ? types.filter((row) => row.id !== lastType.id) : types;
  const wordCheck = input.description ? wordCheckLock(input.description) : undefined;

  const firstPage = lastType ? [lastType, ...rest] : rest;
  const visibleTypes = input.morePage ? firstPage.slice(PAGE) : firstPage.slice(0, PAGE);
  const more = input.morePage ? [] : firstPage.slice(PAGE);

  const options: WorkTypeChoice[] = [
    ...visibleTypes,
    { id: SOMETHING_ELSE_TYPE, label: SOMETHING_ELSE_LABEL, locked: true },
    ...(more.length ? [{ id: "__more__", label: "More types", locked: false }] : []),
  ];

  const lines: string[] = ["What kind of work is this?"];
  if (wordCheck) {
    lines.push(`Locked because it mentions "${wordCheck.word}". A person does it.`);
  }
  let number = 1;
  for (const option of options) {
    const name =
      lastType && option.id === lastType.id && !input.morePage
        ? `Same as last time: ${option.label}`
        : option.label;
    const locked = option.id === "__more__" ? false : option.locked || option.id === SOMETHING_ELSE_TYPE;
    if (option.id === SOMETHING_ELSE_TYPE) {
      lines.push(`${number} ${name}`);
      lines.push(`  ${LOCK_NOTE}`);
    } else if (locked) {
      lines.push(`${number} ${name}`);
      lines.push(`  ${LOCK_NOTE}`);
    } else {
      lines.push(`${number} ${name}`);
    }
    number += 1;
  }
  lines.push("b Back   q Quit");
  return {
    body: wrapSetupText(lines.join("\n")),
    options,
    more,
    ...(wordCheck ? { wordCheck } : {}),
  };
}

/** The go-ahead line that repeats the type and who picked it. PURE. */
export function formatWorkTypeGoAhead(label: string, pickedBy: string): string {
  return `Work type: ${label}. Picked by ${pickedBy}.`;
}

export function labelForWorkType(id: string, custom: readonly CustomMatterType[] = []): string {
  if (id === SOMETHING_ELSE_TYPE) return SOMETHING_ELSE_LABEL;
  return matterTypeLabel(id, custom);
}
