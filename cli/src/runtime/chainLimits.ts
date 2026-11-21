/**
 * Every fixed limit on how far Arturo carries work on by itself, in one place
 * (scenario additions final, S8 and "Limits"). No setting raises any of them.
 *
 * chainLimits.test.ts asserts their order: AI-in-a-row (1 <= 2 <= 4) <= plan
 * steps (4) <= chain depth (6). A fan-in takes its deepest input plus 1.
 *
 * PURE: No side effects.
 */

/**
 * Everything Arturo starts by itself, across every kind of record, counted
 * by one `chainDepth` that createTask stamps: a Task that follows another is
 * one deeper than it (S2). Replaces MAX_FOLLOW_UP_DEPTH (3), which is retired.
 */
export const MAX_CHAIN_DEPTH = 6;

/**
 * AI results in a row with no person's sign-off (owner decision 10). Not the
 * same as MAX_ROUTE_STEPS or PASS_ON_STEPS.
 */
export const AI_IN_A_ROW = {
  /** Business work. */
  business: 4,
  /** On a law matter. */
  matter: 2,
  /** When Arturo is choosing the next step on a matter. */
  chosenOnMatter: 1,
} as const;

/** Rows in a plan, person steps included (agreed multi-worker brief). */
export const MAX_PLAN_STEPS = 4;

/** Every loop round, original and extended (S2, L3). */
export const MAX_LOOP_ROUNDS = 5;

/** How many times one result is passed on before it comes to a person: a check is never checked again. */
export const PASS_ON_STEPS = 1;

/** The most steps a route has after the business function it starts from. */
export const MAX_ROUTE_STEPS = 2;

/** Starts of one recurring job in a day, NZ time (subtasks and recurring jobs brief). The cost limit is the main brake. */
export const MAX_DAILY_STARTS = 20;

/** Results of one recurring job waiting for sign-off at once (subtasks and recurring jobs brief). */
export const MAX_AWAITING_SIGNOFF = 3;

/** Hours between switching on from a phone and it taking effect (phone switch-on brief). */
export const SWITCH_ON_COOLING_OFF_HOURS = 12;

/** The reason given for turning web search on for a business (W1, BC2), and the optional note for turning it off (W4). */
export const WEB_SEARCH_REASON_MAX_CHARS = 500;

/** The search words of one web step: a person's own, never a model's (S4). */
export const WEB_SEARCH_QUERY_MAX_CHARS = 500;
