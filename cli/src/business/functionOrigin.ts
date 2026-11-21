/**
 * Where a business function set up from the company page came from.
 *
 * Arturo now offers to set up a business function and its AI worker whenever
 * a task fits none. A worker set up that way has an archetype (and so what it
 * may do), standing instructions and someone who signs off its work, and
 * Arturo's claim is that a person agreed to exactly those. So each one set up
 * from the page keeps one record of how it came about:
 *
 *   - how: Arturo's suggestion for a task accepted on the card
 *     ("suggestion"), the full form opened from that card ("custom"), one of
 *     the business functions Arturo suggested for the whole business
 *     ("business"), or the form under Your business ("form");
 *   - the task that needed it, as typed;
 *   - what the model suggested, as it came back, beside what was saved, so
 *     any change the person made shows;
 *   - how the archetype was chosen: worked out in code from the words typed,
 *     or picked on the page. Never by a model;
 *   - who set it up, as they named themselves on the page. That is a name
 *     chosen on the page, not a proven identity (THREAT_MODEL.md item 7).
 *
 * Written once, when the function is set up, never changed, and removed with
 * the function.
 */

import {
  clearPersistedFunctionOrigins,
  deleteFunctionOrigin,
  loadFunctionOrigin,
  saveFunctionOrigin,
} from "../storage/functionOriginRepository";

export type FunctionOriginVia = "suggestion" | "custom" | "business" | "form";

export type FunctionOrigin = {
  readonly functionId: string;
  readonly enterpriseId: string;
  readonly via: FunctionOriginVia;
  /** The task that needed it, as the person typed it. */
  readonly forTask?: string;
  /** What the model suggested, as it came back. Absent for the form, or when the suggestion was no longer kept. */
  readonly suggested?: {
    readonly functionName: string;
    /** What it keeps doing, for one suggested for the whole business. */
    readonly objective?: string;
    readonly required: string;
    readonly guardrails: string;
    /** No model answer could be used; the name came from the task's own words. */
    readonly fellBack: boolean;
  };
  readonly saved: {
    readonly functionName: string;
    readonly objective?: string;
    readonly workerName: string;
    readonly archetype: string;
    readonly archetypeFrom: "worked out from the words typed" | "chosen on the page";
    readonly required: string;
    readonly guardrails: string;
    readonly approver: string;
    readonly needsDocument: boolean;
  };
  /** Who set it up, as they named themselves on the page. */
  readonly setUpBy: string;
  readonly at: number;
};

/** SIDE EFFECT: Writes one row in the runtime database. */
export function recordFunctionOrigin(origin: FunctionOrigin): void {
  saveFunctionOrigin(origin);
}

/** SIDE EFFECT: Reads the runtime database. */
export function getFunctionOrigin(functionId: string | undefined): FunctionOrigin | undefined {
  return functionId ? loadFunctionOrigin(functionId) : undefined;
}

/** SIDE EFFECT: Deletes one Function's origin, with the Function. */
export function removeFunctionOrigin(functionId: string): void {
  deleteFunctionOrigin(functionId);
}

/** SIDE EFFECT: Deletes every Function's origin. */
export function clearFunctionOrigins(): void {
  clearPersistedFunctionOrigins();
}

/**
 * What the person changed from the model's suggestion before accepting it.
 *
 * PURE: No side effects.
 */
export function changedFromSuggestion(origin: FunctionOrigin): string[] {
  const suggested = origin.suggested;
  if (!suggested || suggested.fellBack) return [];
  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  return [
    ...(same(suggested.functionName, origin.saved.functionName) ? [] : ["the name"]),
    ...(same(suggested.required, origin.saved.required) ? [] : ["Required"]),
    ...(same(suggested.guardrails, origin.saved.guardrails) ? [] : ["Guardrails"]),
  ];
}

/**
 * How it came about, in a few words: "Suggested by Arturo for a task,
 * confirmed by Amy Wise".
 *
 * PURE: No side effects.
 */
export function describeFunctionOrigin(origin: FunctionOrigin): string {
  if (origin.via === "suggestion") return `Suggested by Arturo for a task, confirmed by ${origin.setUpBy}`;
  if (origin.via === "business") return `Suggested by Arturo for your business, confirmed by ${origin.setUpBy}`;
  if (origin.via === "custom") return `Set up by ${origin.setUpBy} for a task`;
  return `Set up by ${origin.setUpBy}`;
}
