/**
 * The one live check every standing permission passes before each step it
 * allows (B9, with C3): a pass-on rule, a route's run, a hand-off, and later
 * listeners, loop rounds and chosen steps.
 *
 * A permission counts only while:
 *   - its signature verifies (a record saved by an older version of Arturo,
 *     or changed since, counts as off until it is set again);
 *   - it is still on, and is the one the run started under (changing or
 *     withdrawing it stops its open runs at their next step, saying who did
 *     it and when);
 *   - the person who set it can still sign off work at the business (a
 *     permission whose setter lost that right lapses, and a lapsed permission
 *     is treated as withdrawn: G-C8, C7);
 *   - it belongs to the business the step is for (C3, C4);
 *   - the provider routing policy and model it was set under are still the
 *     ones in use (C3, BC1). The policy is bound, not the provider one call
 *     happened to use, so local-first routing does not stop runs by itself.
 *
 * A step already running is never stopped: it finishes and its result waits.
 * Each refusal has a fixed code and fixed wording.
 *
 * SIDE EFFECT: Reads settings, Worker and sign-in state.
 */

import { formatNzTime } from "../core/nzTime";
import { peopleOf } from "../clients/clientCommands";
import { maySignOff } from "../identity/companySignIn";
import { resolveConfiguredProvider } from "../llm/llmClient";
import { getEffectiveModelName } from "../llm/modelSelection";

/** The provider routing policy and model a permission was set under. */
export type ProviderPolicy = {
  readonly provider: string;
  readonly routingMode: "single" | "local-first";
  readonly model: string;
};

/** The policy in use now. SIDE EFFECT: Reads settings and the environment. */
export function currentProviderPolicy(): ProviderPolicy {
  const { provider, routingMode } = resolveConfiguredProvider();
  return { provider, routingMode, model: getEffectiveModelName() };
}

/** PURE: No side effects. */
export function sameProviderPolicy(a: ProviderPolicy | undefined, b: ProviderPolicy): boolean {
  return Boolean(a) && a!.provider === b.provider && a!.routingMode === b.routingMode && a!.model === b.model;
}

export const STANDING_REFUSAL_CODES = [
  "permission_unverified",
  "permission_withdrawn",
  "permission_changed",
  "permission_lapsed",
  "permission_other_business",
  "permission_provider_changed",
] as const;

export type StandingRefusalCode = (typeof STANDING_REFUSAL_CODES)[number];

export type StandingRefusal = { readonly code: StandingRefusalCode; readonly message: string };

export type StandingRefusalValues = {
  /** What the permission is, in a few words: "The route set on Drafting". */
  readonly what: string;
  readonly by?: string;
  readonly at?: number;
  readonly setBy?: string;
  readonly was?: ProviderPolicy;
  readonly now?: ProviderPolicy;
};

const policyWords = (policy: ProviderPolicy | undefined) =>
  policy ? `${policy.model} through ${policy.provider}${policy.routingMode === "local-first" ? " (this computer first)" : ""}` : "no recorded model";

const byWhen = (values: StandingRefusalValues) =>
  values.by ? ` by ${values.by}${values.at !== undefined ? ` at ${formatNzTime(values.at)}` : ""}` : "";

/** The fixed wording for each refusal. PURE: No side effects. */
export const STANDING_REFUSAL_WORDING: Readonly<Record<StandingRefusalCode, (values: StandingRefusalValues) => string>> = {
  permission_unverified: (v) =>
    `${v.what} could not be verified, so it counts as off. It may have been saved by an earlier version of Arturo, or changed since. Someone who can sign off work can set it again.`,
  permission_withdrawn: (v) => `${v.what} was withdrawn${byWhen(v)}, so nothing more goes on under it.`,
  permission_changed: (v) =>
    `${v.what} was changed${byWhen(v)} after this run started, so the run stopped. New results follow the new setting.`,
  permission_lapsed: (v) =>
    `${v.what} was set by ${v.setBy ?? "someone"}, who can no longer sign off work here, so it lapsed and counts as withdrawn. Someone who can sign off work can set it again.`,
  permission_other_business: (v) => `${v.what} belongs to another business, so it does not apply here.`,
  permission_provider_changed: (v) =>
    `${v.what} was set while Arturo used ${policyWords(v.was)}. It now uses ${policyWords(v.now)}, so nothing more goes on under it until someone who can sign off work sets it again.`,
};

/** PURE: No side effects. */
export function standingRefusal(code: StandingRefusalCode, values: StandingRefusalValues): StandingRefusal {
  return { code, message: STANDING_REFUSAL_WORDING[code](values) };
}

/**
 * Whether the person who set a permission still works at the business, by
 * the name Arturo knows them by, and can still sign off work there.
 *
 * SIDE EFFECT: Reads Worker and sign-in state.
 */
export function setterStillSigns(enterpriseId: string, setBy: string): boolean {
  const wanted = setBy.trim().toLowerCase();
  if (!wanted) return false;
  const person = peopleOf(enterpriseId).find((name) => name.toLowerCase() === wanted);
  return Boolean(person) && maySignOff(enterpriseId, person!);
}

/**
 * The checks shared by every permission once its own record has been found,
 * verified and matched to its run: the business, the setter's rights, and
 * the provider policy.
 *
 * SIDE EFFECT: Reads Worker, sign-in and settings state.
 */
export function refuseStandingPermission(input: {
  readonly what: string;
  /** The business the permission was set for. */
  readonly enterpriseId: string;
  /** The business the step is for. */
  readonly forEnterpriseId: string | undefined;
  readonly setBy: string;
  /** Absent for a permission that starts no AI work (a hand-off to a person). */
  readonly provider?: ProviderPolicy | "unbound";
}): StandingRefusal | undefined {
  if (input.forEnterpriseId !== undefined && input.forEnterpriseId !== input.enterpriseId) {
    return standingRefusal("permission_other_business", { what: input.what });
  }
  if (!setterStillSigns(input.enterpriseId, input.setBy)) {
    return standingRefusal("permission_lapsed", { what: input.what, setBy: input.setBy || undefined });
  }
  if (input.provider !== undefined) {
    const now = currentProviderPolicy();
    const was = input.provider === "unbound" ? undefined : input.provider;
    if (!sameProviderPolicy(was, now)) return standingRefusal("permission_provider_changed", { what: input.what, was, now });
  }
  return undefined;
}
