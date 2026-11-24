/**
 * The guided /setup route (four numbered steps, one question per screen).
 * /enterprise is an alias for the same function. This module implements
 * steps 1 and 2 (Enterprise and mission; Functions and marks). The staff
 * step (step 3) is not built here.
 *
 * Resume is worked out from stored records by setupProgress.ts.
 */

import type { WorkStreamEntry } from "../ui/uiState";
import { resolveConfiguredProvider } from "../llm/llmClient";
import { createAndSaveEnterprise, getEnterprise, getEnterpriseByName, listEnterprises, updateEnterpriseMission } from "../enterprise/enterpriseStore";
import { createEnterpriseFunction } from "../business/businessFunctionCreation";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import { setFunctionMark, type FunctionMarkValue } from "../business/functionMark";
import { createNextGuidanceResultForEnterprise } from "../repl/nextCommands";
import type { BusinessFunctionRecommendation } from "../guidance/nextStepAdvisor";
import { FIXED_LOCKED_WORK_TYPES } from "../work/workRecord";
import { firstIncompleteEnterprise, firstMissingSetupStep } from "./setupProgress";
import { startStaffStep, replyToStaffStep, clearStaffStep, isStaffStepActive } from "./setupStaff";
import { MAX_SETUP_MISSION, MAX_SETUP_NAME, SETUP_COLUMNS, SETUP_USAGE, saveBusinessFoundation, tidySetupText, wrapSetupText } from "./setupSaves";

export { wrapSetupText, SETUP_COLUMNS };

export const AI_WARNING =
  "Before Arturo suggests anything. What you type here is sent to the AI model set up for Arturo. If that is an outside service, it leaves this computer. Leave out names, private details and confidential work of the people you work for.";

type SetupState =
  | { readonly stage: "name" }
  | { readonly stage: "mission"; readonly name: string; readonly enterpriseId?: string }
  | { readonly stage: "who"; readonly enterpriseId: string; readonly name: string }
  | { readonly stage: "warning"; readonly enterpriseId: string; readonly as: string; readonly lastProvider?: string }
  | { readonly stage: "suggest"; readonly enterpriseId: string; readonly as: string; readonly recommendations: readonly BusinessFunctionRecommendation[]; readonly index: number }
  | { readonly stage: "mark"; readonly enterpriseId: string; readonly as: string; readonly recommendations: readonly BusinessFunctionRecommendation[]; readonly index: number; readonly chosen: BusinessFunctionRecommendation }
  | { readonly stage: "own-name"; readonly enterpriseId: string; readonly as: string }
  | { readonly stage: "own-objective"; readonly enterpriseId: string; readonly as: string; readonly label: string }
  | { readonly stage: "own-mark"; readonly enterpriseId: string; readonly as: string; readonly label: string; readonly objective: string }
  | { readonly stage: "staff-next"; readonly enterpriseId: string };

let pending: SetupState | undefined;
let lastWarningProvider: string | undefined;

export function isSetupFlowActive(): boolean {
  return pending !== undefined || isStaffStepActive();
}

export function setupFlowHasSavedEnterprise(): boolean {
  return Boolean(pending && "enterpriseId" in pending && pending.enterpriseId);
}

/** /setup, and bare /enterprise, continue the same guided route rather than abandoning it. */
export function commandContinuesSetup(command: string, args: readonly string[]): boolean {
  return command === "/setup" || (command === "/enterprise" && args.length === 0);
}

export function clearSetupFlow(): void {
  pending = undefined;
  clearStaffStep();
}

function modelProvider(): string | undefined {
  try {
    const resolved = resolveConfiguredProvider();
    return resolved.provider || undefined;
  } catch {
    return undefined;
  }
}

function entry(step: 1 | 2 | 3 | 4, label: string, body: string): WorkStreamEntry {
  const footer = ["", "b  Back", "q  Quit"].join("\n");
  return {
    actor: "Arturo",
    label: `Step ${step} of 4`,
    body: wrapSetupText(`${label}\n\n${body}${footer}`),
  };
}

function cancelled(): readonly WorkStreamEntry[] {
  pending = undefined;
  clearStaffStep();
  return [{ actor: "Arturo", label: "Cancelled", body: "No problem — nothing was changed." }];
}

function isQuit(reply: string): boolean {
  const value = reply.trim().toLowerCase();
  return value === "q" || value === "quit" || value === "cancel";
}

function isBack(reply: string): boolean {
  const value = reply.trim().toLowerCase();
  return value === "b" || value === "back" || value === "esc";
}

function askName(): readonly WorkStreamEntry[] {
  pending = { stage: "name" };
  return [entry(1, "Name the business.", "What is the business called?")];
}

function askMission(name: string, enterpriseId?: string): readonly WorkStreamEntry[] {
  pending = { stage: "mission", name, enterpriseId };
  return [entry(1, "The mission.", `In one sentence, what does ${name} exist to do?`)];
}

function askWho(enterpriseId: string, name: string): readonly WorkStreamEntry[] {
  pending = { stage: "who", enterpriseId, name };
  return [entry(1, "Your name.", "What should Arturo call you? Marks on Functions are recorded in this name.")];
}

function warningBody(): string {
  const provider = modelProvider();
  const lines = [AI_WARNING, "", "1  Carry on"];
  if (provider) lines.push("", `Model: ${provider}`);
  return lines.join("\n");
}

function askWarning(enterpriseId: string, as: string): readonly WorkStreamEntry[] {
  const provider = modelProvider();
  pending = { stage: "warning", enterpriseId, as, lastProvider: provider };
  lastWarningProvider = provider;
  return [entry(2, "Before Arturo suggests anything.", warningBody())];
}

function needsWarningAgain(asOf?: string): boolean {
  const provider = modelProvider();
  return provider !== lastWarningProvider || provider !== asOf;
}

async function startSuggestions(enterpriseId: string, as: string): Promise<readonly WorkStreamEntry[]> {
  const enterprise = getEnterprise(enterpriseId);
  if (!enterprise) {
    pending = undefined;
    return [{ actor: "Arturo", label: "Setup", body: "That business is no longer set up." }];
  }
  try {
    const result = await createNextGuidanceResultForEnterprise(enterprise);
    const recommendations = result.recommendations;
    if (recommendations.length === 0) return askOwnName(enterpriseId, as, "Arturo has no Functions to suggest. Name one to add.");
    pending = { stage: "suggest", enterpriseId, as, recommendations, index: 0 };
    return [suggestEntry(recommendations, 0)];
  } catch {
    return askOwnName(enterpriseId, as, "Arturo could not suggest Functions just now. Name one to add.");
  }
}

function suggestEntry(recommendations: readonly BusinessFunctionRecommendation[], index: number): WorkStreamEntry {
  const rec = recommendations[index]!;
  const body = [
    `${rec.name}`,
    rec.objective,
    rec.reason ? rec.reason : "",
    "",
    "1  Keep it",
    "2  Leave it out",
    `Suggestion ${index + 1} of ${recommendations.length}.`,
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
  return entry(2, "A business Function.", body);
}

function offerFitsLocked(label: string, objective: string): boolean {
  const text = `${label} ${objective}`.toLowerCase();
  return (FIXED_LOCKED_WORK_TYPES as readonly string[]).some((type) => text.includes(type.replace(/-/g, " ")) || text.includes(type));
}

function askMark(state: Extract<SetupState, { stage: "suggest" }>, chosen: BusinessFunctionRecommendation): readonly WorkStreamEntry[] {
  pending = { stage: "mark", enterpriseId: state.enterpriseId, as: state.as, recommendations: state.recommendations, index: state.index, chosen };
  const offer = offerFitsLocked(chosen.name, chosen.objective)
    ? "This may fit a locked work type. The choice is yours."
    : "An unmarked Function means AI work is allowed.";
  return [entry(2, `Mark for ${chosen.name}.`, [
    offer,
    "",
    "1  No mark (AI allowed)",
    "2  AI allowed",
    "3  People only",
    "4  Locked",
  ].join("\n"))];
}

function askOwnName(enterpriseId: string, as: string, preface?: string): readonly WorkStreamEntry[] {
  pending = { stage: "own-name", enterpriseId, as };
  return [entry(2, "Add a Function.", preface ? `${preface}\n\nWhat should this Function be called?` : "What should this Function be called?")];
}

function askOwnObjective(enterpriseId: string, as: string, label: string): readonly WorkStreamEntry[] {
  pending = { stage: "own-objective", enterpriseId, as, label };
  return [entry(2, `${label}.`, "In one sentence, what should this Function keep doing?")];
}

function askOwnMark(enterpriseId: string, as: string, label: string, objective: string): readonly WorkStreamEntry[] {
  pending = { stage: "own-mark", enterpriseId, as, label, objective };
  const offer = offerFitsLocked(label, objective)
    ? "This may fit a locked work type. The choice is yours."
    : "An unmarked Function means AI work is allowed.";
  return [entry(2, `Mark for ${label}.`, [
    offer,
    "",
    "1  No mark (AI allowed)",
    "2  AI allowed",
    "3  People only",
    "4  Locked",
  ].join("\n"))];
}

function saveFunction(enterpriseId: string, as: string, label: string, objective: string, mark?: FunctionMarkValue): string | undefined {
  const enterprise = getEnterprise(enterpriseId);
  if (!enterprise) return "That business is no longer set up.";
  const created = createEnterpriseFunction({ enterprise, label, objective });
  if (!created.created) return created.message;
  if (mark) {
    const marked = setFunctionMark({ functionId: created.definition.id, mark, actor: undefined, as });
    if ("refused" in marked) return marked.refused;
  }
  return undefined;
}

function staffNext(enterpriseId: string, as?: string): readonly WorkStreamEntry[] {
  pending = { stage: "staff-next", enterpriseId };
  return startStaffStep(enterpriseId, as);
}

function afterFunctionSaved(enterpriseId: string, as: string, recommendations?: readonly BusinessFunctionRecommendation[], index?: number): readonly WorkStreamEntry[] | Promise<readonly WorkStreamEntry[]> {
  const remaining = recommendations && index !== undefined ? recommendations.slice(index + 1) : [];
  if (remaining.length > 0) {
    pending = { stage: "suggest", enterpriseId, as, recommendations: remaining, index: 0 };
    // Keep original numbering against the full list? Simpler: new slice, "1 of remaining".
    // Better: keep full list and increment index.
  }
  return continueAfterChoice(enterpriseId, as, recommendations, index);
}

function continueAfterChoice(enterpriseId: string, as: string, recommendations?: readonly BusinessFunctionRecommendation[], index?: number): readonly WorkStreamEntry[] {
  if (recommendations && index !== undefined && index + 1 < recommendations.length) {
    pending = { stage: "suggest", enterpriseId, as, recommendations, index: index + 1 };
    return [suggestEntry(recommendations, index + 1)];
  }
  const count = listBusinessFunctionDefinitionsByEnterprise(enterpriseId).length;
  if (count === 0) return askOwnName(enterpriseId, as, "The step needs at least one Function.");
  return staffNext(enterpriseId, as);
}

/**
 * Starts or resumes the /setup route. /enterprise with no arguments is an
 * alias for this function.
 *
 * SIDE EFFECT: May start a guided menu. Does not write until the person answers.
 */
export async function startSetupFlow(): Promise<readonly WorkStreamEntry[]> {
  const incomplete = firstIncompleteEnterprise();
  if (!incomplete) {
    if (listEnterprises().length > 0 && !firstIncompleteEnterprise()) {
      // All existing businesses have staff in place; start a new one.
      return askName();
    }
    return askName();
  }
  const { enterprise, step } = incomplete;
  if (step === 1) {
    if (missionIsEmpty(enterprise)) return askMission(enterprise.name, enterprise.id);
    return askName();
  }
  if (step === 2) {
    // Who last set marks is not stored as a required session field; ask the name if we need it for marks.
    return askWho(enterprise.id, enterprise.name);
  }
  return staffNext(enterprise.id);
}

function missionIsEmpty(enterprise: { mission?: string }): boolean {
  return tidySetupText(enterprise.mission).length === 0;
}

/**
 * Non-interactive /setup with flags: reuses the retired save helper and
 * refuses to call setup finished, naming the next missing step.
 */
export function runSetupScript(args: readonly string[]): readonly WorkStreamEntry[] {
  const name = tidySetupText(positional(args, ["--owner", "--about", "--mission"]).join(" "));
  const owner = tidySetupText(flagValue(args, "--owner"));
  const about = tidySetupText(flagValue(args, "--about") ?? flagValue(args, "--mission"));
  const outcome = saveBusinessFoundation({ name, owner, about });
  if (!outcome.created) {
    return [{ actor: "Arturo", label: "Setup", body: outcome.message }];
  }
  const step = firstMissingSetupStep(outcome.enterpriseId!);
  const next = step === 1 ? "the mission (step 1 of 4)" : step === 2 ? "the Functions (step 2 of 4)" : "the staff step (step 3 of 4)";
  return [{
    actor: "Arturo",
    label: "Setup",
    body: `${name} is started, run by ${owner}. Setup is not finished. Next: ${next}. Type /setup to continue.`,
  }];
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

function positional(args: readonly string[], valued: readonly string[]): string[] {
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (valued.includes(arg)) { index += 1; continue; }
    if (valued.some((flag) => arg.startsWith(`${flag}=`))) continue;
    rest.push(arg);
  }
  return rest;
}

/**
 * Handles a reply to the active /setup flow.
 * SIDE EFFECT: May write an Enterprise, Function or mark.
 */
export async function replyToSetup(reply: string): Promise<readonly WorkStreamEntry[]> {
  if (!pending) return [];
  const trimmed = reply.trim();
  if (isQuit(trimmed)) {
    const alreadySaved = "enterpriseId" in pending && Boolean(pending.enterpriseId);
    pending = undefined;
    clearStaffStep();
    if (alreadySaved) {
      return [{
        actor: "Arturo",
        label: "Okay",
        body: "You can type /setup to continue from where you left off.",
      }];
    }
    return cancelled();
  }
  const state = pending;

  if (state.stage === "name") {
    if (isBack(trimmed)) return cancelled();
    const name = tidySetupText(trimmed);
    if (!name) return [entry(1, "Name the business.", "What is the business called?")];
    if (name.length > MAX_SETUP_NAME) return [entry(1, "Name the business.", `Keep the business name under ${MAX_SETUP_NAME} characters. What is the business called?`)];
    if (getEnterpriseByName(name)) return [entry(1, "Name the business.", `A business called ${name} is already set up. Choose a different name.`)];
    return askMission(name);
  }

  if (state.stage === "mission") {
    if (isBack(trimmed)) return state.enterpriseId ? await startSetupFlow() : askName();
    const mission = tidySetupText(trimmed);
    if (!mission) return askMission(state.name, state.enterpriseId);
    if (mission.length > MAX_SETUP_MISSION) {
      return [entry(1, "The mission.", `Keep the mission under ${MAX_SETUP_MISSION} characters. In one sentence, what does ${state.name} exist to do?`)];
    }
    if (state.enterpriseId) {
      updateEnterpriseMission(state.enterpriseId, mission);
      return askWho(state.enterpriseId, state.name);
    }
    // Save only once the name has passed the duplicate check again.
    if (getEnterpriseByName(state.name)) {
      return [entry(1, "Name the business.", `A business called ${state.name} is already set up. Choose a different name.`)];
    }
    const enterprise = createAndSaveEnterprise({ name: state.name, mission });
    return askWho(enterprise.id, state.name);
  }

  if (state.stage === "who") {
    if (isBack(trimmed)) return askMission(state.name, state.enterpriseId);
    const as = tidySetupText(trimmed);
    if (!as) return askWho(state.enterpriseId, state.name);
    if (as.length > MAX_SETUP_NAME) return askWho(state.enterpriseId, state.name);
    const step = firstMissingSetupStep(state.enterpriseId);
    if (step === 3) return staffNext(state.enterpriseId, as);
    return askWarning(state.enterpriseId, as);
  }

  if (state.stage === "warning") {
    if (isBack(trimmed)) return askWho(state.enterpriseId, getEnterprise(state.enterpriseId)?.name ?? "");
    if (trimmed === "1") return startSuggestions(state.enterpriseId, state.as);
    return askWarning(state.enterpriseId, state.as);
  }

  if (state.stage === "suggest") {
    if (isBack(trimmed)) return askWarning(state.enterpriseId, state.as);
    if (trimmed === "1") return askMark(state, state.recommendations[state.index]!);
    if (trimmed === "2") return continueAfterChoice(state.enterpriseId, state.as, state.recommendations, state.index);
    return [suggestEntry(state.recommendations, state.index)];
  }

  if (state.stage === "mark") {
    if (isBack(trimmed)) {
      pending = { stage: "suggest", enterpriseId: state.enterpriseId, as: state.as, recommendations: state.recommendations, index: state.index };
      return [suggestEntry(state.recommendations, state.index)];
    }
    const mark = parseMark(trimmed);
    if (mark === "invalid") return askMark({ ...state, stage: "suggest" }, state.chosen);
    const error = saveFunction(state.enterpriseId, state.as, state.chosen.name, state.chosen.objective, mark === "none" ? undefined : mark);
    if (error) return [entry(2, "A business Function.", error)];
    return continueAfterChoice(state.enterpriseId, state.as, state.recommendations, state.index);
  }

  if (state.stage === "own-name") {
    if (isBack(trimmed)) return askWarning(state.enterpriseId, state.as);
    const label = tidySetupText(trimmed);
    if (!label) return askOwnName(state.enterpriseId, state.as);
    return askOwnObjective(state.enterpriseId, state.as, label);
  }

  if (state.stage === "own-objective") {
    if (isBack(trimmed)) return askOwnName(state.enterpriseId, state.as);
    const objective = tidySetupText(trimmed);
    if (!objective) return askOwnObjective(state.enterpriseId, state.as, state.label);
    return askOwnMark(state.enterpriseId, state.as, state.label, objective);
  }

  if (state.stage === "own-mark") {
    if (isBack(trimmed)) return askOwnObjective(state.enterpriseId, state.as, state.label);
    const mark = parseMark(trimmed);
    if (mark === "invalid") return askOwnMark(state.enterpriseId, state.as, state.label, state.objective);
    const error = saveFunction(state.enterpriseId, state.as, state.label, state.objective, mark === "none" ? undefined : mark);
    if (error) return [entry(2, "Add a Function.", error)];
    const count = listBusinessFunctionDefinitionsByEnterprise(state.enterpriseId).length;
    if (count === 0) return askOwnName(state.enterpriseId, state.as, "The step needs at least one Function.");
    return staffNext(state.enterpriseId, state.as);
  }

  if (state.stage === "staff-next") {
    const result = replyToStaffStep(trimmed);
    if ("back" in result) {
      return askWho(state.enterpriseId, getEnterprise(state.enterpriseId)?.name ?? "");
    }
    return result;
  }

  return cancelled();
}

function parseMark(reply: string): FunctionMarkValue | "none" | "invalid" {
  const value = reply.trim();
  if (value === "1") return "none";
  if (value === "2") return "ai-allowed";
  if (value === "3") return "people-only";
  if (value === "4") return "locked";
  return "invalid";
}

export { SETUP_USAGE };
