/**
 * Recognising a request to add a new client, among everything else a person
 * might type into New task.
 *
 * Decided without a model, and only ever to offer something: a request this
 * recognises is not routed anywhere on its own. The page asks first ("Add a new
 * client to Arturo's client list?"), and the person can say it was something
 * to write instead. A request it misses is not lost either: it becomes an
 * ordinary task, which the person can see and set aside.
 *
 * It recognises "I need a new client added: Joe Bloggs…", "add Joe Bloggs as a
 * client", "add Joe to our clients", "new client: Jane Smith", "I've got a new
 * client on the phone", in the business's own word for a client as well
 * ("author", "patient"). Work about a client ("draft a welcome letter for my
 * new client", "create a client onboarding checklist", "add a note to the
 * client's file") is not a request to add one.
 *
 * PURE: No side effects.
 */

export type ClientWords = { readonly singular: string; readonly plural: string };

const DEFAULT_WORDS: ClientWords = { singular: "client", plural: "clients" };

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A request that starts by asking for something to be written or done to a client, not for one to be added. */
const WORK_FIRST = /^(?:(?:please|can you|could you|would you|i need you to|i'd like you to)\s+)?(?:write|draft|review|prepare|compose|create|make|design|summari[sz]e|check|plan|build|set up|send|e-?mail|call|ring|phone|remind|book|schedule|invoice|translate|read|look at|find|tell)\b/i;

/** Things about clients that are work to produce, not a client to add. */
const ABOUT_CLIENTS = "onboarding|intake|welcome|letters?|templates?|checklists?|forms?|sections?|packs?|files?|meetings?|matters?|agreements?|portal|polic(?:y|ies)|process|procedures?|guides?|notes?|emails?|e-mails?|survey|feedback|report|summary|database";

export function isClientIntakeRequest(text: string, words: ClientWords = DEFAULT_WORDS): boolean {
  const said = text.replace(/\s+/g, " ").trim();
  if (!said) return false;
  const plural = new Set(["clients", words.plural.toLowerCase()]);
  const all = [...new Set(["client", "clients", words.singular, words.plural].map((word) => word.trim().toLowerCase()).filter(Boolean))];
  const W = `(?:${all.sort((a, b) => b.length - a.length).map(escape).join("|")})`;

  if (WORK_FIRST.test(said)) return false;
  if (new RegExp(String.raw`\b${W}(?:'s|s')?\s+(?:${ABOUT_CLIENTS})\b`, "i").test(said)) return false;

  // "New client: Jane Smith, …"
  if (new RegExp(String.raw`^new\s+${W}\s*[:\-–]`, "i").test(said)) return true;
  // "I need a new client added", "I've got a new client on the phone".
  if (new RegExp(String.raw`\b(?:need|want|have|has|got|had|signed|there'?s|here'?s|i'?ve)\s+(?:just\s+)?(?:got\s+|signed\s+)?(?:a|an|another|one|some)?\s*new\s+${W}\b`, "i").test(said)) return true;

  // "Add Joe Bloggs as a client", "add Joe to our clients", "take down a new client".
  const verb = new RegExp(String.raw`\b(?:add|enter|record|register|take down|take on|sign up|onboard|log|save|put)\b([^.;!?]{0,80}?)\b(${W})\b`, "i").exec(said);
  if (!verb) return false;
  const between = verb[1];
  const word = verb[2].toLowerCase();
  // "add a clause for the client": the client is who other work is for.
  if (/\b(?:for|from|about|with|of|by|at|under)\s+(?:(?:a|an|the|my|our|this|that|his|her|their|new)\s+)*$/i.test(between)) return false;
  // "add a note to the client" is work; "add Joe to our clients" (or "on the client list") is a client.
  if (/\b(?:to|on|onto|in|into)\s+(?:(?:a|an|the|my|our|this|that|new)\s+)*$/i.test(between)) {
    return plural.has(word) || /^\s*list\b/i.test(said.slice(verb.index + verb[0].length));
  }
  return true;
}
