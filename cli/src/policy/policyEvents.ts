import type {
  RuntimeEventRecord,
} from "../runtime/runtimeEventLog";

import type {
  PolicyContext,
} from "./policyContext";

import type {
  PolicyDecision,
} from "./policyDecision";

/**
 * Creates policy evaluated runtime event.
 *
 * @param sequence Runtime event sequence.
 * @param context Policy evaluation context.
 * @param decision Policy decision.
 * @param timestamp Event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createPolicyEvaluatedEvent(
  sequence: number,
  context: PolicyContext,
  decision: PolicyDecision,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `policy-evaluated-${sequence}`,
    type:
      "policy.evaluated",
    level:
      decision.effect === "deny"
        ? "warn"
        : "info",
    message:
      `Policy evaluated: ${decision.effect}`,
    timestamp,
    payload: {
      capabilityId:
        context.capabilityId,
      riskLevel:
        context.riskLevel,
      role:
        context.role,
      effect:
        decision.effect,
      matchedRuleId:
        decision.matchedRuleId,
    },
  };
}