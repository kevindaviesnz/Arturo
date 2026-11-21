/**
 * How far Arturo may carry on by itself.
 *
 * Two paths create work without anyone typing: a Function measuring the
 * outcome of a completed Task and deciding follow-up work is warranted
 * (`businessFunctionRuntimeOutcome.ts`), and a Function reacting to an Event
 * that a job-completion rule published (`businessFunctionRuntimeEvaluator.ts`).
 * Both are model decisions, and a local model asked "is more work needed?"
 * will keep answering yes.
 *
 * Until this existed nothing bounded either one. There was no depth,
 * generation or ancestry concept anywhere in runtime/ or events/; the only
 * brake was a gate refusing to act on unverified model output at all, which
 * also meant Arturo could not continue ordinary work. Lifting that gate
 * without a replacement would have made an unbounded cascade the default.
 *
 * The shape is the review loop's, which is the one counted, terminating,
 * self-continuing loop this codebase already had: a counter carried on the
 * Job record, a pure predicate, and an explicit event when it is exhausted so
 * a chain that stops because it hit the limit can be told apart from one that
 * stopped because the model was finished.
 *
 * The bound is shared rather than duplicated because a chain can alternate
 * between the two paths — an outcome-created Task is attached to the Function,
 * so Event rules fire on it too. Two separate limits would each see a depth of
 * one, forever.
 *
 * PURE: No side effects.
 */

import type { Job } from "./jobQueue";
import { MAX_CHAIN_DEPTH } from "./chainLimits";

/**
 * The bound is now the one chain counter, MAX_CHAIN_DEPTH (6), in
 * chainLimits.ts. The old follow-on limit of 3 is retired (scenario additions
 * S2): createTask stamps the depth on every Task that follows another, so a
 * chain through a route, a pass-on, an Event or a follow-on is counted once.
 * The Job field keeps its stored name, followUpDepth.
 */
export { MAX_CHAIN_DEPTH };

/**
 * Whether a Function may create follow-on work from a Task that has finished.
 *
 * It did so for every running Function, and staffing a Function starts it,
 * so it was on for everyone while the staffing message said the Function
 * "only does the work you ask for directly". A first real run asked for four
 * Tasks and got eight: a Task that timed out led to "gather live data from
 * platform APIs", an instruction a model lifted from a note inside a supplied
 * document, and two more grew from that.
 *
 * It is now something the owner turns on for a Function, recorded as that
 * Function's execution mode.
 *
 * PURE: No side effects.
 */
export function functionContinuesByItself(
  definition: { readonly executionMode?: string }
): boolean {
  return definition.executionMode === "continuous";
}

/**
 * Whether this finished Task is one that follow-on work may grow from.
 *
 * Only work that completed. A Task that failed — timed out, refused by an
 * integrity check, model unreachable — has produced nothing to continue, and
 * "is more work needed?" asked of a failure is always answered yes.
 *
 * PURE: No side effects.
 */
export function mayGrowFollowOnWork(
  definition: { readonly executionMode?: string },
  job: Pick<Job, "status">
): boolean {
  return functionContinuesByItself(definition) && job.status === "completed";
}

/** How deep in a chain this Task is: 0 for one a person asked for. */
export function followUpDepthOf(job: Job | undefined): number {
  const depth = job?.followUpDepth;
  return typeof depth === "number" && Number.isFinite(depth) && depth > 0
    ? depth
    : 0;
}

/** Whether a completed Task may cause another to be created. */
export function canCreateFollowUpTask(parent: Job | undefined): boolean {
  return followUpDepthOf(parent) < MAX_CHAIN_DEPTH;
}

/** The chain depth of a Task created to follow `parent`. */
export const chainDepthOf = followUpDepthOf;

/** The generation to stamp on work created because `parent` finished. */
export function nextFollowUpDepth(parent: Job | undefined): number {
  return followUpDepthOf(parent) + 1;
}

/**
 * Says a chain stopped because it reached the limit, in the operator's words.
 *
 * Worth an event of its own: silence looks identical to a model deciding no
 * more work was needed, and those are different facts about the business.
 */
export function describeFollowUpLimitReached(parent: Job): string {
  return `Task ${parent.id} is ${MAX_CHAIN_DEPTH} steps of automatic follow-on work from something you asked for, so Arturo stopped there rather than carrying on by itself. Ask for the next step directly if it is still needed.`;
}
