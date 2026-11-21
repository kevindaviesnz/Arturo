import {
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  appendRuntimeEvent,
} from "../runtime/runtimeEventLog";

import type {
  PolicyContext,
} from "./policyContext";

import type {
  PolicyDecision,
} from "./policyDecision";

import {
  createPolicyEvaluatedEvent,
} from "./policyEvents";

/**
 * Persists policy evaluation event.
 *
 * @param context Policy evaluation context.
 * @param decision Policy decision.
 * @param timestamp Event timestamp.
 * @returns Policy decision.
 *
 * SIDE EFFECT:
 * - Reads persisted runtime event log.
 * - Writes persisted runtime event log.
 */
export function persistPolicyEvaluationEvent(
  context: PolicyContext,
  decision: PolicyDecision,
  timestamp: number
): PolicyDecision {
  const log =
    loadRuntimeEventLog();

  saveRuntimeEventLog(
    appendRuntimeEvent(
      log,
      createPolicyEvaluatedEvent(
        log.events.length + 1,
        context,
        decision,
        timestamp
      )
    )
  );

  return decision;
}