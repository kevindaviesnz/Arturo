/**
 * Boundaries that must appear in every prompt whose output an operator could
 * act on.
 *
 * These lived in `buildWorkerPrompt` alone, which covered ordinary Tasks and
 * missed the Workflow path entirely. A plumber asking `/ask "write me a quote
 * for a bathroom install"` received a complete customer quote with invented
 * line prices, a $6,600 total, a 30% deposit, a one-year warranty on materials
 * and labour, and free routine maintenance — twice stating it was "based on the
 * provided records" when a single sentence was all it had been given.
 *
 * A quote is a contractual document. Fabricated inventory is expensive;
 * fabricated commercial terms sent to a customer are a liability. Any new
 * prompt builder producing operator-facing work must include both constants,
 * which `outputBoundaries.test.ts` enforces.
 */

/**
 * Forbids inventing data and claiming a source for it.
 */
export const DATA_PROVENANCE_BOUNDARY = [
  "You have no access to the Enterprise's records, systems, files, accounts, prices, or data. You know only what appears in this prompt.",
  "Never invent a figure, quantity, price, rate, total, date, name, identifier, or list entry and present it as real. Inventing plausible values is worse than refusing, because they cannot be told apart from real ones.",
  "Never state or imply that anything came from records, historical data, sales figures, a database, a system, an analysis you performed, or a source you consulted. Do not write \"based on the provided records\" or similar when no records were provided.",
  "Never commit the Enterprise to a price, total, deposit, discount, deadline, warranty, guarantee, refund, service level, or any other obligation. Those are commitments only a person can make.",
  "Unless a figure was supplied to you above, never write a monetary amount, rate, or total at all — not as an estimate, not as an example, not as a placeholder, and not with a caveat attached. A labelled example is still copied and sent. Describe what the price depends on and what must be priced, and leave every amount for a person to fill in.",
  "When the Task needs data you were not given, say plainly which data is missing, then produce the method, structure, criteria, or template that would be applied once it is supplied.",
  "Clearly mark any illustrative example as illustrative, and never present one as the Enterprise's actual position.",
].join("\n");

/**
 * Says the Worker cannot change records or send anything, and what to write
 * instead.
 *
 * Asked "I need a new client added: Joe Bloggs ABC Street 555-6789", a Worker
 * followed DATA_PROVENANCE_BOUNDARY to the letter and wrote a "Method for
 * Adding New Client Information" for client-management software it knew
 * nothing about ("Open the client management system used by Harbour
 * Legal…"). Nobody was added, and the owner was handed instructions for his own
 * software. A Worker that claims it did the change is worse, so
 * `validateWorkerOutputIntegrity` also fails one that does.
 */
export const RECORDS_BOUNDARY = [
  "You cannot add, change or remove any record (a client, a contact, a booking, an entry in any list, system or file), and you cannot send anything. Only a person does that.",
  "Never say or imply that you did, or that anything has been added, saved, entered, updated, booked or sent.",
  "If the Task asks you to add or change a record, say in one sentence that you cannot and that a person must, then set out the details you were given, clearly, for that person to check. Do not write steps for using software you know nothing about.",
].join("\n");

/**
 * States who the Worker is writing as.
 */
export const AUTHORSHIP_BOUNDARY = [
  "You are producing work on behalf of the Enterprise, not as Arturo.",
  "Never sign, brand, or attribute drafted output as Arturo, as an AI, or as a model.",
  "Leave a signature block for a named human to complete rather than inventing a signatory, a title, or credentials.",
].join("\n");

/** Every boundary, in the order they should appear in a prompt. */
export const OUTPUT_BOUNDARIES = [
  DATA_PROVENANCE_BOUNDARY,
  RECORDS_BOUNDARY,
  AUTHORSHIP_BOUNDARY,
].join("\n");

/** Job titles a Worker might award an invented signatory. */
const ROLE_NOUNS = [
  "researcher",
  "analyst",
  "writer",
  "author",
  "reviewer",
  "assistant",
  "consultant",
  "specialist",
  "adviser",
  "advisor",
  "engineer",
  "manager",
  "director",
  "officer",
  "coordinator",
  "editor",
  "scientist",
  "expert",
  "technician",
  "agent",
  "representative",
  "accountant",
  "solicitor",
  "lawyer",
  "auditor",
];

const ATTRIBUTION = /\b(?:prepared|written|authored|drafted|compiled|reviewed|approved|signed)\s+by\b/i;

/**
 * Whether output attributes itself to a person it made up.
 *
 * `AUTHORSHIP_BOUNDARY` asks for a signature block a named human completes,
 * with no invented signatory, title, or credentials. Saying so in the prompt is
 * not enough: llama3.2 complied on one run and, on the next, closed a guide with
 * "This document was prepared by [Name], Human Researcher for BrightSky Solar".
 * The placeholder was left blank as asked and a human job title was invented
 * around it — on a document an AI Worker wrote, which a reader would take as
 * a person's work.
 *
 * Deliberately narrow. It looks only for a title in apposition to an
 * attribution — "prepared by X, Senior Analyst" — so a template offering
 * "Prepared by: [Name], [Title]" passes, and prose that merely mentions
 * researchers is untouched.
 *
 * PURE: No side effects.
 */
export function findInventedSignatory(
  output: string
): string | undefined {
  for (const line of output.split("\n")) {
    const attribution = ATTRIBUTION.exec(line);
    if (!attribution) continue;

    const after = line.slice(attribution.index + attribution[0].length);
    // The title, if any, sits in apposition after the name: "by X, Some Title".
    const appositive = /,\s*([^,.;]{1,60})/.exec(after);
    if (!appositive) continue;

    const title = appositive[1].trim();
    // A placeholder is what the boundary asks for, so it is not a finding.
    if (/^[[<(_]|^\s*$/.test(title)) continue;

    const named = ROLE_NOUNS.find((role) =>
      new RegExp(`\\b${role}s?\\b`, "i").test(title)
    );
    if (named) {
      return `"${title}" — a title the Worker invented for a signatory`;
    }
  }

  return undefined;
}

/**
 * A Task that asks for a record to be added, changed or removed, or for
 * something to be booked or sent: "I need a new client added: …", "update
 * Jane's phone in the system", "book Joe in for Tuesday".
 */
const ASKS_FOR_RECORD_CHANGE = /\b(?:add|enter|record|register|save|update|change|delete|remove|book|schedule|log|put)\b[^.?!\n]{0,80}\b(?:clients?|customers?|patients?|contacts?|records?|system|database|crm|calendar|diary|spreadsheet|sheet|list|accounts?)\b|\bnew\s+(?:clients?|customers?|patients?|contacts?)\b[^.?!\n]{0,30}\b(?:added|entered|recorded|registered|set up)\b/i;

/** "I've added Joe Bloggs", "Joe Bloggs has been entered into the system". */
const CLAIMED_RECORD_CHANGE = /\b(?:I|we)(?:'ve|’ve| have| had)?\s+(?:(?:now|just|successfully|also)\s+)*(?:added|saved|entered|recorded|registered|updated|deleted|removed|booked|scheduled|logged)\b[^.\n]{0,80}|\b(?:has|have)\s+(?:(?:now|just|already)\s+)?been\s+(?:successfully\s+)?(?:added|saved|entered|recorded|registered|updated|deleted|removed|booked|scheduled|logged)\b[^.\n]{0,40}/i;

/** Words just before a "has been added" that say it was not. */
const NOT_DONE = /\b(?:nothing|not|no|nobody|no one|never|cannot|can't|can’t|couldn't|won't|unable)\b[^.\n]{0,30}$/i;

/**
 * Whether output claims to have made the change a Task asked for, which no AI
 * Worker can make (RECORDS_BOUNDARY). Only checked when the Task asked for a
 * change, so a drafted welcome letter that says "we have added your details to
 * our records" is not mistaken for a claim.
 *
 * PURE: No side effects.
 */
export function findClaimedRecordChange(
  instruction: string,
  output: string
): string | undefined {
  if (!ASKS_FOR_RECORD_CHANGE.test(instruction)) return undefined;
  for (const claim of output.matchAll(new RegExp(CLAIMED_RECORD_CHANGE.source, "gi"))) {
    // "Nothing has been added", "I can't confirm it has been saved": saying it was not done is what is asked for.
    if (NOT_DONE.test(output.slice(Math.max(0, (claim.index ?? 0) - 40), claim.index))) continue;
    return claim[0].trim();
  }
  return undefined;
}
