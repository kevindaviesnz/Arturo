/**
 * The durable next-step record (C2): what must happen after a Task finishes
 * or is signed off, written in the same transaction as that change, claimed
 * once, marked done, and replayed at start-up if Arturo stopped in between.
 *
 * "after-completion" covers the completion hooks: Events, pass-on, routes and
 * the outcome path. "after-sign-off" covers a route waiting for the sign-off
 * and a hand-off to a person. Each hook keeps its own one-time claim as well
 * (pass-on and route deliveries, hand-off deliveries, Event emissions), so a
 * replay finishes what was missed and never makes a step twice.
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import {
  clearPersistedNextActions,
  insertNextAction,
  loadNextAction,
  loadUnfinishedNextActions,
  moveNextAction,
} from "../storage/nextActionRepository";

/**
 * "outcome-follow-on" and "event-task" are one-time claims: on a result by
 * the outcome path, and on an Event and Function by the Event path (keyed
 * "<event id>:<function id>"). Each is written and done in one go, and a
 * replay has nothing to run for it.
 */
export type NextActionKind = "after-completion" | "after-sign-off" | "outcome-follow-on" | "event-task";
export type NextActionState = "pending" | "claimed" | "done";

export type NextAction = {
  readonly id: string;
  readonly kind: NextActionKind;
  readonly sourceJobId: string;
  readonly state: NextActionState;
  readonly at: number;
  /** Who signed off, for "after-sign-off". */
  readonly by?: string;
  readonly claimedAt?: number;
  readonly doneAt?: number;
};

/** PURE: No side effects. */
export function nextActionId(kind: NextActionKind, sourceJobId: string): string {
  return `${kind}:${sourceJobId}`;
}

/**
 * Writes the next step. Call it inside the transaction that records the
 * completion or sign-off. A step already written is left as it is.
 *
 * SIDE EFFECT: May insert one row.
 */
export function recordNextAction(kind: NextActionKind, sourceJobId: string, now = Date.now(), by?: string): boolean {
  return insertNextAction({ id: nextActionId(kind, sourceJobId), kind, sourceJobId, state: "pending", at: now, ...(by ? { by } : {}) });
}

/**
 * Claims the next step for running now. "claimed" for the first caller only;
 * "taken" when it was already claimed or done; "none" when no step was
 * written (work finished another way), which runs as before.
 *
 * SIDE EFFECT: May update one row.
 */
export function claimNextAction(kind: NextActionKind, sourceJobId: string, now = Date.now()): "claimed" | "taken" | "none" {
  const id = nextActionId(kind, sourceJobId);
  if (!loadNextAction(id)) return "none";
  return moveNextAction(id, "pending", "claimed", now) ? "claimed" : "taken";
}

/** SIDE EFFECT: May update one row. */
export function finishNextAction(kind: NextActionKind, sourceJobId: string, now = Date.now()): boolean {
  return moveNextAction(nextActionId(kind, sourceJobId), "claimed", "done", now);
}

/** SIDE EFFECT: Reads the runtime database. */
export function getNextAction(kind: NextActionKind, sourceJobId: string): NextAction | undefined {
  return loadNextAction(nextActionId(kind, sourceJobId));
}

/**
 * At start-up: every step not marked done is run again. A step claimed by a
 * run that stopped before finishing is released first. Each is claimed before
 * its handler runs and marked done after, so a second replay does nothing.
 *
 * SIDE EFFECT: Updates steps and runs their handlers.
 */
export async function replayNextActions(
  handlers: Readonly<Record<NextActionKind, (action: NextAction) => Promise<void> | void>>,
  now = Date.now()
): Promise<number> {
  let replayed = 0;
  for (const action of loadUnfinishedNextActions()) {
    if (action.state === "claimed") moveNextAction(action.id, "claimed", "pending", now);
    if (!moveNextAction(action.id, "pending", "claimed", now)) continue;
    try {
      await handlers[action.kind](action);
    } finally {
      moveNextAction(action.id, "claimed", "done", now);
    }
    replayed += 1;
  }
  return replayed;
}

/** SIDE EFFECT: Deletes every next step (tests and /reset). */
export function clearNextActions(): void {
  clearPersistedNextActions();
}
