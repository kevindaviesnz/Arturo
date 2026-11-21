/**
 * The worker who takes down new clients: finding one, and when there is none,
 * proposing one and setting it up only once the owner agrees.
 *
 * Arturo does not know in advance what a business asks a new client. It asks
 * a model once, when the assistant is proposed, given what the business does:
 * a law practice's list comes back with the other parties to the matter, a
 * clinic's with a date of birth. The owner sees the list before agreeing to
 * it, and the base items (name, phone, email, address) never depend on the
 * model.
 */

import { randomUUID } from "node:crypto";
import { getArchetypeCapabilities } from "../agents/archetypeCapabilities";
import { createAndSaveBusinessFunctionDefinition, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { getWorker, registerAiWorker } from "../control/workers";
import { attachEnterpriseBusinessFunction, getEnterprise } from "../enterprise/enterpriseStore";
import type { Enterprise } from "../enterprise/enterprise";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { generateWithConfiguredLlm } from "../llm/llmClient";
import { getModelRoutingStatus } from "../llm/modelRouting";
import { createEnterpriseBusinessFunctionId } from "../repl/businessFunctionCommands";
import { listStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { peopleOf } from "./clientCommands";
import { BASE_CHECKLIST, BASE_KEYS, type ChecklistItem, type ClientDesk } from "./clientRecords";
import { getClientDesk, recordClientDesk } from "./clientStore";

/** Asks a model one question and returns its answer. Tests pass their own. */
export type AskModel = (prompt: string, model?: string) => Promise<string>;

export const askConfiguredModel: AskModel = async (prompt, model) =>
  (await generateWithConfiguredLlm({ model: model ?? getModelRoutingStatus().localModel, prompt })).response;

/**
 * The role. An assistant drafts and summarises. Its capabilities let it
 * message people who work at the business through Arturo; it cannot email
 * or phone anyone outside it, search the web, or change records except
 * through what Arturo does on a person's confirmation.
 */
export const ASSISTANT_ARCHETYPE = "assistant" as const;
export const ASSISTANT_NAME = "Clients AI worker";
export const CLIENTS_AREA = "Clients";

/** The most further questions a business's list may add. */
const MAX_EXTRA = 6;

/** Used when the model cannot be reached or answers with nothing usable. */
export const FALLBACK_EXTRAS: readonly ChecklistItem[] = [
  { key: "what_they_need", label: "What they need", question: "What do they need help with?", why: "So the work for them starts from the right place." },
  { key: "how_they_heard", label: "How they heard of you", question: "How did they hear about you?", why: "So you can see which advertising works." },
];

/** "Other parties (for conflict check)" → "other_parties_for_conflict_check". PURE: No side effects. */
export function checklistKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "detail";
}

/** PURE: No side effects. */
export function checklistPrompt(enterprise: Pick<Enterprise, "name" | "description" | "mission">): string {
  return [
    `You are helping set up a personal assistant for a business called ${enterprise.name}.`,
    `What the business does: ${enterprise.description || enterprise.mission || "(not stated)"}`,
    "",
    "When a new client comes to this business, the owner tells the assistant about them, and the assistant takes down their details.",
    "The assistant will always ask for their name, phone, email and postal address. List the other things THIS kind of business needs to record about a new client before starting work for them.",
    "Think about what a professional in this field must check or record at the start, for example what a law practice needs for a conflict-of-interest check, or what a clinic needs before a first appointment.",
    "",
    `Give between 2 and ${MAX_EXTRA} items, most important first, one per line, in exactly this form:`,
    "Label | The question the assistant asks the owner | Why this business needs it",
    "",
    "Do not repeat name, phone, email or address. Write nothing else.",
  ].join("\n");
}

/**
 * The business's own questions, from the model's answer. Anything not in the
 * asked form is dropped; so is anything that repeats a base item.
 *
 * PURE: No side effects.
 */
export function parseChecklist(answer: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const line of answer.split("\n")) {
    const parts = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").split("|").map((part) => part.trim().replace(/\s+/g, " "));
    if (parts.length < 2) continue;
    const [label, question, why] = parts;
    if (!label || !question || label.length > 60 || question.length > 200) continue;
    if (!/[a-z]/i.test(label) || /[<>{}]/.test(label + question + (why ?? ""))) continue;
    const key = checklistKey(label);
    if (BASE_KEYS.has(key) || /\b(name|phone|e-?mail|address)\b/i.test(label) && label.split(" ").length <= 2) continue;
    if (items.some((item) => item.key === key)) continue;
    items.push({ key, label, question: question.endsWith("?") ? question : `${question}?`, ...(why ? { why: why.slice(0, 200) } : {}) });
    if (items.length === MAX_EXTRA) break;
  }
  return items;
}

export type AssistantProposal = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly workerName: string;
  readonly areaLabel: string;
  readonly canDo: readonly string[];
  readonly cannotDo: readonly string[];
  /** Every question it will ask, base ones first. */
  readonly checklist: readonly ChecklistItem[];
  /** True when the business's own questions could not be worked out and generic ones were used. */
  readonly fellBack: boolean;
  readonly people: readonly string[];
};

/** Proposals made and not yet agreed to, by id. Held only in this process. */
const proposals = new Map<string, AssistantProposal>();

const workerNameFor = (enterprise: Enterprise) =>
  getWorker(ASSISTANT_NAME) ? `${ASSISTANT_NAME} (${enterprise.name})` : ASSISTANT_NAME;

/** The worker who takes down new clients for a business, if it has one. SIDE EFFECT: Reads client desk state. */
export function findClientAssistant(enterpriseId: string): ClientDesk | undefined {
  const desk = getClientDesk(enterpriseId);
  return desk && getWorker(desk.workerName) ? desk : undefined;
}

/**
 * Works out what a personal assistant for this business would do and ask,
 * without creating anything.
 *
 * SIDE EFFECT: Calls a model once; keeps the proposal in this process.
 */
export async function proposeClientAssistant(enterpriseId: string, ask: AskModel = askConfiguredModel): Promise<AssistantProposal | { readonly refused: string }> {
  const enterprise = getEnterprise(enterpriseId);
  if (!enterprise) return { refused: "Choose your business first." };
  if (findClientAssistant(enterpriseId)) return { refused: `${enterprise.name} already has someone to take down new clients.` };
  let extras: ChecklistItem[] = [];
  try {
    extras = parseChecklist(await ask(checklistPrompt(enterprise)));
  } catch {
    extras = [];
  }
  const fellBack = extras.length === 0;
  const proposal: AssistantProposal = {
    id: randomUUID(),
    enterpriseId,
    workerName: workerNameFor(enterprise),
    areaLabel: CLIENTS_AREA,
    canDo: [
      "Take down a new client's details from what you tell it, and ask you for anything missing.",
      "Read the record back to you, and enter it only when you say it is right.",
    ],
    cannotDo: [
      "Email or phone anyone outside the business.",
      "Search the web.",
      "Enter or change a record without your say-so.",
    ],
    checklist: [...BASE_CHECKLIST, ...(fellBack ? FALLBACK_EXTRAS : extras)],
    fellBack,
    people: peopleOf(enterpriseId),
  };
  proposals.set(proposal.id, proposal);
  return proposal;
}

export type AssistantCreateOutcome = { readonly created: boolean; readonly workerName?: string; readonly message: string };

/**
 * Sets up the proposed assistant, once the owner agrees: an area of work for
 * clients, the assistant staffed on it, and the person agreeing as the one
 * who approves its work.
 *
 * SIDE EFFECT: Creates a Function, an AI Worker, ownership, staffing and the client desk.
 */
export function createClientAssistant(input: { readonly enterpriseId: string; readonly proposalId: string; readonly as: string }, now = Date.now()): AssistantCreateOutcome {
  const refuse = (message: string): AssistantCreateOutcome => ({ created: false, message });
  const proposal = proposals.get(input.proposalId);
  if (!proposal || proposal.enterpriseId !== input.enterpriseId) return refuse("That proposal is no longer open. Ask for a new one.");
  const enterprise = getEnterprise(input.enterpriseId);
  if (!enterprise) return refuse("Choose your business first.");
  const approver = peopleOf(enterprise.id).find((person) => person.toLowerCase() === input.as.trim().toLowerCase());
  if (!approver) return refuse(`Say who is agreeing: someone who works at ${enterprise.name}.`);
  if (findClientAssistant(enterprise.id)) return refuse(`${enterprise.name} already has someone to take down new clients.`);

  const definitions = listBusinessFunctionDefinitions();
  const area = definitions.find((row) => row.enterpriseId === enterprise.id && row.label.toLowerCase() === CLIENTS_AREA.toLowerCase())
    ?? createAndSaveBusinessFunctionDefinition({
      id: createEnterpriseBusinessFunctionId(enterprise.name, CLIENTS_AREA, definitions.map((row) => row.id)),
      enterpriseId: enterprise.id,
      label: CLIENTS_AREA,
      objective: `Keep ${enterprise.name}'s client records: take down new clients from what the people of ${enterprise.name} say, ask for what is missing, and enter them once confirmed. Never contact a client directly.`,
    });
  attachEnterpriseBusinessFunction(enterprise.id, area.id);

  const workerName = getWorker(proposal.workerName) ? workerNameFor(enterprise) : proposal.workerName;
  registerAiWorker(workerName, ASSISTANT_ARCHETYPE, undefined, `Personal assistant at ${enterprise.name}: takes down new clients and enters them once confirmed.`);
  assignWorkerOwnership({ workerName, enterpriseId: enterprise.id });
  if (!listStaffingAssignments().some((row) => row.businessFunctionId === area.id && row.workerName === workerName)) {
    saveStaffingAssignment({ businessFunctionId: area.id, workerName, role: "ai", rationale: `Set up with ${approver}'s agreement to take down new clients.` });
  }
  saveStaffingAssignment({ businessFunctionId: area.id, workerName: approver, role: "human-approver", rationale: `Agreed to set up ${workerName}.` });
  recordClientDesk({
    enterpriseId: enterprise.id, functionId: area.id, workerName,
    checklist: proposal.checklist.filter((item) => !BASE_KEYS.has(item.key)),
    setUpBy: approver, setUpAt: now,
  });
  proposals.delete(proposal.id);
  const contact = getArchetypeCapabilities(ASSISTANT_ARCHETYPE).includes("human-contact")
    ? " It can message people who work here through Arturo."
    : "";
  return {
    created: true,
    workerName,
    message: `${workerName} is set up to take down new clients, with ${approver} approving its work.${contact} Tell it about a new client whenever you like.`,
  };
}

/**
 * Hands new clients to a person who already does this, such as a human PA,
 * instead of setting up an AI one. Their questions come from the same
 * proposal, so a law practice's PA is asked about the other parties too.
 *
 * SIDE EFFECT: Creates a Function and the client desk.
 */
export function assignClientDesk(input: { readonly enterpriseId: string; readonly person: string; readonly as: string; readonly proposalId?: string }, now = Date.now()): AssistantCreateOutcome {
  const refuse = (message: string): AssistantCreateOutcome => ({ created: false, message });
  const enterprise = getEnterprise(input.enterpriseId);
  if (!enterprise) return refuse("Choose your business first.");
  const people = peopleOf(enterprise.id);
  const match = (name: string) => people.find((person) => person.toLowerCase() === name.trim().toLowerCase());
  const approver = match(input.as);
  if (!approver) return refuse(`Say who is deciding: someone who works at ${enterprise.name}.`);
  const handler = match(input.person);
  if (!handler) return refuse(`${input.person.trim() || "That person"} does not work at ${enterprise.name}. Add them first.`);
  if (findClientAssistant(enterprise.id)) return refuse(`${enterprise.name} already has someone to take down new clients.`);
  const proposal = input.proposalId ? proposals.get(input.proposalId) : latestProposal(enterprise.id);
  const extras = proposal ? proposal.checklist.filter((item) => !BASE_KEYS.has(item.key)) : [...FALLBACK_EXTRAS];
  const definitions = listBusinessFunctionDefinitions();
  const area = definitions.find((row) => row.enterpriseId === enterprise.id && row.label.toLowerCase() === CLIENTS_AREA.toLowerCase())
    ?? createAndSaveBusinessFunctionDefinition({
      id: createEnterpriseBusinessFunctionId(enterprise.name, CLIENTS_AREA, definitions.map((row) => row.id)),
      enterpriseId: enterprise.id,
      label: CLIENTS_AREA,
      objective: `Keep ${enterprise.name}'s client records: take down new clients, ask for what is missing, and enter them once confirmed.`,
    });
  attachEnterpriseBusinessFunction(enterprise.id, area.id);
  recordClientDesk({ enterpriseId: enterprise.id, functionId: area.id, workerName: handler, checklist: extras, setUpBy: approver, setUpAt: now });
  if (proposal) proposals.delete(proposal.id);
  return {
    created: true,
    workerName: handler,
    message: `New clients now go to ${handler}. When anyone else asks to add one, it becomes a task on ${handler}'s work page.`,
  };
}

/** The newest open proposal for a business, for the terminal's /assistant create. */
export function latestProposal(enterpriseId: string): AssistantProposal | undefined {
  return [...proposals.values()].filter((proposal) => proposal.enterpriseId === enterpriseId).pop();
}

/** A proposal in words, for the terminal. PURE: No side effects. */
export function describeProposal(proposal: AssistantProposal): string {
  return [
    `Arturo proposes a ${proposal.workerName} to take down new clients, in a new area of work called ${proposal.areaLabel}.`,
    "",
    "It can:",
    ...proposal.canDo.map((line) => `  - ${line}`),
    "It cannot:",
    ...proposal.cannotDo.map((line) => `  - ${line}`),
    "",
    "When you tell it about a new client, it will ask for:",
    ...proposal.checklist.map((item) => `  - ${item.label}${item.why ? ` (${item.why})` : ""}`),
    ...(proposal.fellBack ? ["", "Arturo could not work out this business's own questions just now, so these are general ones."] : []),
    "",
    'To agree, run /assistant create --as "<your name>".',
    'If someone already does this, such as a PA, run /assistant assign "<their name>" --as "<your name>" instead.',
  ].join("\n");
}

/** Test helper. */
export function clearAssistantProposals(): void {
  proposals.clear();
}
