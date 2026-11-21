/**
 * Setting up a business and recording its clients, shared by the terminal
 * (/setup, /client add, /clients) and the overview's pages, so either way
 * records the same thing.
 *
 * Nothing here is specific to one kind of business. What a business asks of
 * a new client is set when its assistant is set up (clients/clientAssistant.ts).
 */

import { isApprovalCapableMode } from "../control/humanWorkerMode";
import { addWorker, createHumanWorker, getWorker, listWorkers } from "../control/workers";
import type { Enterprise } from "../enterprise/enterprise";
import { createAndSaveEnterprise, getEnterpriseByIdOrName, getEnterpriseByName, listEnterprises } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership, getWorkerOwnership, listEnterpriseWorkers } from "../identity/organisationIdentity";
import { capitalise, checkClientDetails, describeClient, findClientLookalikes, type ClientLookalike, type ClientRecord } from "./clientRecords";
import { addClientRecord, getClientTerms, listClientRecords } from "./clientStore";

const MAX_NAME = 150;


/** PURE: No side effects. */
export function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];
  return args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

/** The words that are not a flag or a flag's value. PURE: No side effects. */
function positional(args: readonly string[], valued: readonly string[], bare: readonly string[] = []): string[] {
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (valued.includes(arg)) { index += 1; continue; }
    if (bare.includes(arg) || valued.some((flag) => arg.startsWith(`${flag}=`))) continue;
    rest.push(arg);
  }
  return rest;
}

const tidy = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** The people of one business. SIDE EFFECT: Reads Worker state. */
export function peopleOf(enterpriseId: string): string[] {
  const members = new Set(listEnterpriseWorkers(enterpriseId).map((row) => row.workerName));
  return listWorkers().filter((worker) => worker.kind === "human" && members.has(worker.name)).map((worker) => worker.name);
}

export type SetupOutcome = { readonly created: boolean; readonly enterpriseId?: string; readonly message: string };

export const SETUP_USAGE = 'Usage: /setup "<business name>" --owner "<your name>" --about "<what the business does>"';

/**
 * Sets up a business from nothing: its name, the person who runs it, and
 * what the business does. The owner is a person who can approve work and
 * sign off results. What the business does is what its AI helpers are told
 * about it, so a law practice's assistant asks a new client different
 * questions from a clinic's.
 *
 * Everything is checked before anything is written.
 *
 * SIDE EFFECT: Creates an Enterprise and a Human Worker, and records ownership and terms.
 */
export function setUpBusiness(args: readonly string[]): SetupOutcome {
  const refuse = (message: string): SetupOutcome => ({ created: false, message });
  const name = tidy(positional(args, ["--owner", "--about"]).join(" "));
  const owner = tidy(flagValue(args, "--owner"));
  if (!name) return refuse(SETUP_USAGE);
  if (name.length > MAX_NAME) return refuse(`Keep the business name under ${MAX_NAME} characters.`);
  if (!owner) return refuse('Say who runs the business: --owner "<your name>".');
  if (owner.length > MAX_NAME) return refuse(`Keep your name under ${MAX_NAME} characters.`);
  if (getEnterpriseByName(name)) return refuse(`A business called ${name} is already set up.`);
  const existing = getWorker(owner);
  if (existing && (existing.kind !== "human" || getWorkerOwnership(owner))) {
    return refuse(`The name ${owner} is already used in Arturo. Use your full name, or a slightly different one.`);
  }
  // The owner approves work and signs off results, and the message below says
  // so. Reusing someone already registered who cannot approve would make that
  // untrue, and changing what an existing person may do is not this step's call.
  if (existing && !isApprovalCapableMode(existing.humanMode)) {
    return refuse(`The name ${owner} is already used in Arturo by someone who cannot approve work. Use your full name, or a slightly different one.`);
  }
  const about = tidy(flagValue(args, "--about"));
  if (!about) return refuse('Say in a few words what the business does: --about "<what it does>".');
  if (about.length > 500) return refuse("Keep what the business does under 500 characters.");

  const enterprise = createAndSaveEnterprise({ name, mission: "", description: about });
  if (!existing) addWorker(createHumanWorker(owner, "guardian"));
  assignWorkerOwnership({ workerName: owner, enterpriseId: enterprise.id });
  return {
    created: true,
    enterpriseId: enterprise.id,
    message: [
      `${name} is set up, run by ${owner}.`,
      `${owner} can approve work and sign off results.`,
    ].join("\n"),
  };
}

export type ClientAddOutcome = {
  readonly added: boolean;
  readonly clientId?: string;
  /** Existing clients who may be the same one; the person decides. */
  readonly lookalikes?: readonly { readonly id: string; readonly name: string; readonly because: string }[];
  readonly message: string;
};

export const CLIENT_ADD_USAGE = 'Usage: /client add "<name>" [--email "<email>"] [--phone "<phone>"] [--address "<address>"] [--notes "<notes>"] [--detail "<label>: <value>"]... [--as "<your name>"] [--confirm-new]';

export const resolveEnterprise = (reference: string | undefined): Enterprise | { readonly refused: string } => {
  if (reference?.trim()) return getEnterpriseByIdOrName(reference.trim()) ?? { refused: `No business called ${reference.trim()} is set up.` };
  const all = listEnterprises();
  if (all.length === 1) return all[0];
  if (all.length === 0) return { refused: `No business is set up yet. ${SETUP_USAGE}` };
  return { refused: `Say which business with --enterprise: ${all.map((row) => row.name).join(", ")}.` };
};

/** Every value given for a flag that may repeat. PURE: No side effects. */
function flagValues(args: readonly string[], flag: string): string[] {
  const values: string[] = [];
  args.forEach((arg, index) => {
    if (arg === flag && args[index + 1] !== undefined) values.push(args[index + 1]);
    else if (arg.startsWith(`${flag}=`)) values.push(arg.slice(flag.length + 1));
  });
  return values;
}

/**
 * Adds a client to a business.
 *
 * Before anything is kept, the new client is compared with the existing ones:
 * the same email or phone, or the same or a nearly identical name, is shown
 * and nothing is saved until the person confirms it is someone new
 * (--confirm-new). For a law practice that is where a conflict check starts;
 * for a shop it stops a customer being entered twice.
 *
 * A client's assistant saves through this function too, with the details it
 * took down, once the person has confirmed its read-back.
 *
 * SIDE EFFECT: Writes a client record.
 */
export function addClient(args: readonly string[], now = Date.now()): ClientAddOutcome {
  const refuse = (message: string): ClientAddOutcome => ({ added: false, message });
  const valued = ["--email", "--phone", "--address", "--notes", "--enterprise", "--as", "--detail"];
  const enterprise = resolveEnterprise(flagValue(args, "--enterprise"));
  if ("refused" in enterprise) return refuse(enterprise.refused);
  const terms = getClientTerms(enterprise.id);
  const name = tidy(positional(args, valued, ["--confirm-new"]).join(" "));
  if (!name) return refuse(CLIENT_ADD_USAGE);
  if (name.startsWith("-")) return refuse("Start the name with a letter, not a dash.");
  const details = checkClientDetails({
    name, email: flagValue(args, "--email"), phone: flagValue(args, "--phone"),
    address: flagValue(args, "--address"), notes: flagValue(args, "--notes"),
    details: flagValues(args, "--detail").map((text) => {
      const at = text.indexOf(":");
      return at > 0 ? { label: text.slice(0, at), value: text.slice(at + 1) } : { label: "Detail", value: text };
    }),
  });
  if ("refused" in details) return refuse(details.refused);

  const asName = tidy(flagValue(args, "--as"));
  const addedBy = asName ? peopleOf(enterprise.id).find((person) => person.toLowerCase() === asName.toLowerCase()) : undefined;
  if (asName && !addedBy) return refuse(`No person called ${asName} works at ${enterprise.name}.`);

  const lookalikes: ClientLookalike[] = findClientLookalikes(details, listClientRecords(enterprise.id));
  const confirmed = args.includes("--confirm-new");
  if (lookalikes.length && !confirmed) {
    return {
      added: false,
      lookalikes: lookalikes.map(({ client, because }) => ({ id: client.id, name: client.name, because })),
      message: [
        `Nothing was added yet. ${capitalise(terms.plural)} already recorded who may be the same:`,
        ...lookalikes.map(({ client, because }) => `  ${client.id}  ${describeClient(client)} (${because})`),
        `If this is a different ${terms.singular}, add them again with --confirm-new.`,
      ].join("\n"),
    };
  }

  const client = addClientRecord({
    enterpriseId: enterprise.id, ...details,
    addedBy: addedBy ?? "not named",
    createdAt: now,
    ...(confirmed && lookalikes.length ? { confirmedNewDespite: lookalikes.map(({ client: other }) => other.id) } : {}),
  });
  return { added: true, clientId: client.id, message: `${client.name} is added as ${client.id}.` };
}

/** The terminal's list of one business's clients. SIDE EFFECT: Reads client records. */
export function describeClients(args: readonly string[]): string {
  const enterprise = resolveEnterprise(flagValue(args, "--enterprise"));
  if ("refused" in enterprise) return enterprise.refused;
  const terms = getClientTerms(enterprise.id);
  const clients = listClientRecords(enterprise.id);
  if (!clients.length) return `${enterprise.name} has no ${terms.plural} yet. Add one with /client add "<name>".`;
  return [`${capitalise(terms.plural)} of ${enterprise.name}:`, ...clients.map((client: ClientRecord) => `  ${client.id}  ${describeClient(client)}`)].join("\n");
}
