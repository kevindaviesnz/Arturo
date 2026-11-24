/**
 * Save helpers for setting up a business, moved over from setUpBusiness so
 * that function can be retired without deleting the checks or the records
 * they write. Script forms cannot finish setup without the staff step.
 *
 * Everything is checked before anything is written.
 */

import { isApprovalCapableMode } from "../control/humanWorkerMode";
import { addWorker, createHumanWorker, getWorker } from "../control/workers";
import type { Enterprise } from "../enterprise/enterprise";
import { createAndSaveEnterprise, getEnterpriseByName } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership, getWorkerOwnership } from "../identity/organisationIdentity";

export const MAX_SETUP_NAME = 150;
export const MAX_SETUP_MISSION = 500;

export const SETUP_COLUMNS = 40;

/** Wrap a screen at 40 columns, as the brief requires. PURE. */
export function wrapSetupText(text: string, columns = SETUP_COLUMNS): string {
  return text.split("\n").map((line) => {
    if (line.length <= columns) return line;
    const words = line.split(/\s+/);
    const rows: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= columns) current = next;
      else {
        if (current) rows.push(current);
        current = word;
      }
    }
    if (current) rows.push(current);
    return rows.join("\n");
  }).join("\n");
}


export const SETUP_USAGE = 'Usage: /setup "<business name>" --owner "<your name>" --about "<what the business does>"';

export type SetupSaveOutcome = { readonly created: boolean; readonly enterpriseId?: string; readonly message: string };

/** PURE: No side effects. */
export function tidySetupText(text: string | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Creates an Enterprise after checking the name and mission. Does not add
 * staff. SIDE EFFECT: May write an Enterprise.
 */
export function saveEnterpriseRecord(input: {
  readonly name: string;
  readonly mission: string;
  readonly description?: string;
}): { readonly enterprise: Enterprise } | { readonly refused: string } {
  const name = tidySetupText(input.name);
  const mission = tidySetupText(input.mission);
  if (!name) return { refused: "Name the business first." };
  if (name.length > MAX_SETUP_NAME) return { refused: `Keep the business name under ${MAX_SETUP_NAME} characters.` };
  if (getEnterpriseByName(name)) return { refused: `A business called ${name} is already set up.` };
  if (!mission) return { refused: "Give the business a mission in one sentence." };
  if (mission.length > MAX_SETUP_MISSION) return { refused: `Keep the mission under ${MAX_SETUP_MISSION} characters.` };
  return { enterprise: createAndSaveEnterprise({ name, mission, description: tidySetupText(input.description) || undefined }) };
}

/**
 * Records the person who runs the business as a human worker who can sign
 * off, reused by the retired setUpBusiness helper. Not the staff step.
 *
 * SIDE EFFECT: May add a Human Worker and ownership.
 */
export function saveSetupOwner(input: { readonly enterpriseId: string; readonly owner: string }): { readonly owner: string } | { readonly refused: string } {
  const owner = tidySetupText(input.owner);
  if (!owner) return { refused: 'Say who runs the business: --owner "<your name>".' };
  if (owner.length > MAX_SETUP_NAME) return { refused: `Keep your name under ${MAX_SETUP_NAME} characters.` };
  const existing = getWorker(owner);
  if (existing && (existing.kind !== "human" || getWorkerOwnership(owner))) {
    return { refused: `The name ${owner} is already used in Arturo. Use your full name, or a slightly different one.` };
  }
  if (existing && !isApprovalCapableMode(existing.humanMode)) {
    return { refused: `The name ${owner} is already used in Arturo by someone who cannot sign off work or give go-aheads. Use your full name, or a slightly different one.` };
  }
  if (!existing) addWorker(createHumanWorker(owner, "guardian"));
  assignWorkerOwnership({ workerName: owner, enterpriseId: input.enterpriseId });
  return { owner };
}

/**
 * The retired setUpBusiness body: name, owner and about, with an empty
 * mission (so guided setup resumes at step 1 for the mission). Callers that
 * only need a business for other tests still use this. It cannot finish
 * setup — there are no Functions and no staff.
 *
 * SIDE EFFECT: Creates an Enterprise and a Human Worker, and records ownership.
 */
export function saveBusinessFoundation(input: {
  readonly name: string;
  readonly owner: string;
  readonly about: string;
}): SetupSaveOutcome {
  const refuse = (message: string): SetupSaveOutcome => ({ created: false, message });
  const name = tidySetupText(input.name);
  const owner = tidySetupText(input.owner);
  const about = tidySetupText(input.about);
  if (!name) return refuse(SETUP_USAGE);
  if (name.length > MAX_SETUP_NAME) return refuse(`Keep the business name under ${MAX_SETUP_NAME} characters.`);
  if (!owner) return refuse('Say who runs the business: --owner "<your name>".');
  if (owner.length > MAX_SETUP_NAME) return refuse(`Keep your name under ${MAX_SETUP_NAME} characters.`);
  if (getEnterpriseByName(name)) return refuse(`A business called ${name} is already set up.`);
  const existing = getWorker(owner);
  if (existing && (existing.kind !== "human" || getWorkerOwnership(owner))) {
    return refuse(`The name ${owner} is already used in Arturo. Use your full name, or a slightly different one.`);
  }
  if (existing && !isApprovalCapableMode(existing.humanMode)) {
    return refuse(`The name ${owner} is already used in Arturo by someone who cannot sign off work or give go-aheads. Use your full name, or a slightly different one.`);
  }
  if (!about) return refuse('Say in a few words what the business does: --about "<what it does>".');
  if (about.length > MAX_SETUP_MISSION) return refuse("Keep what the business does under 500 characters.");

  const enterprise = createAndSaveEnterprise({ name, mission: "", description: about });
  if (!existing) addWorker(createHumanWorker(owner, "guardian"));
  assignWorkerOwnership({ workerName: owner, enterpriseId: enterprise.id });
  return {
    created: true,
    enterpriseId: enterprise.id,
    message: [
      `${name} is started, run by ${owner}.`,
      `${owner} can sign off work and give go-aheads.`,
      "Setup is not finished: the mission, Functions and staff still need to be in place before work can start.",
    ].join("\n"),
  };
}
