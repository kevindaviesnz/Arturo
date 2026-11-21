import type { NextAction, NextActionState } from "../runtime/nextActions";
import { runtimeDb } from "./runtimeDatabase";

/**
 * Writes one next step, once. A second write for the same step is ignored, so
 * a completion or sign-off seen twice records one step.
 *
 * SIDE EFFECT: May insert one row.
 */
export function insertNextAction(action: NextAction): boolean {
  return runtimeDb
    .prepare("INSERT OR IGNORE INTO next_actions (id, source_job_id, kind, state, record_json) VALUES (?, ?, ?, ?, ?)")
    .run(action.id, action.sourceJobId, action.kind, action.state, JSON.stringify(action)).changes === 1;
}

/**
 * Moves one step from one state to another. True only for the caller that
 * made the move, so a step is claimed once however many times it is seen.
 *
 * SIDE EFFECT: May update one row.
 */
export function moveNextAction(id: string, from: NextActionState, to: NextActionState, at: number): boolean {
  const row = loadNextAction(id);
  if (!row || row.state !== from) return false;
  const next: NextAction = { ...row, state: to, ...(to === "done" ? { doneAt: at } : to === "claimed" ? { claimedAt: at } : {}) };
  return runtimeDb
    .prepare("UPDATE next_actions SET state = ?, record_json = ? WHERE id = ? AND state = ?")
    .run(to, JSON.stringify(next), id, from).changes === 1;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadNextAction(id: string): NextAction | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM next_actions WHERE id = ?").get(id) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as NextAction) : undefined;
}

/** Steps not marked done, oldest first. SIDE EFFECT: Reads the runtime SQLite database. */
export function loadUnfinishedNextActions(): NextAction[] {
  const rows = runtimeDb.prepare("SELECT record_json AS recordJson FROM next_actions WHERE state != 'done' ORDER BY rowid").all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as NextAction);
}

/** SIDE EFFECT: Deletes every next step (tests and /reset). */
export function clearPersistedNextActions(): void {
  runtimeDb.prepare("DELETE FROM next_actions").run();
}
