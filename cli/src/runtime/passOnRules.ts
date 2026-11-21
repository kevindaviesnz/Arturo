/**
 * Where a business function's results go before a person signs them off.
 *
 * An AI-written result reaches nothing else until someone signs it off
 * (resultSignOff.ts, THREAT_MODEL.md item 18), with one exception kept here:
 * a person who can sign off work may set a business function so that its
 * results go to another business function's AI worker first, to be checked,
 * and then come to a person to sign off. Amy has her NDA drafts checked by
 * Contract review before she reads them.
 *
 * Three settings, each recorded with who set it and when:
 *   - "me": results come to a person to sign off (what every business
 *     function does until it is set);
 *   - "send": results go to another business function's AI worker first;
 *   - "never": results always come to a person, and no single task may send
 *     them on (Amy's wills).
 *
 * A person asking for one task may choose for that task alone: bring it
 * straight back, or send it to be checked first, unless the business
 * function is set to "never". No choice can remove the sign-off at the end.
 *
 * Fixed here, in code, not by any model:
 *   - only someone at the business who can sign off work may set a rule;
 *   - results go only to another business function of the same business with
 *     an AI worker, and never to one whose AI worker can reach outside Arturo
 *     (search the web, change records) without asking first: a result nobody
 *     has signed off must not leave Arturo;
 *   - one step: a check is never passed on again (PASS_ON_STEPS).
 *
 * Rules are signed with the local approval signing key, and an edited rule is
 * not followed; someone with the data directory and that key can still forge
 * one (THREAT_MODEL.md item 1).
 */

import crypto from "node:crypto";

import { abilitiesOf } from "../capabilities/abilities";
import { getBusinessFunctionDefinition, listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { peopleOf } from "../clients/clientCommands";
import { maySignOff } from "../identity/companySignIn";
import { getWorker } from "../control/workers";
import { listStaffingAssignments } from "../staffing/staffingStore";
import {
  clearPersistedPassOns,
  deletePassOnRule,
  loadPassOnDelivery,
  loadPassOnDeliveryByNext,
  loadPassOnRequest,
  loadPassOnRule,
  savePassOnRequest,
  savePassOnRule,
} from "../storage/passOnRepository";
import { getLocalApprovalSigningSecret } from "./runtimeSecrets";
import { currentProviderPolicy, refuseStandingPermission, standingRefusal, type ProviderPolicy, type StandingRefusal } from "./standingPermission";

// Both limits live with the others in chainLimits.ts (S8); re-exported unchanged.
import { MAX_ROUTE_STEPS, PASS_ON_STEPS } from "./chainLimits";
export { MAX_ROUTE_STEPS, PASS_ON_STEPS };

/** The longest instruction one step of a route is given. */
export const MAX_ROUTE_INSTRUCTION = 400;

export type PassOnMode = "me" | "send" | "never" | "route";

/** One step of a route: a business function, and what its AI worker is told, in words a person wrote. */
export type RouteStep = { readonly functionId: string; readonly instruction: string };

export type PassOnRule = {
  readonly functionId: string;
  readonly enterpriseId: string;
  readonly mode: PassOnMode;
  /** For "send": the business function whose AI worker checks results first. */
  readonly toFunctionId?: string;
  /** For "route": the steps, in order, after this business function. */
  readonly steps?: readonly RouteStep[];
  /** For "route": this business function's own result is signed off before the route goes on. */
  readonly pauseFirst?: boolean;
  /** Who set it, as they named themselves. */
  readonly setBy: string;
  readonly setAt: number;
  /**
   * The signature version (RULE_VERSION). A rule saved before rules bound the
   * provider routing policy does not verify, and counts as off until it is set
   * again (C3, C4).
   */
  readonly version?: number;
  /** The provider routing policy and model it was set under (C3). A change stops the next step. */
  readonly provider?: ProviderPolicy;
  /** HMAC over everything above, so an edited rule is not followed. */
  readonly signature?: string;
};

/** The current signature version of a pass-on rule. */
export const RULE_VERSION = 2;

/**
 * One route's run, from the result it started from. The steps are copied
 * from the rule when it starts, so changing the rule does not change a run.
 */
export type RouteChain = {
  readonly startTaskId: string;
  readonly functionId: string;
  readonly enterpriseId: string;
  readonly steps: readonly RouteStep[];
  readonly pauseFirst: boolean;
  readonly setBy: string;
  /** SHA-256 of the signed rule it ran under. */
  readonly ruleSha256: string;
  readonly at: number;
  /** Waiting for the first result's sign-off, moving along, or stopped. */
  readonly state: "paused" | "running" | "stopped";
  readonly stoppedBy?: string;
  readonly stoppedAt?: number;
  readonly stopReason?: string;
};

/** What the person asking chose for one task, when it was created. */
export type PassOnRequest = {
  readonly jobId: string;
  /** "off": bring it straight back. Otherwise the business function to send it to first. */
  readonly choice: string;
  readonly by?: string;
  readonly at: number;
};

/** One result passed on, or stopped from being passed on. */
export type PassOnDelivery = {
  readonly sourceTaskId: string;
  readonly toFunctionId: string;
  /** Sent on by the business function's rule, or by the choice made for this task. */
  readonly via: "rule" | "task";
  /** Who set the rule or made the choice. */
  readonly setBy: string;
  readonly at: number;
  /** The task that checks it, once created. */
  readonly nextTaskId?: string;
  /** For a step of a route: the result the route started from, and which step this is (1 is the first after it). */
  readonly routeStart?: string;
  readonly stepIndex?: number;
  /** Why it was not passed on after all; the result comes to a person as it is. */
  readonly stopped?: string;
  /** What the check said when the result was signed off: kept with the sign-off. */
  readonly seenAtSignOff?: {
    readonly by: string;
    readonly at: number;
    readonly checkTaskId?: string;
    /** "finished", "not finished" or "failed", when the result was signed off. */
    readonly checkState: string;
    /** SHA-256 of the check's stored result, when it had finished. */
    readonly checkSha256?: string;
  };
};

type Refusal = { readonly refused: string };

/** What a rule's signature covers. PURE: No side effects. */
function rulePayload(rule: PassOnRule): string {
  return JSON.stringify({
    purpose: "pass-on-rule",
    version: RULE_VERSION,
    provider: rule.provider ? { provider: rule.provider.provider, routingMode: rule.provider.routingMode, model: rule.provider.model } : null,
    functionId: rule.functionId,
    enterpriseId: rule.enterpriseId,
    mode: rule.mode,
    ...(rule.toFunctionId ? { toFunctionId: rule.toFunctionId } : {}),
    ...(rule.steps ? { steps: rule.steps.map((step) => ({ functionId: step.functionId, instruction: step.instruction })) } : {}),
    ...(rule.pauseFirst !== undefined ? { pauseFirst: rule.pauseFirst } : {}),
    setBy: rule.setBy,
    setAt: rule.setAt,
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function signRule(rule: PassOnRule): PassOnRule {
  const { signature: _old, ...unsigned } = rule;
  return { ...unsigned, signature: crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(rulePayload(unsigned)).digest("hex") };
}

/** SIDE EFFECT: Reads the signing secret. */
function verifyRule(rule: PassOnRule): boolean {
  const expected = Buffer.from(crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(rulePayload(rule)).digest("hex"));
  const actual = Buffer.from(String(rule.signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** SHA-256 of what a rule's signature covers, kept with each run. PURE: No side effects. */
export function ruleSha256(rule: PassOnRule): string {
  return crypto.createHash("sha256").update(rulePayload(rule)).digest("hex");
}

/** The AI workers staffed on a business function. SIDE EFFECT: Reads staffing and Worker state. */
function aiWorkersOf(functionId: string) {
  return listStaffingAssignments(functionId)
    .filter((assignment) => assignment.role === "ai")
    .map((assignment) => getWorker(assignment.workerName))
    .filter((worker): worker is NonNullable<typeof worker> => Boolean(worker) && worker!.kind === "ai");
}

/** The person, by their name in Arturo, if they work at the business and can sign off work. SIDE EFFECT: Reads Worker state. */
export function mayChangeWhereResultsGo(enterpriseId: string, name: string): string | undefined {
  return signerAt(enterpriseId, name);
}

/** The person at the business who can sign off work, as Arturo knows them. SIDE EFFECT: Reads Worker state. */
function signerAt(enterpriseId: string, name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  return peopleOf(enterpriseId).find((person) => person.toLowerCase() === wanted && maySignOff(enterpriseId, person));
}

/**
 * Why results of one business function may not be sent to another first, or
 * undefined when they may.
 *
 * SIDE EFFECT: Reads Function, staffing and Worker state.
 */
export function refusePassOnTarget(input: { readonly enterpriseId: string; readonly fromFunctionId: string; readonly toFunctionId: string }): string | undefined {
  const to = getBusinessFunctionDefinition(input.toFunctionId);
  if (!to || to.enterpriseId !== input.enterpriseId) return "Choose one of this business's business functions to send results to.";
  if (to.id === input.fromFunctionId) return `${to.label} cannot check its own results. Choose another business function.`;
  const workers = aiWorkersOf(to.id);
  if (!workers.length) return `${to.label} has no AI worker to check results yet.`;
  for (const worker of workers) {
    const reach = abilitiesOf(worker.capabilities ?? []).find(({ ability, needsGoAhead }) => ability.reach === "office" || (ability.reach === "outside" && !needsGoAhead));
    if (reach) {
      return `${to.label}'s AI worker can ${reach.ability.label.charAt(0).toLowerCase()}${reach.ability.label.slice(1)} without asking first, and a result nobody has signed off must not leave Arturo, so results are not sent there.`;
    }
  }
  return undefined;
}

export type PassOnSetting = {
  readonly enterpriseId: string;
  readonly functionId: string;
  readonly mode: string;
  readonly to?: string;
  /** For "route": each step's business function (id or name) and instruction, in order. */
  readonly steps?: readonly { readonly to: string; readonly instruction: string }[];
  /** For "route": stop for a person to sign off this business function's own result first. Unset means yes. */
  readonly pauseFirst?: boolean;
  readonly as: string;
  readonly now?: number;
};

/**
 * Sets where a business function's results go before a person signs them
 * off. The function behind /function update --pass-on and the business
 * function page alike. Everything is checked before anything is saved.
 *
 * SIDE EFFECT: Writes or replaces one rule.
 */
export function setPassOn(input: PassOnSetting): { readonly rule: PassOnRule; readonly message: string } | Refusal {
  const checked = checkPassOn(input);
  if ("refused" in checked) return checked;
  const signed = signRule(checked.rule);
  savePassOnRule(signed);
  return { ...checked, rule: signed };
}

/**
 * What setPassOn would save, or why it would refuse, without saving it.
 *
 * SIDE EFFECT: Reads Function, staffing and Worker state.
 */
export function checkPassOn(input: PassOnSetting): { readonly rule: PassOnRule; readonly message: string } | Refusal {
  const definition = getBusinessFunctionDefinition(input.functionId);
  if (!definition || definition.enterpriseId !== input.enterpriseId) return { refused: "That business function was not found at this business." };
  const setter = signerAt(input.enterpriseId, input.as);
  if (!setter) return { refused: `Only someone at this business who can sign off work may change where results go. ${input.as.trim() || "Nobody"} cannot.` };
  if (input.mode !== "me" && input.mode !== "send" && input.mode !== "never" && input.mode !== "route") return { refused: "Choose where results go: to you, to another business function first, along a route, or never passed on." };
  let toFunctionId: string | undefined;
  let steps: RouteStep[] | undefined;
  if (input.mode === "route") {
    const wanted = (input.steps ?? []).filter((step) => step.to.trim() || step.instruction.trim());
    if (!wanted.length) return { refused: "Add at least one step to the route: a business function and what its AI worker should do." };
    if (wanted.length > MAX_ROUTE_STEPS) return { refused: `A route has at most ${MAX_ROUTE_STEPS} steps after ${definition.label}.` };
    const functions = listBusinessFunctionDefinitionsByEnterprise(input.enterpriseId);
    steps = [];
    for (const [index, step] of wanted.entries()) {
      const name = step.to.trim();
      const target = functions.find((candidate) => candidate.id === name || candidate.label.toLowerCase() === name.toLowerCase());
      const label = `Step ${index + 1}`;
      if (target?.id === definition.id) return { refused: `${label}: the route starts from ${definition.label}, so it cannot be a step too.` };
      if (target && steps.some((earlier) => earlier.functionId === target.id)) return { refused: `${label}: ${target.label} is already a step. A route goes through each business function once.` };
      const refusal = refusePassOnTarget({ enterpriseId: input.enterpriseId, fromFunctionId: definition.id, toFunctionId: target?.id ?? name });
      if (refusal) return { refused: `${label}: ${refusal}` };
      if (getPassOnRule(target!.id)?.mode === "never") return { refused: `${label}: ${target!.label} never passes its results on, so it cannot be a step of a route.` };
      const instruction = step.instruction.replace(/\s+/g, " ").trim();
      if (!instruction) return { refused: `${label}: say what ${target!.label}'s AI worker should do with what it is given.` };
      if (instruction.length > MAX_ROUTE_INSTRUCTION) return { refused: `${label}: keep the instruction under ${MAX_ROUTE_INSTRUCTION} characters.` };
      if (instruction.startsWith("-") || /[\u0000-\u001f\u007f]/.test(instruction)) return { refused: `${label}: start the instruction with a word, and use ordinary characters.` };
      steps.push({ functionId: target!.id, instruction });
    }
  }
  if (input.mode === "send") {
    const to = (input.to ?? "").trim();
    const target = listBusinessFunctionDefinitionsByEnterprise(input.enterpriseId).find((candidate) => candidate.id === to || candidate.label.toLowerCase() === to.toLowerCase());
    const refusal = refusePassOnTarget({ enterpriseId: input.enterpriseId, fromFunctionId: definition.id, toFunctionId: target?.id ?? to });
    if (refusal) return { refused: refusal };
    toFunctionId = target!.id;
  }
  const rule: PassOnRule = {
    functionId: definition.id,
    enterpriseId: input.enterpriseId,
    mode: input.mode,
    ...(toFunctionId ? { toFunctionId } : {}),
    ...(steps ? { steps, pauseFirst: input.pauseFirst !== false } : {}),
    setBy: setter,
    setAt: input.now ?? Date.now(),
    version: RULE_VERSION,
    provider: currentProviderPolicy(),
  };
  return { rule, message: `${definition.label}: ${describePassOn(rule)}` };
}

/**
 * A business function's rule, if it has one and its signature verifies. An
 * edited or unsigned rule is not followed: results then come to a person.
 *
 * SIDE EFFECT: Reads one rule and the signing secret.
 */
export function getPassOnRule(functionId: string | undefined): PassOnRule | undefined {
  const rule = functionId ? loadPassOnRule(functionId) : undefined;
  return rule && rule.functionId === functionId && verifyRule(rule) ? rule : undefined;
}

/**
 * Why a verified rule may not send a result on now (B9, C3): its setter can
 * no longer sign off work, it is for another business, or the provider
 * routing policy or model changed since it was set.
 *
 * SIDE EFFECT: Reads Worker, sign-in and settings state.
 */
export function refusePassOnRuleStanding(rule: PassOnRule, forEnterpriseId: string | undefined): StandingRefusal | undefined {
  return refuseStandingPermission({
    what: `The rule set on ${getBusinessFunctionDefinition(rule.functionId)?.label ?? "this business function"}`,
    enterpriseId: rule.enterpriseId,
    forEnterpriseId,
    setBy: rule.setBy,
    provider: rule.provider ?? "unbound",
  });
}

/**
 * Why a route's run may not take its next step (B9, C3). The rule it started
 * under must still be there, verify, be the same rule, and pass the live
 * checks. Changing or withdrawing it stops the run, saying who and when.
 *
 * SIDE EFFECT: Reads one rule, Worker, sign-in and settings state.
 */
export function refuseRouteRun(chain: RouteChain): StandingRefusal | undefined {
  const what = `The route set on ${getBusinessFunctionDefinition(chain.functionId)?.label ?? "this business function"}`;
  const stored = loadPassOnRule(chain.functionId);
  if (!stored) return standingRefusal("permission_withdrawn", { what });
  if (stored.functionId !== chain.functionId || !verifyRule(stored)) return standingRefusal("permission_unverified", { what });
  if (ruleSha256(stored) !== chain.ruleSha256) {
    return stored.mode === "route"
      ? standingRefusal("permission_changed", { what, by: stored.setBy, at: stored.setAt })
      : standingRefusal("permission_withdrawn", { what, by: stored.setBy, at: stored.setAt });
  }
  return refuseStandingPermission({
    what,
    enterpriseId: stored.enterpriseId,
    forEnterpriseId: chain.enterpriseId,
    setBy: stored.setBy,
    provider: stored.provider ?? "unbound",
  });
}

/** True when a stored rule is there but does not verify. SIDE EFFECT: Reads one rule. */
export function passOnRuleUnverified(functionId: string): boolean {
  return Boolean(loadPassOnRule(functionId)) && !getPassOnRule(functionId);
}

/** SIDE EFFECT: Deletes a removed business function's rule. */
export function removePassOnRule(functionId: string): void {
  deletePassOnRule(functionId);
}

/** SIDE EFFECT: Deletes every rule, choice and delivery. */
export function clearPassOns(): void {
  clearPersistedPassOns();
}

/**
 * A rule in a sentence.
 *
 * SIDE EFFECT: Reads the target business function's name.
 */
export function describePassOn(rule: PassOnRule | undefined): string {
  if (!rule || rule.mode === "me") return "Results come to a person to sign off.";
  if (rule.mode === "never") return "Results always come to a person to sign off, and no task can send them on.";
  if (rule.mode === "route") {
    const names = (rule.steps ?? []).map((step) => getBusinessFunctionDefinition(step.functionId)?.label ?? "another business function");
    return `Results go along a route: ${names.join(", then ")}, each step working from the one before. A person signs off each document${rule.pauseFirst !== false ? `, and this business function's own result is signed off before the route goes on` : ""}.`;
  }
  const to = getBusinessFunctionDefinition(rule.toFunctionId ?? "");
  return `Results go to ${to?.label ?? "another business function"} first, to be checked, then to a person to sign off.`;
}

/**
 * Why a task may not be given this choice, or undefined when it may. "off"
 * (bring it straight back) is always allowed; sending it on is not for a
 * business function set to "never".
 *
 * SIDE EFFECT: Reads rules, Function, staffing and Worker state.
 */
export function refusePassOnChoice(input: { readonly enterpriseId: string; readonly functionId: string; readonly choice: string }): string | undefined {
  if (input.choice === "off") return undefined;
  const rule = getPassOnRule(input.functionId);
  const from = getBusinessFunctionDefinition(input.functionId);
  if (rule?.mode === "never") return `${from?.label ?? "This business function"} never passes its results on: they always come to a person to sign off.`;
  return refusePassOnTarget({ enterpriseId: input.enterpriseId, fromFunctionId: input.functionId, toFunctionId: input.choice });
}

/** Where a business function's results go before a person signs them off, as a page shows it. */
export type PassOnView = {
  readonly mode: PassOnMode;
  readonly to?: string;
  readonly toLabel?: string;
  readonly steps?: readonly { readonly functionId: string; readonly label: string; readonly instruction: string }[];
  readonly pauseFirst?: boolean;
  readonly setBy?: string;
  readonly setAt?: number;
  /** A stored rule Arturo could not verify, so it is not followed. */
  readonly unverified?: boolean;
};

/**
 * One business function's rule, in a page's terms.
 *
 * SIDE EFFECT: Reads one rule and a Function's name.
 */
export function readPassOnView(functionId: string): PassOnView {
  const rule = getPassOnRule(functionId);
  if (!rule) return passOnRuleUnverified(functionId) ? { mode: "me", unverified: true } : { mode: "me" };
  const toLabel = rule.toFunctionId ? getBusinessFunctionDefinition(rule.toFunctionId)?.label : undefined;
  return {
    mode: rule.mode,
    ...(rule.toFunctionId ? { to: rule.toFunctionId } : {}),
    ...(toLabel ? { toLabel } : {}),
    ...(rule.steps ? { steps: rule.steps.map((step) => ({ functionId: step.functionId, label: getBusinessFunctionDefinition(step.functionId)?.label ?? "A business function that was removed", instruction: step.instruction })), pauseFirst: rule.pauseFirst !== false } : {}),
    setBy: rule.setBy,
    setAt: rule.setAt,
  };
}

/**
 * The business functions one business function's results may go to first:
 * every one refusePassOnTarget allows.
 *
 * SIDE EFFECT: Reads Function, staffing and Worker state.
 */
export function passOnTargetsFor(enterpriseId: string, functionId: string, forRoute = false): { readonly id: string; readonly label: string }[] {
  return listBusinessFunctionDefinitionsByEnterprise(enterpriseId)
    .filter((definition) => !refusePassOnTarget({ enterpriseId, fromFunctionId: functionId, toFunctionId: definition.id }))
    .filter((definition) => !forRoute || getPassOnRule(definition.id)?.mode !== "never")
    .map((definition) => ({ id: definition.id, label: definition.label }));
}

/** SIDE EFFECT: Records what was chosen for one task. */
export function recordPassOnChoice(request: PassOnRequest): void {
  savePassOnRequest(request);
}

/** SIDE EFFECT: Reads one task's choice. */
export function getPassOnChoice(jobId: string): PassOnRequest | undefined {
  return loadPassOnRequest(jobId);
}

/** The result one task was passed on from, when it is a check. SIDE EFFECT: Reads deliveries. */
export function passOnChecking(jobId: string): PassOnDelivery | undefined {
  const delivery = loadPassOnDeliveryByNext(jobId);
  return delivery && !delivery.routeStart ? delivery : undefined;
}

/** The route step one task is, if it is one. SIDE EFFECT: Reads deliveries. */
export function routeStepOf(jobId: string): PassOnDelivery | undefined {
  const delivery = loadPassOnDeliveryByNext(jobId);
  return delivery?.routeStart ? delivery : undefined;
}

/** How one result was passed on, if it was. SIDE EFFECT: Reads deliveries. */
export function passOnOf(sourceJobId: string): PassOnDelivery | undefined {
  return loadPassOnDelivery(sourceJobId);
}
