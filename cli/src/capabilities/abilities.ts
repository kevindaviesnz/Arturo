/**
 * What a worker can do, in plain words: the one place that says it.
 *
 * Archetypes are what Arturo is built on: a worker's archetype fixes its
 * capabilities (agents/archetypeRegistry.ts), and the capability catalogue
 * (capabilityCatalog.ts) fixes what each capability means for governance. An
 * *ability* is neither. It groups capabilities into something a business
 * owner can read ("Search the web", "Send email"), and every ability a worker
 * has is worked out from its archetype's capabilities. An ability never grants
 * anything: the archetype is still the only thing that does
 * (normalizeWorkerCapabilities in control/workers.ts), and whether an ability
 * waits for a person's go-ahead is computed from the catalogue
 * (requiresDefaultJobApproval), never written here.
 *
 * Some abilities no AI worker has, by design or for now: changing Arturo's
 * own records (clients, workers, checks) is for people only, through
 * Arturo's own read-back; sending email, changing other software and setting
 * reminders are things no archetype can do yet. A task that needs one of
 * those is refused before it starts (findMissingAbility), rather than given to
 * a worker that can only write about it.
 *
 * Every page label, "It can / It cannot" line and the go-ahead card's "what it
 * could do outside Arturo" come from here, so they cannot drift apart.
 *
 * PURE: No side effects.
 */

import type { AgentArchetype } from "../agents/agentArchetype";
import { archetypeRegistry } from "../agents/archetypeRegistry";
import { isClientIntakeRequest, type ClientWords } from "../clients/clientRequests";
import { CORE_CAPABILITIES, requiresDefaultJobApproval, type WorkerCapability } from "./capabilityCatalog";

export type AbilityId =
  | "write"
  | "web-search"
  | "ask-for-review"
  | "office-read"
  | "office-write"
  | "tools"
  | "send-email"
  | "other-software"
  | "arturo-records"
  | "reminders";

export type Ability = {
  readonly id: AbilityId;
  /** What the owner reads, e.g. "Search the web". */
  readonly label: string;
  /** One sentence: what holding it means. */
  readonly meaning: string;
  /** Holding any one of these gives the ability. Empty: no capability gives it. */
  readonly capabilities: readonly WorkerCapability[];
  /** How far it reaches: only text, Arturo Office, or outside Arturo. */
  readonly reach: "text" | "office" | "outside";
  /** What it is, after "It cannot …", when a worker lacks it. */
  readonly cannot?: string;
  /** For the go-ahead card: what a worker holding it could do. */
  readonly reachPhrase?: string;
  /** Never an AI worker's: a person does it, through Arturo's own flow. */
  readonly peopleOnly?: boolean;
  /** Something said beside it wherever it is shown. */
  readonly note?: string;
};

/** Capabilities that are not abilities: every AI worker reasons, and human review is a person's. */
export const INTERNAL_CAPABILITIES: readonly WorkerCapability[] = ["llm", "human-review"];

export const ABILITIES: readonly Ability[] = [
  {
    id: "write",
    label: "Write and check",
    meaning: "Drafts, summarises, reviews, plans and advises, for you to read and sign off.",
    capabilities: ["writing", "research", "review", "analysis", "conversion", "advice", "planning", "coordination", "monitoring", "simulation", "optimization", "negotiation", "safety", "coaching", "email-draft", "summarisation"],
    reach: "text",
  },
  {
    id: "web-search",
    label: "Search the web",
    meaning: "Looks things up online through Arturo's web search, when it is turned on, and keeps the results it used.",
    capabilities: ["web-research"],
    reach: "outside",
    cannot: "search the web",
    reachPhrase: "search the web",
  },
  {
    id: "ask-for-review",
    label: "Ask a person here for a review",
    meaning: "Arturo emails someone registered at this business a link to review its work: in a workflow, when a step needs their review; otherwise only after your go-ahead. The message is Arturo's own, and registering someone does not prove who they are.",
    capabilities: ["human-contact"],
    reach: "outside",
    cannot: "ask anyone for a review",
    reachPhrase: "have Arturo email a person registered here to ask for a review",
  },
  {
    id: "office-read",
    label: "Read Office records",
    meaning: "Reads customers, jobs and documents in Arturo Office, in a business function given Office access.",
    capabilities: ["office-read"],
    reach: "office",
    cannot: "read Office records",
  },
  {
    id: "office-write",
    label: "Update Office records",
    meaning: "Saves customers, jobs, appointments and draft documents and messages in Arturo Office. It cannot issue invoices, send messages or record payments.",
    capabilities: ["office-write"],
    reach: "office",
    cannot: "change Office records",
    reachPhrase: "save customers, jobs and drafts in Arturo Office",
    note: "In Office's own business functions (Accounts, Customers, Operations), its changes are saved as soon as its task runs, without a go-ahead.",
  },
  {
    id: "tools",
    label: "Use approved tools on this computer",
    meaning: "Carries out set steps, such as backups, files or commands, only through tools Arturo has been set up and allowed to use.",
    capabilities: ["execution", "backup", "file-read", "file-write", "shell-read", "shell-execute"],
    reach: "outside",
    cannot: "use tools on this computer",
    reachPhrase: "use approved tools on this computer",
  },
  {
    id: "send-email",
    label: "Send email",
    meaning: "Sends email to anyone, once email is set up.",
    capabilities: ["email-send"],
    reach: "outside",
    cannot: "send email",
    reachPhrase: "send email",
  },
  {
    id: "other-software",
    label: "Change records in other software",
    meaning: "Calls outside services Arturo has been allowed to reach, such as other business software.",
    capabilities: ["web"],
    reach: "outside",
    cannot: "change records in other software",
    reachPhrase: "call outside web services",
  },
  {
    id: "arturo-records",
    label: "Add or change clients, workers and checks",
    meaning: "Only a person does this, through Arturo's own forms and read-back.",
    capabilities: [],
    reach: "text",
    cannot: "add or change clients, workers or checks",
    peopleOnly: true,
  },
  {
    id: "reminders",
    label: "Set reminders",
    meaning: "Nobody in Arturo can set a one-off reminder yet.",
    capabilities: [],
    reach: "text",
    cannot: "set reminders",
  },
];

const byId = new Map(ABILITIES.map((ability) => [ability.id, ability]));

/** PURE: No side effects. */
export function getAbility(id: AbilityId): Ability {
  return byId.get(id)!;
}

/** The ability a capability belongs to; undefined for an internal one. PURE: No side effects. */
export function abilityOfCapability(capability: string): Ability | undefined {
  return ABILITIES.find((ability) => (ability.capabilities as readonly string[]).includes(capability));
}

export type HeldAbility = {
  readonly ability: Ability;
  /** A task that needs it waits for a person's go-ahead (from the capability catalogue). */
  readonly needsGoAhead: boolean;
};

/**
 * The abilities a set of capabilities gives, in the table's order, each with
 * whether using it waits for a go-ahead.
 *
 * PURE: No side effects.
 */
export function abilitiesOf(capabilities: readonly string[]): HeldAbility[] {
  return ABILITIES.flatMap((ability) => {
    const held = ability.capabilities.filter((capability) => capabilities.includes(capability));
    return held.length ? [{ ability, needsGoAhead: held.some((capability) => requiresDefaultJobApproval(capability)) }] : [];
  });
}

/** Every archetype, in the registry's order. */
export const ARCHETYPES: readonly AgentArchetype[] = Object.keys(archetypeRegistry) as AgentArchetype[];

/** The archetypes that give an ability. PURE: No side effects. */
export function archetypesWithAbility(id: AbilityId): AgentArchetype[] {
  const ability = getAbility(id);
  if (ability.peopleOnly) return [];
  return ARCHETYPES.filter((archetype) => ability.capabilities.some((capability) => archetypeRegistry[archetype].capabilities.includes(capability)));
}

/**
 * The archetypes the company page may give an AI worker: every one that
 * needs nothing set up beyond Arturo itself. An operator works through Office
 * or other approved tools, so it is staffed at the terminal (/staff), where
 * that access is given.
 */
export const PAGE_ARCHETYPES: readonly AgentArchetype[] = ARCHETYPES.filter((archetype) =>
  abilitiesOf(archetypeRegistry[archetype].capabilities).every(({ ability }) => ability.reach !== "office" && ability.id !== "tools" && ability.id !== "other-software" && ability.id !== "send-email"));

export type ArchetypeDescription = {
  readonly archetype: AgentArchetype;
  readonly label: string;
  readonly summary: string;
  /** Abilities it uses without asking. */
  readonly can: readonly string[];
  /** Abilities that wait for a person's go-ahead. */
  readonly asksFirst: readonly string[];
  /** What it cannot do, in one line. */
  readonly cannot: string;
  readonly notes: readonly string[];
};

const listInWords = (items: readonly string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

/**
 * What an archetype can do, asks before doing, and cannot do, in plain words.
 *
 * PURE: No side effects.
 */
export function describeArchetype(archetype: AgentArchetype): ArchetypeDescription {
  const definition = archetypeRegistry[archetype];
  const held = abilitiesOf(definition.capabilities);
  const has = new Set(held.map(({ ability }) => ability.id));
  const missing: string[] = [];
  if (!has.has("web-search")) missing.push("search the web");
  if (!has.has("office-write") && !has.has("other-software")) missing.push("change any records (yours, Office's or other software's)");
  if (!has.has("send-email")) missing.push("send email");
  if (!has.has("tools")) missing.push("use tools on this computer");
  return {
    archetype,
    label: definition.label,
    summary: definition.summary,
    can: held.filter(({ needsGoAhead }) => !needsGoAhead).map(({ ability }) => ability.label),
    asksFirst: held.filter(({ needsGoAhead }) => needsGoAhead).map(({ ability }) => ability.label),
    cannot: `It cannot ${listInWords(missing)}.`,
    notes: held.flatMap(({ ability }) => (ability.note ? [ability.note] : [])),
  };
}

/** What a worker could do outside Arturo, for the go-ahead card. PURE: No side effects. */
export function outsideReachPhrases(capabilities: readonly string[]): string[] {
  return abilitiesOf(capabilities).flatMap(({ ability }) => (ability.reach !== "text" && ability.reachPhrase ? [ability.reachPhrase] : []));
}

// What a task asks for, by fixed rules. Only the abilities that decide whether
// anyone can do it at all are looked for; writing is what every worker does.

/** A request to write, check or prepare something, which no rule below should take as an action. */
const WORK_FIRST = /^(?:(?:please|can you|could you|would you|i need you to|i'd like you to)\s+)?(?:write|draft|prepare|compose|create|make|design|summari[sz]e|review|check|plan|translate|read|look at|find|tell|explain|list|outline)\b/i;
const SEND = /^(?:(?:please|can you|could you|would you|i need you to|i'd like you to)\s+)?(?:send|forward|e-?mail|reply to)\b(?!\s+(?:me|us|myself)\b)/i;
const SEND_TO = /\b(?:send|forward)\b[^.?!\n]{0,60}\bto\s+(?!me\b|us\b|myself\b)\w/i;
const REMIND = /\bremind\s+(?:me|us|\w+)\b|\bset\s+(?:up\s+)?(?:a\s+)?reminder\b/i;
const OTHER_SOFTWARE = /\b(?:add|enter|update|change|create|record|put|raise|log|delete|remove|post|book)\b[^.?!\n]{0,60}?\b(?:in|into|on|to|from)\s+(?:the\s+|our\s+|my\s+)?(google\s+sheets?|spreadsheet|sheet|clio|leap|actionstep|myob|quickbooks|salesforce|hubspot|crm|practice\s+(?:management\s+)?software|calendar|diary)\b/i;

export type NeededAbility = {
  readonly id: AbilityId;
  /** What in the request showed it, e.g. "Google Sheet". */
  readonly detail?: string;
};

/**
 * The abilities a request asks for, beyond writing, by fixed rules: adding a
 * client (the business's own word for one counts), sending email, changing
 * records in other software, and setting a reminder. A request that starts by
 * asking for something to be written ("draft an email to Dana") asks for
 * writing only. No model decides this.
 *
 * PURE: No side effects.
 */
export function inferTaskAbilities(text: string, words?: ClientWords): NeededAbility[] {
  const said = text.replace(/\s+/g, " ").trim();
  if (!said) return [];
  const needed: NeededAbility[] = [];
  if (isClientIntakeRequest(said, words)) needed.push({ id: "arturo-records" });
  if (WORK_FIRST.test(said)) return needed;
  if (SEND.test(said) || SEND_TO.test(said)) needed.push({ id: "send-email" });
  const other = OTHER_SOFTWARE.exec(said);
  if (other) needed.push({ id: "other-software", detail: other[1].replace(/\s+/g, " ") });
  if (REMIND.test(said)) needed.push({ id: "reminders" });
  return needed;
}

/**
 * The first ability a request needs that none of the workers who could take
 * it has. With no workers given, any archetype counts: an ability no archetype
 * gives (or one for people only) is missing for every worker.
 *
 * PURE: No side effects.
 */
export function findMissingAbility(
  needed: readonly NeededAbility[],
  workers?: readonly (readonly string[])[],
): NeededAbility | undefined {
  return needed.find(({ id }) => {
    const ability = getAbility(id);
    if (ability.peopleOnly || !ability.capabilities.length) return true;
    if (!workers) return archetypesWithAbility(id).length === 0;
    return !workers.some((capabilities) => ability.capabilities.some((capability) => capabilities.includes(capability)));
  });
}

/**
 * Why nobody can do it, in one or two sentences, ending "Nothing was started."
 *
 * PURE: No side effects.
 */
export function describeMissingAbility(missing: NeededAbility, words: ClientWords = { singular: "client", plural: "clients" }): string {
  switch (missing.id) {
    case "arturo-records":
      return `This looks like a new ${words.singular} for Arturo's list. AI workers cannot add ${words.plural}: Arturo does that itself, after reading the details back to you. Nothing was started.`;
    case "send-email":
      return "This needs an email sent, and no worker can send email yet. Nothing was started.";
    case "other-software":
      return `This needs something changed in ${missing.detail ? `your ${missing.detail}` : "other software"}, and Arturo is not connected to it, so no worker can. Nothing was started.`;
    case "reminders":
      return "This needs a reminder set, and nobody in Arturo can set one-off reminders yet. Nothing was started.";
    default:
      return `This needs a worker who can ${getAbility(missing.id).cannot ?? getAbility(missing.id).label.toLowerCase()}, and none can. Nothing was started.`;
  }
}

/**
 * For the company page: each capability's ability, so the page shows the
 * same labels this table gives.
 *
 * PURE: No side effects.
 */
export function pageAbilityLabels(): Record<string, { readonly id: AbilityId; readonly label: string; readonly outside: boolean; readonly goAhead: boolean; readonly note?: string }> {
  return Object.fromEntries(CORE_CAPABILITIES.flatMap((capability) => {
    const ability = abilityOfCapability(capability);
    return ability
      ? [[capability, { id: ability.id, label: ability.label, outside: ability.reach !== "text", goAhead: requiresDefaultJobApproval(capability), ...(ability.note ? { note: ability.note } : {}) }]]
      : [];
  }));
}
