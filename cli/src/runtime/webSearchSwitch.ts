/**
 * Web search, per business (owner decisions 7 and 13; Grace's W1–W6; S4).
 *
 * `ARTURO_WEB_SEARCH_PROVIDER` only says which search provider this computer
 * could use. On its own it never lets anything search (W3). A business must
 * also have its own signed record, purpose `web-search-on`, binding the
 * business, the signed-in account that turned it on, the time, their typed
 * reason and the search provider (W1). It is turned on from the company page,
 * signed in, and refused at the terminal. Anyone who can sign off may turn it
 * off, at the terminal or on the page, with an optional note (W4): turning
 * off is never harder than turning on.
 *
 * Before each web step the record is checked live: it must verify, still be
 * on, its setter must still be able to sign off there (a lapsed setter counts
 * as withdrawn, W4), and the search provider must be the one it was turned on
 * for (C3). The step itself must carry a person's own search words and its
 * own signed go-ahead, and on a law practice it must not be matter work (W5:
 * the separate owner-only change for matters is not built, so matter work
 * never searches). Wording, Events and text a model wrote never switch
 * search on (S4).
 *
 * SIDE EFFECT: Reads and writes the runtime database; reads the signing
 * secret, the web search configuration, Worker and sign-in state.
 */

import crypto from "node:crypto";

import { formatNzTime } from "../core/nzTime";
import { getEnterprise } from "../enterprise/enterpriseStore";
import type { Account } from "../identity/companySignIn";
import { getWebSearchConfiguration, type WebSearchConfiguration } from "../integrations/webSearchConfig";
import { clearPersistedWebSearchSwitches, loadWebSearchSwitchRow, saveWebSearchSwitchRow } from "../storage/webSearchSwitchRepository";
import { getPracticeSetting } from "../work/practiceSetting";
import { isLockedMatterType } from "../work/workRecord";
import { getWork } from "../work/workStore";
import { getApprovalChain } from "./approvalChainStore";
import { resolveApprovalGate } from "./approvalGate";
import { WEB_SEARCH_QUERY_MAX_CHARS, WEB_SEARCH_REASON_MAX_CHARS } from "./chainLimits";
import type { Job } from "./jobQueue";
import { appendRuntimeEventToStore } from "./runtimeEventStore";
import { getLocalApprovalSigningSecret } from "./runtimeSecrets";
import { setterStillSigns } from "./standingPermission";

export const WEB_SEARCH_SWITCH_VERSION = 1;

export type WebSearchSwitch = {
  readonly enterpriseId: string;
  readonly on: boolean;
  /** Who turned it on or off, by the name Arturo knows them by. */
  readonly by: string;
  /** The signed-in account, when there was one (always, to turn it on). */
  readonly byUserId?: string;
  readonly at: number;
  /** Why it was turned on (required). */
  readonly reason?: string;
  /** A note on turning it off (optional). */
  readonly note?: string;
  /** The search provider it was turned on for. */
  readonly searchProvider: string;
  readonly version: number;
  readonly signature: string;
};

export type WebSearchSwitchStanding =
  | { readonly state: "none" }
  | { readonly state: "unverified" }
  | { readonly state: "on" | "off"; readonly record: WebSearchSwitch };

export const WEB_SEARCH_REFUSAL_CODES = [
  "web_search_sign_in_needed",
  "web_search_not_your_business",
  "web_search_cannot_sign_off",
  "web_search_reason_needed",
  "web_search_reason_too_long",
  "web_search_note_too_long",
  "web_search_not_set_up",
  "web_search_already_on",
  "web_search_already_off",
  "web_search_off",
  "web_search_unverified",
  "web_search_lapsed",
  "web_search_provider_changed",
  "web_search_no_words",
  "web_search_words_too_long",
  "web_search_no_business",
  "web_search_on_matter",
  "web_search_on_locked_work",
  "web_search_no_go_ahead",
] as const;

export type WebSearchRefusalCode = (typeof WEB_SEARCH_REFUSAL_CODES)[number];
export type WebSearchRefusal = { readonly code: WebSearchRefusalCode; readonly message: string };

type Values = { readonly business?: string; readonly who?: string; readonly by?: string; readonly at?: number; readonly was?: string; readonly now?: string; readonly taskId?: string };

/** The fixed wording for each refusal. PURE: No side effects. */
export const WEB_SEARCH_REFUSAL_WORDING: Readonly<Record<WebSearchRefusalCode, (v: Values) => string>> = {
  web_search_sign_in_needed: () =>
    "Web search is turned on from the company page by someone signed in who can sign off work, with a reason. It can't be turned on at the terminal, or with sign-in off.",
  web_search_not_your_business: () => "That is not your business.",
  web_search_cannot_sign_off: (v) => `Only someone at ${v.business ?? "this business"} who can sign off work may turn web search on or off.${v.who ? ` ${v.who} cannot.` : ""}`,
  web_search_reason_needed: () => "Say why web search should be on. The reason is kept with the setting.",
  web_search_reason_too_long: () => `Keep the reason under ${WEB_SEARCH_REASON_MAX_CHARS} characters.`,
  web_search_note_too_long: () => `Keep the note under ${WEB_SEARCH_REASON_MAX_CHARS} characters.`,
  web_search_not_set_up: () => "Web search isn't set up on this computer (ARTURO_WEB_SEARCH_PROVIDER), so it can't be used.",
  web_search_already_on: (v) => `Web search is already on for ${v.business ?? "this business"}.`,
  web_search_already_off: (v) => `Web search is already off for ${v.business ?? "this business"}.`,
  web_search_off: (v) => `Web search is off for ${v.business ?? "this business"}. Someone who can sign off work can turn it on from the company page.`,
  web_search_unverified: (v) => `A web search setting was found for ${v.business ?? "this business"} that Arturo could not verify, so web search counts as off. Someone who can sign off work can turn it on again.`,
  web_search_lapsed: (v) => `Web search was turned on by ${v.by ?? "someone"}, who can no longer sign off work here, so it lapsed and counts as off. Someone who can sign off work can turn it on again.`,
  web_search_provider_changed: (v) => `Web search was turned on for ${v.was ?? "another search provider"}. This computer now uses ${v.now ?? "another"}, so web search counts as off until someone who can sign off work turns it on again.`,
  web_search_no_words: () => "A web step needs the exact words to search for, given by a person (--search-query). Arturo never searches with words from the task or from text an AI wrote.",
  web_search_words_too_long: () => `Keep the search words under ${WEB_SEARCH_QUERY_MAX_CHARS} characters.`,
  web_search_no_business: () => "A web step must belong to one business, so Arturo can check that business has web search on.",
  web_search_on_matter: () => "This is matter work at a law practice. Search words would come from the matter and leave the practice, so matter work never searches.",
  web_search_on_locked_work: () => "This work is of a locked type, so it never searches. Search words would come from the work and leave the business.",
  web_search_no_go_ahead: (v) => `${v.taskId ?? "This web step"} has no signed go-ahead, so it doesn't search. A person gives each web step its own go-ahead.`,
};

/** PURE: No side effects. */
export function webSearchRefusal(code: WebSearchRefusalCode, values: Values = {}): WebSearchRefusal {
  return { code, message: WEB_SEARCH_REFUSAL_WORDING[code](values) };
}

/** PURE: No side effects. */
function payloadOf(record: Omit<WebSearchSwitch, "signature">): string {
  return JSON.stringify({
    purpose: record.on ? "web-search-on" : "web-search-off",
    enterpriseId: record.enterpriseId,
    on: record.on,
    by: record.by,
    byUserId: record.byUserId ?? null,
    at: record.at,
    reason: record.reason ?? null,
    note: record.note ?? null,
    searchProvider: record.searchProvider,
    version: record.version,
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function sign(record: Omit<WebSearchSwitch, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(record)).digest("hex");
}

/** A business's switch, verified. SIDE EFFECT: Reads the runtime database and the signing secret. */
export function readWebSearchSwitch(enterpriseId: string): WebSearchSwitchStanding {
  const text = loadWebSearchSwitchRow(enterpriseId);
  if (text === undefined) return { state: "none" };
  try {
    const record = JSON.parse(text) as WebSearchSwitch;
    const { signature, ...rest } = record;
    const expected = Buffer.from(sign(rest));
    const actual = Buffer.from(String(signature ?? ""));
    if (record.enterpriseId === enterpriseId && record.version === WEB_SEARCH_SWITCH_VERSION && expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
      return { state: record.on ? "on" : "off", record };
    }
  } catch {
    // Unreadable: counts as off.
  }
  return { state: "unverified" };
}

/** SIDE EFFECT: Signs and writes one record, and a runtime event. */
function saveSwitch(unsigned: Omit<WebSearchSwitch, "signature">): WebSearchSwitch {
  const record = { ...unsigned, signature: sign(unsigned) };
  saveWebSearchSwitchRow(record.enterpriseId, JSON.stringify(record));
  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type: record.on ? "runtime.web_search.turned_on" : "runtime.web_search.turned_off",
    level: "info",
    message: `Web search turned ${record.on ? "on" : "off"} for ${getEnterprise(record.enterpriseId)?.name ?? record.enterpriseId} by ${record.by}${record.on ? ` (${record.searchProvider}): ${record.reason}` : record.note ? `: ${record.note}` : ""}`,
    timestamp: record.at,
    payload: { enterpriseId: record.enterpriseId, by: record.by, searchProvider: record.searchProvider },
  });
  return record;
}

const businessName = (enterpriseId: string) => getEnterprise(enterpriseId)?.name ?? enterpriseId;

export type WebSearchSwitchOutcome = { readonly record: WebSearchSwitch; readonly message: string } | { readonly refused: string; readonly code: WebSearchRefusalCode };

const refused = (refusal: WebSearchRefusal): WebSearchSwitchOutcome => ({ refused: refusal.message, code: refusal.code });

/**
 * Turns web search on for one business: only by a signed-in account that can
 * sign off work there, with a typed reason, for the search provider this
 * computer is set up with (W1, BC2). Every refusal comes before anything is
 * written.
 *
 * SIDE EFFECT: May write one signed record and a runtime event.
 */
export function turnWebSearchOn(input: { readonly enterpriseId: string; readonly reason?: string; readonly actor?: Account; readonly now?: number; readonly configuration?: WebSearchConfiguration }): WebSearchSwitchOutcome {
  const business = businessName(input.enterpriseId);
  if (!input.actor) return refused(webSearchRefusal("web_search_sign_in_needed"));
  if (!input.actor.roles.has(input.enterpriseId)) return refused(webSearchRefusal("web_search_not_your_business"));
  if (!setterStillSigns(input.enterpriseId, input.actor.workerName)) return refused(webSearchRefusal("web_search_cannot_sign_off", { business, who: input.actor.workerName }));
  const reason = (input.reason ?? "").trim();
  if (!reason) return refused(webSearchRefusal("web_search_reason_needed"));
  if (reason.length > WEB_SEARCH_REASON_MAX_CHARS) return refused(webSearchRefusal("web_search_reason_too_long"));
  const configuration = input.configuration ?? getWebSearchConfiguration();
  if (!configuration.ready || configuration.provider === "disabled") return refused(webSearchRefusal("web_search_not_set_up"));
  if (readWebSearchSwitch(input.enterpriseId).state === "on" && !refuseWebSearchFor(input.enterpriseId, configuration)) return refused(webSearchRefusal("web_search_already_on", { business }));
  const record = saveSwitch({
    enterpriseId: input.enterpriseId,
    on: true,
    by: input.actor.workerName,
    byUserId: input.actor.userId,
    at: input.now ?? Date.now(),
    reason,
    searchProvider: configuration.provider,
    version: WEB_SEARCH_SWITCH_VERSION,
  });
  return {
    record,
    message: `Web search is on for ${business}. Search words go to ${configuration.provider}, outside the business, and may include client or product names. Each web step still needs its own go-ahead.`,
  };
}

/**
 * Turns web search off for one business: anyone who can sign off work there,
 * signed in or (at the terminal, or with sign-in off) named with --as, with
 * an optional note (W4).
 *
 * SIDE EFFECT: May write one signed record and a runtime event.
 */
export function turnWebSearchOff(input: { readonly enterpriseId: string; readonly note?: string; readonly as?: string; readonly actor?: Account; readonly now?: number }): WebSearchSwitchOutcome {
  const business = businessName(input.enterpriseId);
  if (input.actor && !input.actor.roles.has(input.enterpriseId)) return refused(webSearchRefusal("web_search_not_your_business"));
  const who = (input.actor?.workerName ?? input.as ?? "").trim();
  if (!who || !setterStillSigns(input.enterpriseId, who)) return refused(webSearchRefusal("web_search_cannot_sign_off", { business, who: who || undefined }));
  const note = (input.note ?? "").trim();
  if (note.length > WEB_SEARCH_REASON_MAX_CHARS) return refused(webSearchRefusal("web_search_note_too_long"));
  const standing = readWebSearchSwitch(input.enterpriseId);
  // An unverified record is replaced by a signed "off", so the page can say who turned it off.
  if (standing.state === "none" || standing.state === "off") return refused(webSearchRefusal("web_search_already_off", { business }));
  const record = saveSwitch({
    enterpriseId: input.enterpriseId,
    on: false,
    by: who,
    ...(input.actor ? { byUserId: input.actor.userId } : {}),
    at: input.now ?? Date.now(),
    ...(note ? { note } : {}),
    searchProvider: standing.state === "on" ? standing.record.searchProvider : getWebSearchConfiguration().provider,
    version: WEB_SEARCH_SWITCH_VERSION,
  });
  return { record, message: `Web search is off for ${business}. Nothing searches for it until someone who can sign off work turns it on again.` };
}

/**
 * Why this business can't search now, or undefined: checked live before every
 * web step (W3, W4, C3).
 *
 * SIDE EFFECT: Reads the switch, the configuration, Worker and sign-in state.
 */
export function refuseWebSearchFor(enterpriseId: string, configuration: WebSearchConfiguration = getWebSearchConfiguration()): WebSearchRefusal | undefined {
  const business = businessName(enterpriseId);
  const standing = readWebSearchSwitch(enterpriseId);
  if (standing.state === "none" || standing.state === "off") return webSearchRefusal("web_search_off", { business });
  if (standing.state === "unverified") return webSearchRefusal("web_search_unverified", { business });
  if (!setterStillSigns(enterpriseId, standing.record.by)) return webSearchRefusal("web_search_lapsed", { by: standing.record.by });
  if (!configuration.ready || configuration.provider === "disabled") return webSearchRefusal("web_search_not_set_up");
  if (configuration.provider !== standing.record.searchProvider) {
    return webSearchRefusal("web_search_provider_changed", { was: standing.record.searchProvider, now: configuration.provider });
  }
  return undefined;
}

/**
 * Why a Task asking for these search words may not be created: checked by
 * createTask before anything is written. The go-ahead comes later, for the
 * Task itself.
 *
 * SIDE EFFECT: Reads the switch, the practice setting and the configuration.
 */
export function refuseWebStepRequest(input: { readonly enterpriseId?: string; readonly workId?: string; readonly words: string }, configuration: WebSearchConfiguration = getWebSearchConfiguration()): WebSearchRefusal | undefined {
  const words = input.words.trim();
  if (!words) return webSearchRefusal("web_search_no_words");
  if (words.length > WEB_SEARCH_QUERY_MAX_CHARS) return webSearchRefusal("web_search_words_too_long");
  if (!input.enterpriseId) return webSearchRefusal("web_search_no_business");
  if (input.workId && getPracticeSetting(input.enterpriseId).typedWorkRequired) return webSearchRefusal("web_search_on_matter");
  if (input.workId) {
    const standing = getWork(input.workId);
    const setting = getPracticeSetting(input.enterpriseId);
    if (standing.state === "verified" && standing.work.matterType && isLockedMatterType(standing.work.matterType, setting.customMatterTypes, standing.work.createdAt)) {
      return webSearchRefusal("web_search_on_locked_work");
    }
  }
  return refuseWebSearchFor(input.enterpriseId, configuration);
}

/**
 * Why this web step may not search now, or undefined: its own words, its
 * business, not matter work, the business's switch, and its own signed
 * go-ahead. Checked by the executor right before the search is sent.
 *
 * SIDE EFFECT: Reads the switch, the practice setting, the configuration and the approval chain.
 */
export function refuseWebStep(job: Job, configuration: WebSearchConfiguration = getWebSearchConfiguration()): WebSearchRefusal | undefined {
  const request = refuseWebStepRequest({ enterpriseId: job.enterpriseId, workId: job.workId, words: job.webSearchQuery ?? "" }, configuration);
  if (request) return request;
  if (resolveApprovalGate(job, getApprovalChain(job.id), true) !== "approved") return webSearchRefusal("web_search_no_go_ahead", { taskId: job.id });
  return undefined;
}

/**
 * The line shown on the business's settings and on every web step's row
 * (W2), and the switch-off record shown before anyone turns it back on (W4).
 *
 * SIDE EFFECT: Reads the switch.
 */
export function describeWebSearchSwitch(enterpriseId: string): string {
  const standing = readWebSearchSwitch(enterpriseId);
  if (standing.state === "on") return `Web search turned on by ${standing.record.by}, ${formatNzTime(standing.record.at)}`;
  if (standing.state === "off") return `Web search is off. Turned off by ${standing.record.by}, ${formatNzTime(standing.record.at)}${standing.record.note ? `: "${standing.record.note}"` : "."}`;
  if (standing.state === "unverified") return webSearchRefusal("web_search_unverified", { business: businessName(enterpriseId) }).message;
  return "Web search is off.";
}

/** SIDE EFFECT: Deletes every switch (tests and /reset). */
export function clearWebSearchSwitches(): void {
  clearPersistedWebSearchSwitches();
}
