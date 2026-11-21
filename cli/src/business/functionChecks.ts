/**
 * Checks Arturo makes itself on work asked of an area of work.
 *
 * A rule written for an AI helper is an instruction to a model, and a model
 * can ignore it: a manuscript over the length limit was "reviewed" anyway, and
 * a review of a manuscript nobody had attached was invented. These two checks
 * are not instructions. Arturo makes them, in code, before any model is asked:
 *
 *   - needs a document: work with nothing attached is refused;
 *   - a word limit: Arturo counts the words in each attached document and
 *     refuses one that is over.
 *
 * They are applied in the function behind /task create, so the terminal and
 * the page refuse in the same way, and always before a Task exists. They bind
 * work somebody asks for. They do not bind a Task Arturo creates for a
 * running Function from an event, and they do not judge whether a document is
 * any good: that is still for the AI helper to say and a person to sign off.
 */

import { formatArtefactReference, parseArtefactReference } from "../artefacts/artefact";
import {
  getArtefact,
  getArtefactVersion,
  readTextOfVerifiedArtefactVersion,
  verifyArtefactVersionIntegrity,
} from "../artefacts/artefactStore";
import {
  clearPersistedFunctionChecks,
  deleteFunctionChecks,
  loadFunctionChecks,
  saveFunctionChecks,
} from "../storage/functionChecksRepository";
import { getBusinessFunctionDefinition } from "./businessFunctionDefinitionStore";

export type FunctionChecks = {
  readonly functionId: string;
  readonly enterpriseId: string;
  /** Work with no document attached is refused. */
  readonly needsDocument: boolean;
  /** A document with more words than this is refused. */
  readonly maxWords?: number;
  /** Who set the checks, as they named themselves. */
  readonly setBy: string;
  readonly setAt: number;
};

/** The largest limit that can be set; far beyond any document Arturo reads. */
export const MAX_WORD_LIMIT = 1_000_000;

/** The most text read from one document to count it; the upload limit is 10 MB. */
const COUNT_LIMIT_CHARACTERS = 50 * 1024 * 1024;

const number = new Intl.NumberFormat("en-US");

/**
 * The words in a text, as a word processor counts them: runs of characters
 * between spaces and line breaks.
 *
 * PURE: No side effects.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** SIDE EFFECT: Reads the runtime database. */
export function getFunctionChecks(functionId: string | undefined): FunctionChecks | undefined {
  return functionId ? loadFunctionChecks().find((checks) => checks.functionId === functionId) : undefined;
}

/** SIDE EFFECT: Reads the runtime database. */
export function listFunctionChecks(): FunctionChecks[] {
  return loadFunctionChecks();
}

/** The checks in plain words, for the page and the terminal. PURE: No side effects. */
export function describeFunctionChecks(checks: Pick<FunctionChecks, "needsDocument" | "maxWords"> | undefined): string[] {
  if (!checks) return [];
  return [
    ...(checks.needsDocument ? ["Work needs a document attached."] : []),
    ...(checks.maxWords ? [`A document over ${number.format(checks.maxWords)} words is not taken on.`] : []),
  ];
}

/**
 * Why these settings would be refused, or undefined.
 *
 * PURE: No side effects.
 */
export function refuseFunctionCheckSettings(input: { readonly needsDocument: boolean; readonly maxWords?: number }): string | undefined {
  if (input.maxWords !== undefined && (!Number.isInteger(input.maxWords) || input.maxWords < 1 || input.maxWords > MAX_WORD_LIMIT)) {
    return `Give the word limit as a whole number from 1 to ${number.format(MAX_WORD_LIMIT)}.`;
  }
  return undefined;
}

/**
 * Sets, replaces or (when nothing is asked for) removes a Function's checks.
 * Refuses before writing anything.
 *
 * SIDE EFFECT: May write or delete one row in the runtime database.
 */
export function setFunctionChecks(input: {
  readonly functionId: string;
  readonly needsDocument: boolean;
  readonly maxWords?: number;
  readonly setBy: string;
  readonly now?: number;
}): { readonly checks: FunctionChecks | undefined } | { readonly refused: string } {
  const definition = getBusinessFunctionDefinition(input.functionId);
  if (!definition) return { refused: `No Function found with id ${input.functionId}.` };
  const refusal = refuseFunctionCheckSettings(input);
  if (refusal) return { refused: refusal };
  if (!input.needsDocument && input.maxWords === undefined) {
    deleteFunctionChecks(definition.id);
    return { checks: undefined };
  }
  const checks: FunctionChecks = {
    functionId: definition.id,
    enterpriseId: definition.enterpriseId,
    needsDocument: input.needsDocument,
    ...(input.maxWords !== undefined ? { maxWords: input.maxWords } : {}),
    setBy: input.setBy.trim() || "someone at the terminal",
    setAt: input.now ?? Date.now(),
  };
  saveFunctionChecks(checks);
  return { checks };
}

/**
 * Reads a word limit as a person types it ("5000", "5,000") or turns it off
 * ("off", "none"). Anything else is refused rather than guessed at.
 *
 * PURE: No side effects.
 */
export function parseWordLimit(text: string): { readonly maxWords: number | null } | { readonly refused: string } {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === "off" || trimmed === "none") return { maxWords: null };
  if (!/^\d{1,3}(,\d{3})*$|^\d+$/.test(trimmed)) {
    return { refused: `Give the word limit as a whole number from 1 to ${number.format(MAX_WORD_LIMIT)}, or "off".` };
  }
  const maxWords = Number(trimmed.replace(/,/g, ""));
  const refusal = refuseFunctionCheckSettings({ needsDocument: false, maxWords });
  return refusal ? { refused: refusal } : { maxWords };
}

/**
 * Changes one or both checks and keeps the other as it was: asking only for a
 * word limit leaves "needs a document" as it stands. `maxWords: null` takes
 * the limit off. Refuses before writing anything.
 *
 * SIDE EFFECT: May write or delete one row in the runtime database.
 */
export function changeFunctionChecks(input: {
  readonly functionId: string;
  readonly needsDocument?: boolean;
  readonly maxWords?: number | null;
  readonly setBy: string;
  readonly now?: number;
}): { readonly checks: FunctionChecks | undefined } | { readonly refused: string } {
  const current = getFunctionChecks(input.functionId);
  const needsDocument = input.needsDocument ?? current?.needsDocument ?? false;
  const maxWords = input.maxWords === undefined ? current?.maxWords : input.maxWords ?? undefined;
  return setFunctionChecks({
    functionId: input.functionId,
    needsDocument,
    ...(maxWords !== undefined ? { maxWords } : {}),
    setBy: input.setBy,
    ...(input.now !== undefined ? { now: input.now } : {}),
  });
}

/** SIDE EFFECT: Deletes one Function's checks. */
export function removeFunctionChecks(functionId: string): void {
  deleteFunctionChecks(functionId);
}

/** SIDE EFFECT: Deletes every Function's checks. */
export function clearFunctionChecks(): void {
  clearPersistedFunctionChecks();
}

/**
 * Why work asked of this Function must be refused under its checks, or
 * undefined when it may go ahead. The reason is written for the person who
 * asked, and says that nothing was started.
 *
 * `documents` are exact Artefact-version references such as `artefact-3@1`.
 * Work that continues from earlier work needs no document of its own, because
 * what it works from is carried across by the Task it follows.
 *
 * A word limit that cannot be checked is a refusal, not a pass: a document
 * Arturo cannot read, or whose file no longer matches what was recorded, has
 * no count to compare.
 *
 * SIDE EFFECT: Reads the Function's checks and the documents' files.
 */
export function refuseWorkUnderChecks(input: {
  readonly functionId: string;
  readonly functionLabel: string;
  readonly documents: readonly string[];
  readonly continuesEarlierWork: boolean;
}): string | undefined {
  const checks = getFunctionChecks(input.functionId);
  if (!checks) return undefined;
  const label = input.functionLabel;

  if (checks.needsDocument && !input.documents.length && !input.continuesEarlierWork) {
    return `${label} needs a document, and none was attached, so nothing was started. Attach the document and send it again.`;
  }

  if (checks.maxWords === undefined) return undefined;
  for (const text of input.documents) {
    let reference;
    try {
      reference = parseArtefactReference(text);
    } catch {
      continue;
    }
    const artefact = getArtefact(reference.artefactId);
    const version = getArtefactVersion(reference);
    const name = artefact?.name ?? formatArtefactReference(reference);
    const cannot = `Arturo cannot count the words in ${name} (it can read Word and plain-text documents), so it cannot check ${label}'s word limit and nothing was started.`;
    if (!artefact || !version || verifyArtefactVersionIntegrity(version).status !== "verified") return cannot;
    const content = readTextOfVerifiedArtefactVersion(version, COUNT_LIMIT_CHARACTERS);
    if (!content) return cannot;
    const words = countWords(content.text);
    if (words > checks.maxWords) {
      return `${name} is ${content.truncated ? "over " : ""}${number.format(words)} words. ${label} does not take on a document over ${number.format(checks.maxWords)} words (set by ${checks.setBy}), so nothing was started.`;
    }
    if (content.truncated) return cannot;
  }
  return undefined;
}
