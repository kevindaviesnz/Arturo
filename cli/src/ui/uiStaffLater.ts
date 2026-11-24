/**
 * The later staff menu: add, change, remove or show staff, have AI
 * workers suggested, or name a new signer for handed-back drafts
 * (setup-and-staff final v3, 4h). The menu offers no AI worker for a
 * locked or people-only Function, and says why.
 *
 * SIDE EFFECT: Reads and writes staff, marks, drafts-for and hand-backs.
 */

import type { WorkStreamEntry } from "./uiState";
import { isInteractiveSession } from "../core/interactivity";
import { addWorker, createHumanWorker, getWorker, listWorkers, registerAiWorker } from "../control/workers";
import { safelyRemoveWorker } from "../control/workerRemoval";
import { assignWorkerOwnership, getWorkerOwnership } from "../identity/organisationIdentity";
import { isOwner, listPeople, maySignOff, setSignOffRight, type Account } from "../identity/companySignIn";
import { listEnterprises } from "../enterprise/enterpriseStore";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { effectiveFunctionMark, isBlockingFunctionMark } from "../business/functionMark";
import { listStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { setDraftsFor } from "../staffing/draftsFor";
import { recordStaffChangeEvent } from "../staffing/staffChanges";
import {
  eligibleHandBackSigners,
  formatHandBackWaitingSection,
  listOpenHandBacks,
  nameHandBackSigner,
} from "../staffing/handBack";
import { formatStaffList } from "../setup/setupStaff";
import { MAX_SETUP_NAME, tidySetupText, wrapSetupText } from "../setup/setupSaves";
import { handleUiStaffCommand } from "./uiStaffingEntries";

type LaterState =
  | { readonly stage: "menu"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "person-name"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "person-role"; readonly enterpriseId: string; readonly as?: string; readonly name: string }
  | { readonly stage: "ai-function"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "ai-name"; readonly enterpriseId: string; readonly as?: string; readonly functionId: string }
  | { readonly stage: "role-who"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "role-what"; readonly enterpriseId: string; readonly as?: string; readonly person: string }
  | { readonly stage: "drafts-worker"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "drafts-who"; readonly enterpriseId: string; readonly as?: string; readonly worker: string }
  | { readonly stage: "remove-who"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "handback-pick"; readonly enterpriseId: string; readonly as?: string }
  | { readonly stage: "handback-who"; readonly enterpriseId: string; readonly as?: string; readonly jobId: string; readonly names: readonly string[] }
  | { readonly stage: "handback-reason"; readonly enterpriseId: string; readonly as?: string; readonly jobId: string; readonly signer: string };

let pending: LaterState | undefined;

export function isLaterStaffActive(): boolean {
  return pending !== undefined;
}

export function clearLaterStaff(): void {
  pending = undefined;
}

function entry(label: string, body: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label,
    body: wrapSetupText(`${body}\n\nb  Back\nq  Quit`),
  };
}

function choice(reply: string, max: number): number | undefined {
  const n = Number(reply.trim());
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined;
}

function menuBody(enterpriseId: string): string {
  const waiting = listOpenHandBacks(enterpriseId).length;
  return [
    "Change staff at any time.",
    "",
    "1  Show staff",
    "2  Add a person",
    "3  Add an AI worker",
    "4  Change who can sign off",
    "5  Change who an AI worker drafts for",
    "6  Remove a worker",
    "7  Have AI workers suggested",
    waiting > 0 ? `8  Name a new signer (${waiting} need a new signer)` : "8  Name a new signer",
  ].join("\n");
}

function menuScreen(enterpriseId: string, as?: string): readonly WorkStreamEntry[] {
  pending = { stage: "menu", enterpriseId, as };
  return [entry("Staff.", menuBody(enterpriseId))];
}

export function startLaterStaffMenu(input: {
  readonly enterpriseId?: string;
  readonly as?: string;
} = {}): readonly WorkStreamEntry[] {
  if (!isInteractiveSession()) {
    return [{
      actor: "Arturo",
      label: "Staff.",
      body: wrapSetupText("The staff menu needs a terminal. Nothing was changed."),
    }];
  }
  const enterpriseId = input.enterpriseId ?? listEnterprises()[0]?.id;
  if (!enterpriseId) {
    return [{
      actor: "Arturo",
      label: "Staff.",
      body: wrapSetupText("Set up a business first. Nothing was changed."),
    }];
  }
  return menuScreen(enterpriseId, input.as);
}

function functionsOf(enterpriseId: string) {
  return listBusinessFunctionDefinitionsByEnterprise(enterpriseId);
}

function actorOf(enterpriseId: string, as?: string): Account | undefined {
  if (!as) return undefined;
  const person = listPeople(enterpriseId).find((one) => one.name.trim().toLowerCase() === as.trim().toLowerCase());
  if (!person) return undefined;
  return {
    userId: "",
    workerName: person.name,
    displayName: person.name,
    roles: new Map([[enterpriseId, person.role === "owner" ? "owner" : "member"]]),
  };
}

export async function replyToLaterStaff(reply: string): Promise<readonly WorkStreamEntry[]> {
  if (!pending) return [];
  const trimmed = reply.trim();
  if (trimmed.toLowerCase() === "q") {
    pending = undefined;
    return [{ actor: "Arturo", label: "Staff.", body: wrapSetupText("The staff menu is closed. Nothing more was changed.") }];
  }
  if (trimmed.toLowerCase() === "b") {
    return menuScreen(pending.enterpriseId, "as" in pending ? pending.as : undefined);
  }

  if (pending.stage === "menu") {
    const picked = choice(trimmed, 8);
    if (!picked) return [entry("Staff.", ["Reply with a number from the list.", "", menuBody(pending.enterpriseId)].join("\n"))];
    if (picked === 1) {
      return [entry("Staff list.", `${formatStaffList(pending.enterpriseId)}\n\n${menuBody(pending.enterpriseId)}`)];
    }
    if (picked === 2) {
      pending = { stage: "person-name", enterpriseId: pending.enterpriseId, as: pending.as };
      return [entry("A person.", "What is their name? (A name only — Arturo will not ask for an email address.)")];
    }
    if (picked === 3) {
      pending = { stage: "ai-function", enterpriseId: pending.enterpriseId, as: pending.as };
      return [entry("An AI worker.", formatFunctionPick(pending.enterpriseId))];
    }
    if (picked === 4) {
      pending = { stage: "role-who", enterpriseId: pending.enterpriseId, as: pending.as };
      return [entry("Sign-off right.", formatPeoplePick(pending.enterpriseId))];
    }
    if (picked === 5) {
      pending = { stage: "drafts-worker", enterpriseId: pending.enterpriseId, as: pending.as };
      return [entry("Drafts for.", formatAiPick(pending.enterpriseId))];
    }
    if (picked === 6) {
      pending = { stage: "remove-who", enterpriseId: pending.enterpriseId, as: pending.as };
      return [entry("Remove a worker.", formatWorkerPick())];
    }
    if (picked === 7) {
      const enterpriseId = pending.enterpriseId;
      pending = { stage: "menu", enterpriseId, as: pending.as };
      return await handleUiStaffCommand([]);
    }
    return startHandBackPick(pending.enterpriseId, pending.as);
  }

  if (pending.stage === "person-name") {
    const name = tidySetupText(trimmed);
    if (!name) return [entry("A person.", "Say their name.")];
    if (name.length > MAX_SETUP_NAME) return [entry("A person.", `Keep the name under ${MAX_SETUP_NAME} characters.`)];
    pending = { stage: "person-role", enterpriseId: pending.enterpriseId, as: pending.as, name };
    return [entry("Their role.", [
      `What should ${name} be able to do?`,
      "",
      "1  Sign off work and give go-aheads.",
      "2  Review work before it's delivered (can also sign off work and give go-aheads).",
      "3  Just do the tasks they're given (cannot sign off work or give go-aheads).",
    ].join("\n"))];
  }

  if (pending.stage === "person-role") {
    const picked = choice(trimmed, 3);
    if (!picked) return [entry("Their role.", "Reply with 1, 2 or 3.")];
    const canSignOff = picked !== 3;
    const archetype = picked === 2 ? "reviewer" : "guardian";
    const name = pending.name;
    const existing = getWorker(name);
    if (existing && existing.kind !== "human") return [entry("A person.", `The name ${name} is already used in Arturo.`)];
    if (!existing) addWorker(createHumanWorker(name, archetype as "guardian" | "reviewer"));
    if (!getWorkerOwnership(name) || getWorkerOwnership(name)?.enterpriseId !== pending.enterpriseId) {
      assignWorkerOwnership({ workerName: name, enterpriseId: pending.enterpriseId });
    }
    if (canSignOff) {
      const granted = setSignOffRight({ enterpriseId: pending.enterpriseId, person: name, canSignOff: true, actor: actorOf(pending.enterpriseId, pending.as) });
      if ("refused" in granted) return [entry("A person.", granted.refused)];
    }
    recordStaffChangeEvent({ what: `added ${name} to the staff list`, by: pending.as ?? "the terminal" });
    const enterpriseId = pending.enterpriseId;
    const as = pending.as;
    pending = { stage: "menu", enterpriseId, as };
    return [entry("People.", `${name} is on the staff list.\n\n${menuBody(enterpriseId)}`)];
  }

  if (pending.stage === "ai-function") {
    const definitions = functionsOf(pending.enterpriseId);
    const picked = choice(trimmed, definitions.length);
    if (!picked) return [entry("An AI worker.", formatFunctionPick(pending.enterpriseId))];
    const definition = definitions[picked - 1]!;
    const mark = effectiveFunctionMark(definition.id);
    if (isBlockingFunctionMark(mark)) {
      const kind = mark === "locked" ? "locked" : "people only";
      return [entry(
        "An AI worker.",
        `${definition.label} is ${kind}, so it cannot have an AI worker. A person does the work and signs off.\n\n${formatFunctionPick(pending.enterpriseId)}`,
      )];
    }
    pending = { stage: "ai-name", enterpriseId: pending.enterpriseId, as: pending.as, functionId: definition.id };
    return [entry("An AI worker.", `What should the AI worker for ${definition.label} be called?`)];
  }

  if (pending.stage === "ai-name") {
    const name = tidySetupText(trimmed);
    if (!name) return [entry("An AI worker.", "Name the AI worker.")];
    const existing = getWorker(name);
    if (existing && existing.kind !== "ai") return [entry("An AI worker.", `The name ${name} is already used in Arturo. Choose a different name.`)];
    if (!existing) registerAiWorker(name, "creator");
    saveStaffingAssignment({ businessFunctionId: pending.functionId, workerName: name, role: "ai", rationale: "Added from the staff menu." });
    recordStaffChangeEvent({ what: `added the AI worker ${name}`, by: pending.as ?? "the terminal" });
    const enterpriseId = pending.enterpriseId;
    const as = pending.as;
    pending = { stage: "menu", enterpriseId, as };
    return [entry("AI workers.", `${name} is on the staff list.\n\n${menuBody(enterpriseId)}`)];
  }

  if (pending.stage === "role-who") {
    const people = listPeople(pending.enterpriseId);
    const picked = choice(trimmed, people.length);
    if (!picked) return [entry("Sign-off right.", formatPeoplePick(pending.enterpriseId))];
    pending = { stage: "role-what", enterpriseId: pending.enterpriseId, as: pending.as, person: people[picked - 1]!.name };
    const person = pending.person;
    const can = maySignOff(pending.enterpriseId, person);
    return [entry("Sign-off right.", [
      `${person} ${can ? "can" : "cannot"} sign off work and give go-aheads.`,
      "",
      "1  They can sign off work and give go-aheads",
      "2  They cannot sign off work or give go-aheads",
    ].join("\n"))];
  }

  if (pending.stage === "role-what") {
    const picked = choice(trimmed, 2);
    if (!picked) return [entry("Sign-off right.", "Reply with 1 or 2.")];
    const outcome = setSignOffRight({
      enterpriseId: pending.enterpriseId,
      person: pending.person,
      canSignOff: picked === 1,
      actor: actorOf(pending.enterpriseId, pending.as),
    });
    const enterpriseId = pending.enterpriseId;
    const as = pending.as;
    pending = { stage: "menu", enterpriseId, as };
    if ("refused" in outcome) return [entry("Sign-off right.", `${outcome.refused}\n\n${menuBody(enterpriseId)}`)];
    return [entry("Sign-off right.", `${outcome.message}\n\n${menuBody(enterpriseId)}`)];
  }

  if (pending.stage === "drafts-worker") {
    const workers = aiWorkers();
    const picked = choice(trimmed, workers.length);
    if (!picked) return [entry("Drafts for.", formatAiPick(pending.enterpriseId))];
    pending = { stage: "drafts-who", enterpriseId: pending.enterpriseId, as: pending.as, worker: workers[picked - 1]! };
    return [entry("Drafts for.", `Who should ${pending.worker} draft for?\n\n${formatPeoplePick(pending.enterpriseId)}`)];
  }

  if (pending.stage === "drafts-who") {
    const people = listPeople(pending.enterpriseId);
    const picked = choice(trimmed, people.length);
    if (!picked) return [entry("Drafts for.", formatPeoplePick(pending.enterpriseId))];
    const draftsFor = people[picked - 1]!.name;
    const outcome = setDraftsFor({
      enterpriseId: pending.enterpriseId,
      aiWorker: pending.worker,
      draftsFor,
      actor: actorOf(pending.enterpriseId, pending.as),
      as: pending.as ?? draftsFor,
    });
    const enterpriseId = pending.enterpriseId;
    const as = pending.as;
    pending = { stage: "menu", enterpriseId, as };
    if (outcome && "refused" in outcome) return [entry("Drafts for.", `${outcome.refused}\n\n${menuBody(enterpriseId)}`)];
    recordStaffChangeEvent({ what: `set an AI worker to draft for ${draftsFor}`, by: as ?? "the terminal" });
    return [entry("Drafts for.", `It now drafts for ${draftsFor}.\n\n${menuBody(enterpriseId)}`)];
  }

  if (pending.stage === "remove-who") {
    const workers = listRemovableWorkers();
    const picked = choice(trimmed, workers.length);
    if (!picked) return [entry("Remove a worker.", formatWorkerPick())];
    const name = workers[picked - 1]!;
    try {
      safelyRemoveWorker(name);
      const enterpriseId = pending.enterpriseId;
      const as = pending.as;
      pending = { stage: "menu", enterpriseId, as };
      return [entry("Remove a worker.", `${name} was removed.\n\n${menuBody(enterpriseId)}`)];
    } catch (error) {
      return [entry("Remove a worker.", `${error instanceof Error ? error.message : String(error)}\n\n${formatWorkerPick()}`)];
    }
  }

  if (pending.stage === "handback-pick") {
    const open = listOpenHandBacks(pending.enterpriseId);
    const picked = choice(trimmed, open.length);
    if (!picked) return startHandBackPick(pending.enterpriseId, pending.as);
    const record = open[picked - 1]!;
    const names = eligibleHandBackSigners(pending.enterpriseId, record.jobId);
    pending = { stage: "handback-who", enterpriseId: pending.enterpriseId, as: pending.as, jobId: record.jobId, names };
    return [entry("A new signer.", formatSignerPick(names, record.jobId, record.previousSigner))];
  }

  if (pending.stage === "handback-who") {
    const picked = choice(trimmed, pending.names.length);
    if (!picked) {
      return [entry("A new signer.", formatSignerPick(pending.names, pending.jobId, undefined))];
    }
    pending = {
      stage: "handback-reason",
      enterpriseId: pending.enterpriseId,
      as: pending.as,
      jobId: pending.jobId,
      signer: pending.names[picked - 1]!,
    };
    return [entry("A new signer.", `Type a reason for naming ${pending.signer} to sign off ${pending.jobId}.`)];
  }

  if (pending.stage === "handback-reason") {
    const outcome = nameHandBackSigner({
      enterpriseId: pending.enterpriseId,
      jobId: pending.jobId,
      signer: pending.signer,
      reason: trimmed,
      actor: (() => {
        const account = actorOf(pending.enterpriseId, pending.as);
        return { workerName: account?.workerName ?? pending.as ?? "", ...(account?.userId ? { userId: account.userId } : {}) };
      })(),
    });
    const enterpriseId = pending.enterpriseId;
    const as = pending.as;
    pending = { stage: "menu", enterpriseId, as };
    if ("refused" in outcome) return [entry("A new signer.", `${outcome.refused}\n\n${menuBody(enterpriseId)}`)];
    return [entry("A new signer.", `${outcome.newSigner} was named to sign off ${outcome.jobId} (was waiting for ${outcome.previousSigner}).\n\n${menuBody(enterpriseId)}`)];
  }

  return [];
}

function startHandBackPick(enterpriseId: string, as?: string): readonly WorkStreamEntry[] {
  const open = listOpenHandBacks(enterpriseId);
  if (open.length === 0) {
    pending = { stage: "menu", enterpriseId, as };
    return [entry("A new signer.", `No drafts need a new signer.\n\n${menuBody(enterpriseId)}`)];
  }
  pending = { stage: "handback-pick", enterpriseId, as };
  const section = formatHandBackWaitingSection(enterpriseId) ?? "";
  const lines = open.map((record, index) => `${index + 1}  ${record.jobId} (was waiting for ${record.previousSigner})`);
  return [entry("A new signer.", [section, "", "Choose a draft:", "", ...lines].join("\n"))];
}

function formatFunctionPick(enterpriseId: string): string {
  const definitions = functionsOf(enterpriseId);
  if (definitions.length === 0) return "There are no Functions yet.";
  return [
    "Which Function is the AI worker for? A locked or people-only Function cannot have one.",
    "",
    ...definitions.map((definition, index) => {
      const mark = effectiveFunctionMark(definition.id);
      const note = isBlockingFunctionMark(mark)
        ? mark === "locked"
          ? " (locked — cannot have an AI worker)"
          : " (people only — cannot have an AI worker)"
        : "";
      return `${index + 1}  ${definition.label}${note}`;
    }),
  ].join("\n");
}

function formatPeoplePick(enterpriseId: string): string {
  const people = listPeople(enterpriseId);
  if (people.length === 0) return "Nobody is on the staff list yet.";
  return ["Who?", "", ...people.map((person, index) => `${index + 1}  ${person.name}`)].join("\n");
}

function aiWorkers(): string[] {
  return listWorkers().filter((worker) => worker.kind === "ai" && !worker.system).map((worker) => worker.displayName ?? worker.name);
}

function formatAiPick(enterpriseId: string): string {
  void enterpriseId;
  const workers = aiWorkers();
  if (workers.length === 0) return "There are no AI workers yet.";
  return ["Which AI worker?", "", ...workers.map((name, index) => `${index + 1}  ${name}`)].join("\n");
}

function listRemovableWorkers(): string[] {
  return listWorkers().filter((worker) => !worker.system).map((worker) => worker.displayName ?? worker.name);
}

function formatWorkerPick(): string {
  const workers = listRemovableWorkers();
  if (workers.length === 0) return "There are no workers to remove.";
  return ["Who should be removed?", "", ...workers.map((name, index) => `${index + 1}  ${name}`)].join("\n");
}

/** Eligible people only; the owner is listed but never preselected. PURE. */
export function formatSignerPick(names: readonly string[], jobId: string, previousSigner?: string): string {
  const was = previousSigner ? ` (was waiting for ${previousSigner})` : "";
  return [
    `Who should sign off ${jobId}${was}? Nothing is preselected.`,
    "",
    ...names.map((name, index) => `${index + 1}  ${name}`),
  ].join("\n");
}
