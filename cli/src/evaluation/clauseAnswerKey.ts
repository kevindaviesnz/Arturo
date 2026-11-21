/**
 * The answers a careful lawyer would give, clause by clause, for three
 * demonstration agreements: one deliberately lopsided, one deliberately fair,
 * and one mixed agreement held out from everything else.
 *
 * Written by the Arturo team as a lawyer would read these clauses, and checked
 * against what a practising lawyer said of them in a demonstration. It has not
 * been signed off by a lawyer: confirm it with one before quoting a score to
 * anyone. Where a reasonable lawyer could answer two ways, both are accepted.
 *
 * Every verdict is one the clause-by-clause step already asks for:
 * ONE-SIDED (with the party it favours), BALANCED or UNCLEAR.
 */

export type ExpectedVerdict = {
  readonly clause: number;
  readonly heading: string;
  /** The verdicts a careful lawyer could give. */
  readonly accept: readonly ("one-sided" | "balanced" | "unclear")[];
  /** When one-sided is accepted, the party it favours, as the document names it. */
  readonly favours?: string;
  /** Why, in a lawyer's words, for the report. */
  readonly why: string;
};

export type AnswerKey = {
  readonly asset: string;
  readonly title: string;
  readonly answers: readonly ExpectedVerdict[];
};

/** The instruction the demonstration gives, word for word. */
export const BENCHMARK_INSTRUCTION =
  "Review the supplied draft services agreement and list the clauses that need negotiation, labelling every assumption and noting what a lawyer must verify. Use only the supplied agreement; if it is not supplied, say so and stop.";

export const LOPSIDED_AGREEMENT: AnswerKey = {
  asset: "draft-services-agreement.txt",
  title: "Lopsided services agreement",
  answers: [
    { clause: 1, heading: "Services", accept: ["unclear"], why: "The scope is in a proposal that is not attached; who it favours cannot be told from the wording." },
    { clause: 2, heading: "Term", accept: ["balanced", "unclear"], why: "Runs to completion for both; completion is undefined elsewhere." },
    { clause: 3, heading: "Fees", accept: ["unclear", "balanced"], why: "An ordinary split payment, but \"Completion\" is undefined, so when the second half is due is unclear." },
    { clause: 4, heading: "Liability", accept: ["one-sided"], favours: "Supplier", why: "The Supplier's liability is capped at NZ$500; the Client's is unlimited." },
    { clause: 5, heading: "Intellectual property", accept: ["one-sided"], favours: "Supplier", why: "The Client pays for the website and never owns it; its licence ends if fees fall behind." },
    { clause: 6, heading: "Changes", accept: ["one-sided"], favours: "Supplier", why: "Only the Supplier may change the scope, by notice, without the Client's agreement." },
    { clause: 7, heading: "Delay", accept: ["one-sided"], favours: "Supplier", why: "The Supplier is excused any delay however caused; the Client gets nothing in return." },
    { clause: 8, heading: "Payment default", accept: ["one-sided"], favours: "Supplier", why: "5% a month, about 60% a year, runs against the Client only; likely a penalty." },
    { clause: 9, heading: "Termination", accept: ["one-sided"], favours: "Supplier", why: "The Supplier may leave on 7 days' notice for any reason; the Client only for breach, on 90 days." },
    { clause: 10, heading: "Disputes", accept: ["one-sided"], favours: "Supplier", why: "The Supplier's own managing director decides every dispute, finally." },
    { clause: 11, heading: "Governing law", accept: ["unclear"], why: "Not stated at all, so it favours nobody; it is missing." },
  ],
};

export const BALANCED_AGREEMENT: AnswerKey = {
  asset: "balanced-services-agreement.txt",
  title: "Even-handed services agreement",
  answers: [
    { clause: 1, heading: "Services", accept: ["balanced"], why: "The scope is in a schedule that is attached and forms part of the agreement." },
    { clause: 2, heading: "Term", accept: ["balanced"], why: "Runs to completion or termination under clause 9, for both." },
    { clause: 3, heading: "Fees", accept: ["balanced"], why: "Completion is defined as the Client's acceptance, which it must not unreasonably withhold." },
    { clause: 4, heading: "Liability", accept: ["balanced"], why: "The same cap applies to each party, and neither limits liability for fraud." },
    { clause: 5, heading: "Intellectual property", accept: ["balanced"], why: "Ownership passes to the Client on full payment; each keeps what it owned before." },
    { clause: 6, heading: "Changes", accept: ["balanced"], why: "Changes need written agreement signed by both, stating any change to fees or timing." },
    { clause: 7, heading: "Delay", accept: ["balanced"], why: "Either party is excused delay beyond its reasonable control, on the same conditions." },
    { clause: 8, heading: "Payment default", accept: ["balanced", "one-sided"], favours: "Supplier", why: "Only the payee gets a remedy, but 1% a month and suspension on notice are ordinary; either reading is defensible." },
    { clause: 9, heading: "Termination", accept: ["balanced"], why: "Either party may end it on 30 days' notice, or for unremedied breach." },
    { clause: 10, heading: "Disputes", accept: ["balanced"], why: "Discussion, then mediation, then the courts, for both." },
    { clause: 11, heading: "Governing law", accept: ["balanced"], why: "New Zealand law, with non-exclusive jurisdiction." },
  ],
};

/**
 * A third agreement, written after both models had been measured on the first
 * two and never used to tune anything, so a score on it is not a score on
 * work the wording was fitted to. Its one-sided clauses favour the customer,
 * not the supplier: in the first two every one-sided clause favoured the
 * supplier, so a model that always answered "Supplier" could not be told apart
 * from one that read the clause.
 */
export const MIXED_AGREEMENT: AnswerKey = {
  asset: "mixed-services-agreement.txt",
  title: "Mixed bookkeeping agreement (held out)",
  answers: [
    { clause: 1, heading: "Services", accept: ["balanced"], why: "The scope is in a schedule that is attached and forms part of the agreement." },
    { clause: 2, heading: "Fees", accept: ["balanced"], why: "A monthly fee on ordinary 20-working-day terms." },
    { clause: 3, heading: "Price changes", accept: ["one-sided"], favours: "Customer", why: "Only the Customer may change the fee, and only downwards; the Contractor may never increase it." },
    { clause: 4, heading: "Liability", accept: ["one-sided"], favours: "Customer", why: "The Contractor's liability is unlimited; the Customer's is capped at one month's fees." },
    { clause: 5, heading: "Confidentiality", accept: ["balanced"], why: "The same duty on each party, with the same exception." },
    { clause: 6, heading: "Records", accept: ["unclear"], why: "\"An appropriate period\" is not a period; who it favours cannot be told." },
    { clause: 7, heading: "Termination", accept: ["one-sided"], favours: "Customer", why: "The Customer may leave at once for any reason; the Contractor must give six months' notice." },
    { clause: 8, heading: "Staff", accept: ["balanced"], why: "The same restriction on each party." },
    { clause: 9, heading: "Disputes", accept: ["balanced"], why: "Mediation by an agreed mediator before court, for both." },
    { clause: 10, heading: "Insurance", accept: ["unclear"], why: "No type of cover and no amount, so what it requires cannot be told." },
    { clause: 11, heading: "Governing law", accept: ["balanced"], why: "New Zealand law, applying to both." },
  ],
};

export const CLAUSE_BENCHMARK: readonly AnswerKey[] = [LOPSIDED_AGREEMENT, BALANCED_AGREEMENT, MIXED_AGREEMENT];
