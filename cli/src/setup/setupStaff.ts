/**
 * The /setup staff step (step 3 of 4): people and AI workers, before any
 * work can start (setup-and-staff final v3).
 *
 * "Just me" sets the sign-off role automatically, through setSignOffRight,
 * including creating the account. Bot mode refuses "Just me" and never
 * registers a signer; if a signer is already in place, the bot names them.
 *
 * A locked or people-only Function is staffed with a signer and no AI
 * worker. Every other Function needs an AI worker plus a signer. There is
 * no way to add an AI worker to a locked or people-only Function.
 *
 * Anything that creates something is a numbered option that names it. A
 * bare "y" or "yes" is never accepted. The summary never says "Staff complete".
 */

import type { WorkStreamEntry } from "../ui/uiState";
import { isInteractiveSession } from "../core/interactivity";
import { addWorker, createHumanWorker, getWorker, registerAiWorker } from "../control/workers";
import { assignWorkerOwnership, getWorkerOwnership } from "../identity/organisationIdentity";
import { listPeople, maySignOff, setSignOffRight } from "../identity/companySignIn";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { effectiveFunctionMark, isBlockingFunctionMark } from "../business/functionMark";
import { listStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { setDraftsFor } from "../staffing/draftsFor";
import { businessHasSigner, refuseStaffNotReady } from "../business/staffCheck";
import { MAX_SETUP_NAME, tidySetupText, wrapSetupText } from "./setupSaves";
import type { AgentArchetype } from "../agents/agentArchetype";

export type StaffBack = { readonly back: true };

type RoleOption = {
  readonly summary: string;
  readonly archetype?: AgentArchetype;
  readonly canSignOff: boolean;
  readonly opensFullList?: boolean;
};

/** Staff-step wording: does not say "approve". Tama also updates the older /add-human-worker list. */
const ROLE_OPTIONS: readonly RoleOption[] = [
  { summary: "Sign off work and give go-aheads. If it's just you, this is you.", archetype: "guardian", canSignOff: true },
  { summary: "Review work before it's delivered (can also sign off work and give go-aheads).", archetype: "reviewer", canSignOff: true },
  { summary: "Just do the tasks they're given (cannot sign off work or give go-aheads).", canSignOff: false },
];

type StaffState =
  | { readonly stage: "just-you"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "just-me-name"; readonly enterpriseId: string }
  | { readonly stage: "just-me-confirm"; readonly enterpriseId: string; readonly name: string }
  | { readonly stage: "person-name"; readonly enterpriseId: string }
  | { readonly stage: "person-role"; readonly enterpriseId: string; readonly name: string }
  | { readonly stage: "person-confirm"; readonly enterpriseId: string; readonly name: string; readonly option: RoleOption }
  | { readonly stage: "people-next"; readonly enterpriseId: string }
  | { readonly stage: "ai-pick"; readonly enterpriseId: string; readonly as: string; readonly functionIds: readonly string[]; readonly index: number }
  | { readonly stage: "ai-name"; readonly enterpriseId: string; readonly as: string; readonly functionIds: readonly string[]; readonly index: number }
  | { readonly stage: "drafts-ask"; readonly enterpriseId: string; readonly as: string; readonly functionIds: readonly string[]; readonly index: number; readonly worker: string }
  | { readonly stage: "drafts-who"; readonly enterpriseId: string; readonly as: string; readonly functionIds: readonly string[]; readonly index: number; readonly worker: string }
  | { readonly stage: "drafts-signer"; readonly enterpriseId: string; readonly as: string; readonly functionIds: readonly string[]; readonly index: number; readonly worker: string; readonly draftsFor: string };

let pending: StaffState | undefined;

export function isStaffStepActive(): boolean {
  return pending !== undefined;
}

export function isStaffStepAtStart(): boolean {
  return pending?.stage === "just-you";
}

export function clearStaffStep(): void {
  pending = undefined;
}

function entry(label: string, body: string): WorkStreamEntry {
  const footer = ["", "b  Back", "q  Quit"].join("\n");
  return {
    actor: "Arturo",
    label: "Step 3 of 4",
    body: wrapSetupText(`${label}\n\n${body}${footer}`),
  };
}

function choice(reply: string, max: number): number | undefined {
  const n = Number(reply.trim());
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
}

function proposedAiName(label: string): string {
  return `${label} drafter`;
}

function functionsOf(enterpriseId: string) {
  return listBusinessFunctionDefinitionsByEnterprise(enterpriseId);
}

function needsAi(functionId: string): boolean {
  return !isBlockingFunctionMark(effectiveFunctionMark(functionId));
}

function hasAi(functionId: string): boolean {
  return listStaffingAssignments(functionId).some((row) => row.role === "ai" && row.workerName.trim());
}

function functionsNeedingAi(enterpriseId: string): string[] {
  return functionsOf(enterpriseId).filter((row) => needsAi(row.id) && !hasAi(row.id)).map((row) => row.id);
}

/**
 * The terminal staff list: each person's sign-off column is maySignOff
 * (the grant), not Function approvers. This is the Tama staff list.
 *
 * SIDE EFFECT: Reads people and grants.
 */
export function formatStaffList(enterpriseId: string): string {
  const people = listPeople(enterpriseId);
  if (people.length === 0) return "Nobody is on the staff list yet.";
  return people.map((person) => {
    const right = person.canSignOff
      ? "can sign off work and give go-aheads"
      : "cannot sign off work or give go-aheads";
    return `${person.name}: ${right}.`;
  }).join("\n");
}

/**
 * Plain-words staff summary, never "Staff complete". SIDE EFFECT: Reads staff, marks and grants.
 */
export function formatStaffSummary(enterpriseId: string): string {
  const lines: string[] = [];
  const signer = listPeople(enterpriseId).find((person) => person.canSignOff && person.status !== "suspended");
  const signerName = signer?.name ?? "someone who can sign off";
  for (const definition of functionsOf(enterpriseId)) {
    const mark = effectiveFunctionMark(definition.id);
    const assignments = listStaffingAssignments(definition.id);
    const ai = assignments.find((row) => row.role === "ai" && row.workerName.trim())?.workerName;
    if (isBlockingFunctionMark(mark)) {
      const kind = mark === "locked" ? "locked" : "people only";
      const why = mark === "people-only" ? "people only (your choice)" : "locked";
      lines.push(`${definition.label}: ${why}. No AI. ${signerName} does the work and signs off. There is no way to add an AI worker to it.`);
      void kind;
    } else if (ai) {
      lines.push(`${definition.label}: drafted by the ${ai} (AI worker), signed off by ${signerName}. Signing off records that you read it, not that it is correct.`);
    } else {
      lines.push(`${definition.label}: still needs an AI worker. ${signerName} will sign off.`);
    }
  }
  return [formatStaffList(enterpriseId), "", ...lines].join("\n");
}

function botRefusal(enterpriseId: string): readonly WorkStreamEntry[] {
  pending = undefined;
  if (businessHasSigner(enterpriseId)) {
    const signer = listPeople(enterpriseId).find((person) => person.canSignOff && person.status !== "suspended");
    return [entry(
      "Bot mode.",
      `The signer is already ${signer?.name ?? "set"}. Bot mode cannot register anyone who can sign off, and it refuses "Just me". Finish staff in an interactive session, or add AI workers with /staff.`,
    )];
  }
  return [entry(
    "Bot mode.",
    'Bot mode cannot register anyone who can sign off, and it refuses "Just me". Set up a signer first, then continue in an interactive session.',
  )];
}

/**
 * Opens the staff step at "Just you?", or names the existing signer in bot mode.
 * SIDE EFFECT: Starts a guided menu. Does not write until the person answers.
 */
export function startStaffStep(enterpriseId: string, as?: string): readonly WorkStreamEntry[] {
  if (!isInteractiveSession()) return botRefusal(enterpriseId);
  pending = { stage: "just-you", enterpriseId, ...(as ? { as } : {}) };
  return [entry(
    "Just you?",
    [
      "Is it just you, or you and others?",
      "",
      "1  Just me",
      "2  Me and others",
    ].join("\n"),
  )];
}

function askJustMeName(enterpriseId: string): readonly WorkStreamEntry[] {
  pending = { stage: "just-me-name", enterpriseId };
  return [entry("Your name.", "What should Arturo call you?")];
}

function askJustMeConfirm(enterpriseId: string, name: string): readonly WorkStreamEntry[] {
  pending = { stage: "just-me-confirm", enterpriseId, name };
  return [entry(
    "Just you.",
    [
      `You give the go-ahead and sign off yourself, with no second check. Arturo will record ${name} as able to sign off work and give go-aheads.`,
      "",
      `1  Continue as ${name}`,
    ].join("\n"),
  )];
}

function registerSigner(enterpriseId: string, name: string): string | undefined {
  const tidy = tidySetupText(name);
  if (!tidy) return "Say what Arturo should call you.";
  if (tidy.length > MAX_SETUP_NAME) return `Keep the name under ${MAX_SETUP_NAME} characters.`;
  const existing = getWorker(tidy);
  if (existing && existing.kind !== "human") return `The name ${tidy} is already used in Arturo. Use your full name, or a slightly different one.`;
  if (existing && getWorkerOwnership(tidy) && getWorkerOwnership(tidy)?.enterpriseId !== enterpriseId) {
    return `The name ${tidy} is already used in Arturo. Use your full name, or a slightly different one.`;
  }
  if (!existing) addWorker(createHumanWorker(tidy, "guardian"));
  if (!getWorkerOwnership(tidy) || getWorkerOwnership(tidy)?.enterpriseId !== enterpriseId) {
    assignWorkerOwnership({ workerName: tidy, enterpriseId });
  }
  const granted = setSignOffRight({ enterpriseId, person: tidy, canSignOff: true, actor: undefined });
  if ("refused" in granted) return granted.refused;
  return undefined;
}

function goToPeopleOrAi(enterpriseId: string, as: string, addAnotherPerson: boolean): readonly WorkStreamEntry[] {
  if (addAnotherPerson) {
    pending = { stage: "person-name", enterpriseId };
    return [entry("A person.", "What is their name? (A name only — Arturo will not ask for an email address.)")];
  }
  return startAiOrSummary(enterpriseId, as);
}

function startAiOrSummary(enterpriseId: string, as: string): readonly WorkStreamEntry[] {
  const needed = functionsNeedingAi(enterpriseId);
  if (needed.length === 0) return finishIfReady(enterpriseId);
  pending = { stage: "ai-pick", enterpriseId, as, functionIds: needed, index: 0 };
  return [aiPickScreen(enterpriseId, needed, 0)];
}

function aiPickScreen(enterpriseId: string, functionIds: readonly string[], index: number): WorkStreamEntry {
  const definition = functionsOf(enterpriseId).find((row) => row.id === functionIds[index]);
  const label = definition?.label ?? "This Function";
  const proposed = proposedAiName(label);
  const blocked = functionsOf(enterpriseId).filter((row) => isBlockingFunctionMark(effectiveFunctionMark(row.id)));
  const notes = blocked.map((row) => {
    const mark = effectiveFunctionMark(row.id);
    const kind = mark === "locked" ? "locked" : "people only";
    return `${row.label} is ${kind}, so it has no AI worker. A person does the work and signs off. There is no way to add an AI worker to it.`;
  });
  return entry(
    "AI workers.",
    [
      ...notes,
      notes.length ? "" : "",
      `${label} needs an AI worker.`,
      "",
      `1  Add "${proposed}" (AI worker)`,
      "2  I'll name one",
    ].filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== "")).join("\n"),
  );
}

function addAiWorker(enterpriseId: string, functionId: string, name: string): string | undefined {
  const tidy = tidySetupText(name);
  if (!tidy) return "Name the AI worker.";
  if (isBlockingFunctionMark(effectiveFunctionMark(functionId))) {
    const definition = functionsOf(enterpriseId).find((row) => row.id === functionId);
    const mark = effectiveFunctionMark(functionId);
    const kind = mark === "locked" ? "locked" : "people only";
    return `${definition?.label ?? "This Function"} is ${kind}, so it cannot have an AI worker. A person does the work and signs off.`;
  }
  const existing = getWorker(tidy);
  if (existing && existing.kind !== "ai") return `The name ${tidy} is already used in Arturo. Choose a different name.`;
  if (!existing) registerAiWorker(tidy, "creator");
  saveStaffingAssignment({ businessFunctionId: functionId, workerName: tidy, role: "ai", rationale: "Added in the staff step." });
  return undefined;
}

function afterAiAdded(enterpriseId: string, as: string, functionIds: readonly string[], index: number, worker: string): readonly WorkStreamEntry[] {
  pending = { stage: "drafts-ask", enterpriseId, as, functionIds, index, worker };
  return [entry(
    "Drafts for.",
    [
      `Should ${worker} draft for a named person? This is a signed standing permission called "drafts for".`,
      "",
      "1  It drafts for a person",
      "2  It works on its own",
    ].join("\n"),
  )];
}

function nextAiOrFinish(enterpriseId: string, as: string, functionIds: readonly string[], index: number): readonly WorkStreamEntry[] {
  if (index + 1 < functionIds.length) {
    pending = { stage: "ai-pick", enterpriseId, as, functionIds, index: index + 1 };
    return [aiPickScreen(enterpriseId, functionIds, index + 1)];
  }
  return finishIfReady(enterpriseId);
}

function finishIfReady(enterpriseId: string): readonly WorkStreamEntry[] {
  pending = undefined;
  const missing = refuseStaffNotReady(enterpriseId);
  const body = missing
    ? `Staff are not done yet.\n\n${missing}\n\n${formatStaffSummary(enterpriseId)}`
    : `Staff are in place. Work can start once you give a go-ahead on the first Task.\n\n${formatStaffSummary(enterpriseId)}`;
  return [entry("Staff.", body)];
}

function registerPerson(enterpriseId: string, name: string, option: RoleOption): string | undefined {
  const tidy = tidySetupText(name);
  if (!tidy) return "Say their name.";
  if (getWorker(tidy) && getWorker(tidy)?.kind !== "human") return `The name ${tidy} is already used in Arturo.`;
  if (!getWorker(tidy)) addWorker(createHumanWorker(tidy, option.archetype));
  if (!getWorkerOwnership(tidy) || getWorkerOwnership(tidy)?.enterpriseId !== enterpriseId) {
    assignWorkerOwnership({ workerName: tidy, enterpriseId });
  }
  if (option.canSignOff) {
    const granted = setSignOffRight({ enterpriseId, person: tidy, canSignOff: true, actor: undefined });
    if ("refused" in granted) return granted.refused;
  }
  return undefined;
}

/**
 * Handles a reply to the staff step. Returns { back: true } on the first
 * screen so /setup can go back to step 2.
 * SIDE EFFECT: May write a person, a grant, an AI worker, an assignment or a drafts-for permission.
 */
export function replyToStaffStep(reply: string): readonly WorkStreamEntry[] | StaffBack {
  if (!pending) return [];
  const trimmed = reply.trim();
  const yes = ["y", "yes"].includes(trimmed.toLowerCase());

  if (pending.stage === "just-you") {
    if (trimmed.toLowerCase() === "b" || trimmed.toLowerCase() === "back" || trimmed.toLowerCase() === "esc") {
      clearStaffStep();
      return { back: true };
    }
    if (!isInteractiveSession()) return botRefusal(pending.enterpriseId);
    const picked = choice(trimmed, 2);
    if (yes || !picked) return [entry("Just you?", 'Reply 1 for "Just me", or 2 for "Me and others". A bare yes is not accepted.')];
    if (picked === 1) {
      if (pending.as) return askJustMeConfirm(pending.enterpriseId, pending.as);
      return askJustMeName(pending.enterpriseId);
    }
    pending = { stage: "person-name", enterpriseId: pending.enterpriseId };
    return [entry("A person.", "What is their name? (A name only — Arturo will not ask for an email address.)")];
  }

  if (pending.stage === "just-me-name") {
    const name = tidySetupText(trimmed);
    if (!name) return askJustMeName(pending.enterpriseId);
    return askJustMeConfirm(pending.enterpriseId, name);
  }

  if (pending.stage === "just-me-confirm") {
    if (yes || choice(trimmed, 1) !== 1) {
      return [entry("Just you.", `Reply 1 to continue as ${pending.name}. A bare yes is not accepted.`)];
    }
    if (!isInteractiveSession()) return botRefusal(pending.enterpriseId);
    const problem = registerSigner(pending.enterpriseId, pending.name);
    if (problem) return [entry("Just you.", problem)];
    return startAiOrSummary(pending.enterpriseId, pending.name);
  }

  if (pending.stage === "person-name") {
    const name = tidySetupText(trimmed);
    if (!name) return [entry("A person.", "What is their name?")];
    pending = { stage: "person-role", enterpriseId: pending.enterpriseId, name };
    return [entry(
      "Their role.",
      [
        `What does ${name} do? Each option says whether they can give go-aheads and sign off.`,
        "",
        ...ROLE_OPTIONS.map((option, index) => `${index + 1}  ${option.summary}`),
      ].join("\n"),
    )];
  }

  if (pending.stage === "person-role") {
    const picked = choice(trimmed, ROLE_OPTIONS.length);
    if (!picked) return [entry("Their role.", `Reply with a number from 1 to ${ROLE_OPTIONS.length}.`)];
    const option = ROLE_OPTIONS[picked - 1]!;
    pending = { stage: "person-confirm", enterpriseId: pending.enterpriseId, name: pending.name, option };
    const right = option.canSignOff
      ? `${pending.name} will be able to sign off work and give go-aheads.`
      : `${pending.name} will not be able to sign off work or give go-aheads.`;
    return [entry(
      "Confirm.",
      [
        right,
        "",
        `1  Add ${pending.name}`,
      ].join("\n"),
    )];
  }

  if (pending.stage === "person-confirm") {
    if (yes || choice(trimmed, 1) !== 1) {
      return [entry("Confirm.", `Reply 1 to add ${pending.name}. A bare yes is not accepted.`)];
    }
    const problem = registerPerson(pending.enterpriseId, pending.name, pending.option);
    if (problem) return [entry("A person.", problem)];
    const added = pending.name;
    pending = { stage: "people-next", enterpriseId: pending.enterpriseId };
    return [entry(
      "People.",
      [
        `${added} is on the staff list.`,
        "",
        "1  Add another person",
        "2  Next: AI workers",
      ].join("\n"),
    )];
  }

  if (pending.stage === "people-next") {
    const picked = choice(trimmed, 2);
    if (!picked) return [entry("People.", "Reply 1 to add another person, or 2 for AI workers.")];
    const signer = listPeople(pending.enterpriseId).find((person) => person.canSignOff)?.name ?? "the owner";
    return goToPeopleOrAi(pending.enterpriseId, signer, picked === 1);
  }

  if (pending.stage === "ai-pick") {
    const picked = choice(trimmed, 2);
    if (!picked) return [entry("AI workers.", 'Reply 1 to add the named AI worker, or 2 to name one. A bare yes is not accepted.')];
    const functionId = pending.functionIds[pending.index]!;
    if (picked === 2) {
      pending = { stage: "ai-name", enterpriseId: pending.enterpriseId, as: pending.as, functionIds: pending.functionIds, index: pending.index };
      return [entry("AI workers.", "What should the AI worker be called?")];
    }
    const definition = functionsOf(pending.enterpriseId).find((row) => row.id === functionId);
    const name = proposedAiName(definition?.label ?? "Function");
    const problem = addAiWorker(pending.enterpriseId, functionId, name);
    if (problem) return [entry("AI workers.", problem)];
    return afterAiAdded(pending.enterpriseId, pending.as, pending.functionIds, pending.index, name);
  }

  if (pending.stage === "ai-name") {
    const functionId = pending.functionIds[pending.index]!;
    const problem = addAiWorker(pending.enterpriseId, functionId, trimmed);
    if (problem) return [entry("AI workers.", problem)];
    return afterAiAdded(pending.enterpriseId, pending.as, pending.functionIds, pending.index, tidySetupText(trimmed));
  }

  if (pending.stage === "drafts-ask") {
    const picked = choice(trimmed, 2);
    if (!picked) return [entry("Drafts for.", "Reply 1 if it drafts for a person, or 2 if it works on its own.")];
    if (picked === 2) return nextAiOrFinish(pending.enterpriseId, pending.as, pending.functionIds, pending.index);
    pending = { stage: "drafts-who", enterpriseId: pending.enterpriseId, as: pending.as, functionIds: pending.functionIds, index: pending.index, worker: pending.worker };
    return [entry("Drafts for.", `Who does ${pending.worker} draft for?`)];
  }

  if (pending.stage === "drafts-who") {
    const who = tidySetupText(trimmed);
    if (!who) return [entry("Drafts for.", `Who does ${pending.worker} draft for?`)];
    if (maySignOff(pending.enterpriseId, who) || listPeople(pending.enterpriseId).some((person) => person.name.toLowerCase() === who.toLowerCase() && person.canSignOff)) {
      const set = setDraftsFor({ enterpriseId: pending.enterpriseId, aiWorker: pending.worker, draftsFor: who, actor: undefined, as: pending.as });
      if ("refused" in set) return [entry("Drafts for.", set.refused)];
      return nextAiOrFinish(pending.enterpriseId, pending.as, pending.functionIds, pending.index);
    }
    const person = listPeople(pending.enterpriseId).find((row) => row.name.toLowerCase() === who.toLowerCase());
    if (!person) return [entry("Drafts for.", `There is no person called ${who} at this business. Who does ${pending.worker} draft for?`)];
    pending = { stage: "drafts-signer", enterpriseId: pending.enterpriseId, as: pending.as, functionIds: pending.functionIds, index: pending.index, worker: pending.worker, draftsFor: person.name };
    const signers = listPeople(pending.enterpriseId).filter((row) => row.canSignOff && row.status !== "suspended");
    return [entry(
      "Who signs off.",
      [
        `${person.name} cannot sign off work at this business. Who should sign off these drafts? Choose someone who can sign off.`,
        "",
        ...signers.map((row, index) => `${index + 1}  ${row.name}`),
      ].join("\n"),
    )];
  }

  if (pending.stage === "drafts-signer") {
    const signers = listPeople(pending.enterpriseId).filter((row) => row.canSignOff && row.status !== "suspended");
    const picked = choice(trimmed, signers.length);
    if (!picked) return [entry("Who signs off.", "Reply with the number of someone who can sign off.")];
    const set = setDraftsFor({
      enterpriseId: pending.enterpriseId,
      aiWorker: pending.worker,
      draftsFor: pending.draftsFor,
      signer: signers[picked - 1]!.name,
      actor: undefined,
      as: pending.as,
    });
    if ("refused" in set) return [entry("Drafts for.", set.refused)];
    return nextAiOrFinish(pending.enterpriseId, pending.as, pending.functionIds, pending.index);
  }

  return [];
}
