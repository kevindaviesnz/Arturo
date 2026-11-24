/**
 * The guided work-type pick and go-ahead in Start a task.
 * SIDE EFFECT: May start a menu and, on confirm, write a work record and a Task.
 */

import { getBusinessFunctionDefinitionByIdOrLabel } from "../business/businessFunctionDefinitionStore";
import { listEnterprises } from "../enterprise/enterpriseStore";
import { listPeople } from "../identity/companySignIn";
import { getPracticeSetting } from "../work/practiceSetting";
import { createWork } from "../work/workChanges";
import { listJobs } from "../runtime/jobQueue";
import { refuseStartIfNotReady } from "../business/staffCheck";
import {
  SOMETHING_ELSE_TYPE,
  clearWorkTypePicks,
  formatWorkTypeGoAhead,
  formatWorkTypeMenu,
  isPickedTypeLocked,
  labelForWorkType,
  rememberWorkTypePick,
} from "../work/workTypePick";
import type { WorkStreamEntry } from "./uiState";
import { captureUiCommandOutput } from "./uiConsoleCapture";
import { handleTaskCreateCommand } from "../repl/taskRoutingCommands";

type Pending =
  | {
      readonly stage: "pick" | "more";
      readonly request: string;
      readonly functionName: string | undefined;
      readonly extraArgs: readonly string[];
      readonly enterpriseId: string;
      readonly functionId?: string;
      readonly person?: string;
    }
  | {
      readonly stage: "locked-offer";
      readonly request: string;
      readonly functionName: string | undefined;
      readonly extraArgs: readonly string[];
      readonly enterpriseId: string;
      readonly functionId?: string;
      readonly person: string;
      readonly typeId: string;
    }
  | {
      readonly stage: "go-ahead";
      readonly request: string;
      readonly functionName: string | undefined;
      readonly extraArgs: readonly string[];
      readonly enterpriseId: string;
      readonly functionId?: string;
      readonly person: string;
      readonly typeId: string;
    };

let pending: Pending | undefined;

export function isTaskWorkTypeActive(): boolean {
  return pending !== undefined;
}

export function clearTaskWorkType(): void {
  pending = undefined;
}

/** SIDE EFFECT: Clears last picks in tests. */
export function resetTaskWorkType(): void {
  pending = undefined;
  clearWorkTypePicks();
}

function enterpriseOf(functionName: string | undefined): string | undefined {
  if (functionName) {
    const definition = getBusinessFunctionDefinitionByIdOrLabel(functionName);
    if (definition?.enterpriseId) return definition.enterpriseId;
  }
  const enterprises = listEnterprises();
  return enterprises.length === 1 ? enterprises[0]!.id : enterprises[0]?.id;
}

function picker(enterpriseId: string, hinted?: string): string | undefined {
  if (hinted && listPeople(enterpriseId).some((person) => person.name.toLowerCase() === hinted.trim().toLowerCase())) {
    return listPeople(enterpriseId).find((person) => person.name.toLowerCase() === hinted.trim().toLowerCase())!.name;
  }
  const signers = listPeople(enterpriseId).filter((person) => person.canSignOff && person.status !== "suspended");
  return signers[0]?.name ?? listPeople(enterpriseId)[0]?.name;
}

function signerName(enterpriseId: string): string {
  return listPeople(enterpriseId).find((person) => person.canSignOff && person.status !== "suspended")?.name
    ?? "someone who can sign off";
}

function entry(label: string, body: string): WorkStreamEntry {
  return { actor: "Arturo", label, body };
}

function showPick(state: Extract<Pending, { stage: "pick" | "more" }>): readonly WorkStreamEntry[] {
  const custom = getPracticeSetting(state.enterpriseId).customMatterTypes;
  const menu = formatWorkTypeMenu({
    custom,
    functionId: state.functionId,
    person: state.person,
    description: state.request,
    morePage: state.stage === "more",
  });
  pending = state;
  return [entry("Work type", menu.body)];
}

/**
 * Starts the work-type pick, then the go-ahead, before a Task is created.
 * SIDE EFFECT: Starts a guided menu. Writes nothing until the go-ahead.
 */
export function startTaskWorkType(input: {
  readonly request: string;
  readonly functionName: string | undefined;
  readonly extraArgs: readonly string[];
  readonly as?: string;
}): readonly WorkStreamEntry[] {
  const enterpriseId = enterpriseOf(input.functionName);
  if (!enterpriseId) {
    return [entry("Business needed", "Choose a business first. Nothing was created and no AI was asked.")];
  }
  const definition = input.functionName ? getBusinessFunctionDefinitionByIdOrLabel(input.functionName) : undefined;
  const blocked = refuseStartIfNotReady({ enterpriseId, functionId: definition?.id });
  if (blocked) {
    pending = undefined;
    return [{ actor: "Arturo", label: "Refused", body: blocked }];
  }
  const person = picker(enterpriseId, input.as);
  return showPick({
    stage: "pick",
    request: input.request,
    functionName: input.functionName,
    extraArgs: input.extraArgs,
    enterpriseId,
    ...(definition ? { functionId: definition.id } : {}),
    ...(person ? { person } : {}),
  });
}

function offerLocked(state: Exclude<Pending, { stage: "pick" | "more" } | { stage: "go-ahead" }> | (Pending & { typeId: string; person: string })): readonly WorkStreamEntry[] {
  const custom = getPracticeSetting(state.enterpriseId).customMatterTypes;
  const label = labelForWorkType(state.typeId, custom);
  const signer = signerName(state.enterpriseId);
  pending = { ...state, stage: "locked-offer", person: state.person, typeId: state.typeId };
  return [entry(
    "Give it to a person",
    [
      `${label} is locked: a person does it. ${signer} will sign off.`,
      "",
      `1  Give it to ${signer}`,
      "2  Back to types",
    ].join("\n"),
  )];
}

function askGoAhead(state: Pending & { person: string; typeId: string }): readonly WorkStreamEntry[] {
  const custom = getPracticeSetting(state.enterpriseId).customMatterTypes;
  const label = labelForWorkType(state.typeId, custom);
  pending = { ...state, stage: "go-ahead" };
  const first = listJobs().filter((job) => ("enterpriseId" in job ? job.enterpriseId === state.enterpriseId : true)).length === 0;
  return [entry(
    "Go-ahead",
    [
      formatWorkTypeGoAhead(label, state.person),
      first ? "This is the first Task, so it always needs a go-ahead." : "Give the go-ahead to start this Task.",
      "",
      "1  Give the go-ahead",
      "2  Back to types",
    ].join("\n"),
  )];
}

function createFromPick(state: Pending & { person: string; typeId: string }): readonly WorkStreamEntry[] {
  const custom = getPracticeSetting(state.enterpriseId).customMatterTypes;
  const locked = isPickedTypeLocked(state.typeId, custom, state.request);
  const name = state.request.length > 80 ? `${state.request.slice(0, 77)}...` : state.request;
  const opened = createWork({
    enterpriseId: state.enterpriseId,
    name,
    kind: "work",
    ...(state.typeId !== SOMETHING_ELSE_TYPE ? { matterType: state.typeId } : {}),
    ...(locked ? { noAi: true } : {}),
    actor: undefined,
    as: state.person,
  });
  pending = undefined;
  if ("refused" in opened) {
    return [entry("Work not opened", `${opened.refused} Nothing was created and no AI was asked.`)];
  }
  if ("prompt" in opened) {
    return [entry("Work not opened", "This work needs a further choice before it can be opened. Nothing was created and no AI was asked.")];
  }
  const workId = opened.work.id;
  if (state.functionId) rememberWorkTypePick(state.functionId, state.person, state.typeId);
  return [
    captureUiCommandOutput("Task created", () =>
      handleTaskCreateCommand([
        state.request,
        ...(state.functionName ? ["--function", state.functionName] : []),
        ...state.extraArgs,
        ...(workId ? ["--work", workId] : []),
        "--asked-by",
        state.person,
      ])
    ),
  ];
}

/**
 * Handles a reply to the work-type pick or go-ahead.
 * Empty input does nothing (no default). SIDE EFFECT: May write a work record and a Task.
 */
export function replyToTaskWorkType(reply: string): readonly WorkStreamEntry[] {
  if (!pending) return [];
  const trimmed = reply.trim();
  if (!trimmed) {
    if (pending.stage === "go-ahead") return askGoAhead(pending);
    if (pending.stage === "locked-offer") return offerLocked(pending);
    return showPick(pending);
  }
  const lower = trimmed.toLowerCase();
  if (lower === "q" || lower === "quit" || lower === "cancel") {
    pending = undefined;
    return [entry("Cancelled", "No problem — nothing was created and no AI was asked.")];
  }
  if (lower === "b" || lower === "back" || lower === "esc") {
    if (pending.stage === "more" || pending.stage === "locked-offer" || pending.stage === "go-ahead") {
      return showPick({ ...pending, stage: "pick" });
    }
    pending = undefined;
    return [entry("Cancelled", "No problem — nothing was created and no AI was asked.")];
  }

  if (pending.stage === "pick" || pending.stage === "more") {
    const custom = getPracticeSetting(pending.enterpriseId).customMatterTypes;
    const menu = formatWorkTypeMenu({
      custom,
      functionId: pending.functionId,
      person: pending.person,
      description: pending.request,
      morePage: pending.stage === "more",
    });
    const index = Number(trimmed);
    if (!Number.isInteger(index) || index < 1 || index > menu.options.length) {
      return showPick(pending);
    }
    const chosen = menu.options[index - 1]!;
    if (chosen.id === "__more__") {
      return showPick({ ...pending, stage: "more" });
    }
    const person = pending.person ?? picker(pending.enterpriseId);
    if (!person) {
      return [entry("Who is picking?", "Name someone at this business who is picking the work type. Nothing was created and no AI was asked.")];
    }
    const withPerson = { ...pending, person, typeId: chosen.id };
    if (isPickedTypeLocked(chosen.id, custom, pending.request)) return offerLocked(withPerson);
    return askGoAhead(withPerson);
  }

  if (pending.stage === "locked-offer") {
    if (trimmed === "2") return showPick({ ...pending, stage: "pick" });
    if (trimmed !== "1") return offerLocked(pending);
    return askGoAhead(pending);
  }

  if (pending.stage === "go-ahead") {
    if (trimmed === "2") return showPick({ ...pending, stage: "pick" });
    if (trimmed !== "1") return askGoAhead(pending);
    return createFromPick(pending);
  }

  return [];
}
