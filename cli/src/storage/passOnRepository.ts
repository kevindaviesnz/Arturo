import type { PassOnDelivery, PassOnRequest, PassOnRule, RouteChain } from "../runtime/passOnRules";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnRule(functionId: string): PassOnRule | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_rules WHERE function_id = ?").get(functionId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as PassOnRule) : undefined;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnRules(): PassOnRule[] {
  const rows = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_rules ORDER BY function_id").all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as PassOnRule);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function savePassOnRule(rule: PassOnRule): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO pass_on_rules (function_id, record_json) VALUES (?, ?)").run(rule.functionId, JSON.stringify(rule));
}

/** SIDE EFFECT: Deletes one Function's rule. */
export function deletePassOnRule(functionId: string): void {
  runtimeDb.prepare("DELETE FROM pass_on_rules WHERE function_id = ?").run(functionId);
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnRequest(jobId: string): PassOnRequest | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_requests WHERE job_id = ?").get(jobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as PassOnRequest) : undefined;
}

/** SIDE EFFECT: Inserts one row; a Task's choice is made once, when it is created. */
export function savePassOnRequest(request: PassOnRequest): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO pass_on_requests (job_id, record_json) VALUES (?, ?)").run(request.jobId, JSON.stringify(request));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnDelivery(sourceJobId: string): PassOnDelivery | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_deliveries WHERE source_job_id = ?").get(sourceJobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as PassOnDelivery) : undefined;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnDeliveryByNext(nextJobId: string): PassOnDelivery | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_deliveries WHERE next_job_id = ?").get(nextJobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as PassOnDelivery) : undefined;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadPassOnDeliveries(): PassOnDelivery[] {
  const rows = runtimeDb.prepare("SELECT record_json AS recordJson FROM pass_on_deliveries ORDER BY source_job_id").all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as PassOnDelivery);
}

/**
 * Claims a result for passing on. True only for the first claim: a result is
 * passed on once, however many times its completion is seen.
 *
 * SIDE EFFECT: May insert one row.
 */
export function claimPassOnDelivery(delivery: PassOnDelivery): boolean {
  const result = runtimeDb
    .prepare("INSERT OR IGNORE INTO pass_on_deliveries (source_job_id, next_job_id, record_json) VALUES (?, ?, ?)")
    .run(delivery.sourceTaskId, delivery.nextTaskId ?? null, JSON.stringify(delivery));
  return result.changes === 1;
}

/** SIDE EFFECT: Replaces one row. */
export function updatePassOnDelivery(delivery: PassOnDelivery): void {
  runtimeDb
    .prepare("UPDATE pass_on_deliveries SET next_job_id = ?, record_json = ? WHERE source_job_id = ?")
    .run(delivery.nextTaskId ?? null, JSON.stringify(delivery), delivery.sourceTaskId);
}

/**
 * Starts one route's chain. True only the first time for a result.
 *
 * SIDE EFFECT: May insert one row.
 */
export function claimRouteChain(chain: RouteChain): boolean {
  return runtimeDb.prepare("INSERT OR IGNORE INTO route_chains (start_job_id, record_json) VALUES (?, ?)").run(chain.startTaskId, JSON.stringify(chain)).changes === 1;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadRouteChain(startJobId: string): RouteChain | undefined {
  const row = runtimeDb.prepare("SELECT record_json AS recordJson FROM route_chains WHERE start_job_id = ?").get(startJobId) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as RouteChain) : undefined;
}

/** SIDE EFFECT: Replaces one row. */
export function updateRouteChain(chain: RouteChain): void {
  runtimeDb.prepare("UPDATE route_chains SET record_json = ? WHERE start_job_id = ?").run(JSON.stringify(chain), chain.startTaskId);
}

/** SIDE EFFECT: Deletes every rule, choice and delivery. */
export function clearPersistedPassOns(): void {
  runtimeDb.prepare("DELETE FROM route_chains").run();
  runtimeDb.prepare("DELETE FROM pass_on_rules").run();
  runtimeDb.prepare("DELETE FROM pass_on_requests").run();
  runtimeDb.prepare("DELETE FROM pass_on_deliveries").run();
}
