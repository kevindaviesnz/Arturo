/**
 * Sign-off order (B10, G-A4): a result can't be signed off before the results
 * it was built from.
 *
 * "Built from" is the chain of Tasks each one followed (`sourceTaskId`, set by
 * createTask --follows, a route's steps and the Event path), walked back to
 * where it started. A result an AI model wrote must be signed off itself
 * before anything built on it is; a result that was set aside, failed or never
 * finished can't have anything built on it signed off at all. A result that
 * needs no sign-off (a person's record, a deterministic conversion) does not
 * hold anything up.
 *
 * The page shows each earlier result that holds a sign-off up, with where it
 * stands, beside the fixed line BUILT_ON_UNSIGNED_NOTE. signOffTaskResult
 * refuses with a fixed code before anything is written.
 *
 * SIDE EFFECT: Reads Task, sign-off and set-aside state.
 */

import { MAX_CHAIN_DEPTH } from "./chainLimits";
import { getJob, type Job } from "./jobQueue";
import { readResultSetAsideStanding } from "./resultSetAside";
import { readResultSignOffStanding } from "./resultSignOff";

/** Beside the sign-off, in plain words that can't be missed (Story A). */
export const BUILT_ON_UNSIGNED_NOTE = "This was built on an AI result you haven't signed off yet. Read that one first.";

export type EarlierResultState = "not_signed_off" | "set_aside" | "failed" | "not_finished";

export type EarlierResult = {
  readonly taskId: string;
  readonly task: string;
  readonly state: EarlierResultState;
};

/** How each state reads on the page. */
export const EARLIER_RESULT_WORDS: Readonly<Record<EarlierResultState, string>> = {
  not_signed_off: "Written by AI · not signed off",
  set_aside: "Set aside",
  failed: "Did not finish",
  not_finished: "Still being written",
};

export const SIGN_OFF_ORDER_CODES = ["built_on_unsigned", "built_on_set_aside", "built_on_unfinished"] as const;
export type SignOffOrderCode = (typeof SIGN_OFF_ORDER_CODES)[number];
export type SignOffOrderRefusal = { readonly code: SignOffOrderCode; readonly message: string };

const listed = (ids: readonly string[]) =>
  ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;

/** The fixed wording for each refusal. PURE: No side effects. */
export const SIGN_OFF_ORDER_WORDING: Readonly<Record<SignOffOrderCode, (taskId: string, earlier: readonly string[]) => string>> = {
  built_on_unsigned: (taskId, earlier) =>
    `${taskId} can't be signed off yet. It was built on ${listed(earlier)}, written by AI and not signed off yet. Read and sign off ${earlier.length === 1 ? "that one" : "those"} first, in order. Nothing was recorded.`,
  built_on_set_aside: (taskId, earlier) =>
    `${taskId} was built on ${listed(earlier)}, which ${earlier.length === 1 ? "was" : "were"} set aside, so it can't be signed off. Ask for the work again from a result you accept. Nothing was recorded.`,
  built_on_unfinished: (taskId, earlier) =>
    `${taskId} was built on ${listed(earlier)}, which did not finish, so it can't be signed off. Nothing was recorded.`,
};

/** Whether a finished result needs a person's sign-off before anything built on it may be signed. PURE. */
function needsSignOff(job: Job): boolean {
  // The same test sign-off itself uses (resultSignOff), with or without captured evidence.
  return Boolean(job.output?.startsWith("Evidence status: UNVERIFIED MODEL SYNTHESIS"));
}

/**
 * Every earlier result this one was built from that holds its sign-off up,
 * nearest first. Bounded by the chain limit, and safe against a loop.
 *
 * SIDE EFFECT: Reads Task, sign-off and set-aside state.
 */
export function earlierResultsHoldingSignOff(job: Job): EarlierResult[] {
  const held: EarlierResult[] = [];
  const seen = new Set<string>([job.id]);
  let next = job.sourceTaskId;
  for (let steps = 0; next && !seen.has(next) && steps <= MAX_CHAIN_DEPTH; steps += 1) {
    seen.add(next);
    const earlier = getJob(next);
    if (!earlier) break;
    const state: EarlierResultState | undefined =
      readResultSetAsideStanding(earlier).state === "set_aside" ? "set_aside"
      : earlier.status === "failed" ? "failed"
      : earlier.status !== "completed" ? "not_finished"
      : needsSignOff(earlier) && readResultSignOffStanding(earlier).state !== "signed" ? "not_signed_off"
      : undefined;
    if (state) held.push({ taskId: earlier.id, task: earlier.task, state });
    next = earlier.sourceTaskId;
  }
  return held;
}

/**
 * Why this result can't be signed off yet because of what it was built from,
 * or undefined. A set-aside or unfinished earlier result comes first, as no
 * sign-off can clear it.
 *
 * SIDE EFFECT: Reads Task, sign-off and set-aside state.
 */
export function refuseSignOffOrder(job: Job): SignOffOrderRefusal | undefined {
  const held = earlierResultsHoldingSignOff(job);
  const of = (state: EarlierResultState) => held.filter((one) => one.state === state).map((one) => one.taskId);
  const pick = (code: SignOffOrderCode, ids: string[]) => (ids.length ? { code, message: SIGN_OFF_ORDER_WORDING[code](job.id, ids) } : undefined);
  return (
    pick("built_on_set_aside", of("set_aside")) ??
    pick("built_on_unfinished", [...of("failed"), ...of("not_finished")]) ??
    // Oldest first: that is the order they are signed off in.
    pick("built_on_unsigned", of("not_signed_off").reverse())
  );
}
