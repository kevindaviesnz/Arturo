/**
 * Hand-offs: when a result from one Function is signed off, it goes to a
 * named person as a Human Task.
 *
 * A Function's work reached the next step of the business only when someone
 * remembered to type /create-human-task --follows. Nothing connected Design
 * Briefs to the designer, so a signed-off brief simply sat there, and the
 * overview could show how one Task led to another but never how the business
 * moved work along.
 *
 * The trigger is the sign-off and nothing else. It is not a model's judgment
 * that more work is needed (that is follow-on work, which is separate and off
 * by default), and it never fires for a result nobody has accepted: an
 * AI-written result reaches a person's desk only once a person has read it.
 * Because it runs inside signOffTaskResult, the terminal and the browser
 * hand over in exactly the same way, and a result is handed over once
 * however many times anyone tries.
 *
 * It creates a Human Task and nothing more. It does not reach outside Arturo.
 */

import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { listWorkers } from "../control/workers";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { getWorkerOwnership } from "../identity/organisationIdentity";
import {
  clearPersistedHandOffs,
  deleteHandOff,
  loadHandOffDeliveries,
  loadHandOffs,
  saveHandOff,
  saveHandOffDelivery,
  saveHandOffDeliveryOnce,
} from "../storage/handOffRepository";
import { createHumanTask } from "./humanTaskStore";
import type { Job } from "./jobQueue";
import { refuseUnacceptedHandOver } from "./resultSignOff";
import crypto from "node:crypto";
import { getLocalApprovalSigningSecret } from "./runtimeSecrets";
import { appendRuntimeEventToStore } from "./runtimeEventStore";
import { refuseStandingPermission, setterStillSigns, standingRefusal } from "./standingPermission";
import { peopleOf } from "../clients/clientCommands";

export type HandOff = {
  readonly functionId: string;
  readonly enterpriseId: string;
  /** The registered person the work goes to. */
  readonly to: string;
  /** What they are asked to do with the result. */
  readonly task: string;
  readonly createdAt: number;
  /**
   * Who set it, by the name Arturo knows them by. A hand-off is a standing
   * permission (B9): it counts only while its setter can sign off work here.
   */
  readonly setBy?: string;
  /** HANDOFF_VERSION. A hand-off saved before hand-offs were signed counts as off until set again. */
  readonly version?: number;
  /** HMAC over everything above, so an edited hand-off is not followed. */
  readonly signature?: string;
};

/** The current signature version of a hand-off. */
export const HANDOFF_VERSION = 1;

/** PURE: No side effects. */
function handOffPayload(handOff: HandOff): string {
  return JSON.stringify({
    purpose: "hand-off",
    version: HANDOFF_VERSION,
    functionId: handOff.functionId,
    enterpriseId: handOff.enterpriseId,
    to: handOff.to,
    task: handOff.task,
    createdAt: handOff.createdAt,
    setBy: handOff.setBy ?? "",
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function signHandOff(handOff: HandOff): HandOff {
  const { signature: _old, ...unsigned } = handOff;
  return { ...unsigned, version: HANDOFF_VERSION, signature: crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(handOffPayload(unsigned)).digest("hex") };
}

/** SIDE EFFECT: Reads the signing secret. */
export function verifyHandOff(handOff: HandOff): boolean {
  if (handOff.version !== HANDOFF_VERSION || !handOff.setBy) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(handOffPayload(handOff)).digest("hex"));
  const actual = Buffer.from(String(handOff.signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** The fixed refusal when someone who cannot sign off work tries to set a hand-off. PURE. */
export function handOffSetterRefusal(as: string): string {
  return `Only someone at this business who can sign off work may set where its signed-off results go. ${as.trim() || "Nobody"} cannot. Say who is setting it.`;
}

export type HandOffDelivery = {
  readonly functionId: string;
  readonly jobId: string;
  readonly humanTaskId: string;
  readonly to: string;
  readonly signedOffBy: string;
  readonly deliveredAt: number;
};

/** The longest instruction a hand-off may carry. */
export const MAX_HAND_OFF_TASK_LENGTH = 500;

const humanNamed = (name: string) =>
  listWorkers().find(
    (worker) =>
      worker.kind === "human" &&
      (worker.name.toLowerCase() === name.toLowerCase() ||
        worker.displayName?.toLowerCase() === name.toLowerCase())
  );

/**
 * Why a hand-off to this person with this instruction would be refused, or
 * undefined. Callers that change anything else first check this, so a refused
 * hand-off changes nothing.
 *
 * SIDE EFFECT: Reads the Worker registry.
 */
export function refuseHandOff(input: {
  readonly to: string;
  readonly task: string;
  /**
   * The business whose results would be handed over. When given, the person
   * must work there: one business's signed-off results never go to another
   * business's people. setHandOff always gives it.
   */
  readonly enterpriseId?: string;
  /** Who is setting it. When given with the business, they must be able to sign off work there. */
  readonly as?: string;
}): string | undefined {
  const task = input.task.replace(/\s+/g, " ").trim();
  if (!task) return 'Say what the person should do with each result, for example --hand-off-task "Design the garment this brief describes".';
  if (task.length > MAX_HAND_OFF_TASK_LENGTH) return `Keep the hand-off instruction under ${MAX_HAND_OFF_TASK_LENGTH} characters.`;
  const person = humanNamed(input.to.trim());
  if (!person) {
    return `${input.to} is not a registered person. A result can only be handed to a Human Worker; add them with /add-human-worker first.`;
  }
  if (input.enterpriseId !== undefined && getWorkerOwnership(person.name)?.enterpriseId !== input.enterpriseId) {
    const business = getEnterprise(input.enterpriseId)?.name ?? input.enterpriseId;
    return `${person.displayName ?? person.name} does not work at ${business}, so ${business}'s results cannot be handed to them. Hand them to someone who works there, or add this person to ${business} first.`;
  }
  if (input.as !== undefined && input.enterpriseId !== undefined && !setterStillSigns(input.enterpriseId, input.as)) {
    return handOffSetterRefusal(input.as);
  }
  return undefined;
}

/**
 * Sets, or replaces, where a Function's signed-off results go. Refuses before
 * writing anything.
 *
 * SIDE EFFECT: May write the runtime database.
 */
export function setHandOff(input: {
  readonly functionId: string;
  readonly to: string;
  readonly task: string;
  /** Who is setting it: someone at the business who can sign off work. */
  readonly as: string;
  readonly now?: number;
}): { readonly handOff: HandOff } | { readonly refused: string } {
  const definition = getBusinessFunctionDefinition(input.functionId);
  if (!definition) return { refused: `No Function found with id ${input.functionId}.` };
  const refusal = refuseHandOff({ to: input.to, task: input.task, enterpriseId: definition.enterpriseId, as: input.as });
  if (refusal) return { refused: refusal };
  const task = input.task.replace(/\s+/g, " ").trim();
  const person = humanNamed(input.to.trim())!;
  const handOff: HandOff = {
    functionId: definition.id,
    enterpriseId: definition.enterpriseId,
    to: person.displayName ?? person.name,
    task,
    createdAt: input.now ?? Date.now(),
    setBy: peopleNamed(definition.enterpriseId, input.as),
  };
  const signed = signHandOff(handOff);
  saveHandOff(signed);
  return { handOff: signed };
}

/** The setter by the name Arturo knows them by. SIDE EFFECT: Reads Worker state. */
function peopleNamed(enterpriseId: string, as: string): string {
  const wanted = as.trim().toLowerCase();
  return peopleOf(enterpriseId).find((name) => name.toLowerCase() === wanted) ?? as.trim();
}

/**
 * Why a hand-off may not hand a result over now (B9): it does not verify (an
 * edited one, or one saved before hand-offs were signed), its setter can no
 * longer sign off work here, or it is for another business.
 *
 * SIDE EFFECT: Reads the signing secret, Worker and sign-in state.
 */
export function refuseHandOffStanding(handOff: HandOff, forEnterpriseId: string | undefined): string | undefined {
  const what = `The hand-off set on ${getBusinessFunctionDefinition(handOff.functionId)?.label ?? "this business function"}`;
  if (!verifyHandOff(handOff)) return standingRefusal("permission_unverified", { what }).message;
  return refuseStandingPermission({ what, enterpriseId: handOff.enterpriseId, forEnterpriseId, setBy: handOff.setBy ?? "" })?.message;
}

/** SIDE EFFECT: May delete one row from the runtime database. */
export function removeHandOff(functionId: string): boolean {
  const exists = loadHandOffs().some((handOff) => handOff.functionId === functionId);
  if (exists) deleteHandOff(functionId);
  return exists;
}

/** SIDE EFFECT: Reads the runtime database. */
export function getHandOff(functionId: string | undefined): HandOff | undefined {
  return functionId ? loadHandOffs().find((handOff) => handOff.functionId === functionId) : undefined;
}

/** SIDE EFFECT: Reads the runtime database. */
export function listHandOffs(): HandOff[] {
  return loadHandOffs();
}

/** SIDE EFFECT: Reads the runtime database. */
export function listHandOffDeliveries(): HandOffDelivery[] {
  return loadHandOffDeliveries();
}

/** SIDE EFFECT: Deletes every hand-off and its history. */
export function clearHandOffs(): void {
  clearPersistedHandOffs();
}

/**
 * PURE: No side effects.
 */
export function describeHandOff(handOff: HandOff): string {
  return `when a result is signed off, it goes to ${handOff.to} to "${handOff.task}"`;
}

export type HandOffOutcome =
  | { readonly handed: true; readonly humanTaskId: string; readonly to: string; readonly message: string }
  | { readonly handed: false; readonly message?: string };

/**
 * Hands a just-signed-off result to the person its Function names, once.
 *
 * Called by signOffTaskResult after the sign-off is recorded, and by nothing
 * else. Checks again that the result is accepted rather than trusting the
 * caller, so it cannot hand over a result whose sign-off does not verify.
 *
 * SIDE EFFECT: May create a Human Task and write the runtime database.
 */
export function deliverHandOff(job: Job, signedOffBy: string, now = Date.now()): HandOffOutcome {
  const handOff = getHandOff(job.businessFunctionId);
  if (!handOff || job.status !== "completed") return { handed: false };
  if (refuseUnacceptedHandOver(job)) {
    return { handed: false, message: `Not handed to ${handOff.to}: the sign-off of ${job.id} could not be confirmed.` };
  }
  // A standing permission, checked live before it acts (B9).
  const standing = refuseHandOffStanding(handOff, job.enterpriseId ?? getBusinessFunctionDefinition(handOff.functionId)?.enterpriseId);
  if (standing) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.hand_off.stopped",
      level: "warn",
      message: `Task ${job.id} was not handed to ${handOff.to}: ${standing}`,
      timestamp: now,
      payload: { jobId: job.id, functionId: handOff.functionId, to: handOff.to },
    });
    return { handed: false, message: `Not handed to ${handOff.to}: ${standing}` };
  }
  if (loadHandOffDeliveries().some((delivery) => delivery.functionId === handOff.functionId && delivery.jobId === job.id)) {
    return { handed: false };
  }

  const person = humanNamed(handOff.to);
  const label = getBusinessFunctionDefinition(handOff.functionId)?.label ?? handOff.functionId;
  // Claim the delivery before creating anything, so two sign-off paths racing
  // cannot both create a Human Task.
  const claimed = saveHandOffDeliveryOnce({
    functionId: handOff.functionId,
    jobId: job.id,
    humanTaskId: "",
    to: handOff.to,
    signedOffBy,
    deliveredAt: now,
  });
  if (!claimed) return { handed: false };

  const humanTask = createHumanTask({
    title: `${handOff.task} (from ${job.id})`,
    owner: person ? person.displayName ?? person.name : undefined,
    purpose: `Hand-off from ${label}: ${job.id} was signed off by ${signedOffBy}.`,
    instructions: [
      handOff.task,
      "",
      `Work from the result of ${job.id}, which ${signedOffBy} signed off. Open it with /task inspect ${job.id}.`,
    ].join("\n"),
    handoverJobId: job.id,
    inputArtefactRefs: job.inputArtefactRefs,
  });
  saveHandOffDelivery({
    functionId: handOff.functionId,
    jobId: job.id,
    humanTaskId: humanTask.id,
    to: handOff.to,
    signedOffBy,
    deliveredAt: now,
  });

  return {
    handed: true,
    humanTaskId: humanTask.id,
    to: handOff.to,
    message: person
      ? `Handed to ${handOff.to} as ${humanTask.id}: ${handOff.task}\nInspect with /human-task ${humanTask.id} or complete with /complete-human-task ${humanTask.id} "<notes>" --as "${handOff.to}".`
      : `${handOff.to} is no longer registered, so ${humanTask.id} was created with nobody assigned: ${handOff.task}`,
  };
}

