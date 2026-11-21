import type {
  RuntimeEventRecord,
} from "../runtime/runtimeEventLog";

import type {
  PolicyRule,
} from "./policyRule";

/**
 * Creates policy created runtime event.
 *
 * @param sequence Runtime event sequence.
 * @param rule Created policy rule.
 * @param timestamp Event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createPolicyCreatedEvent(
  sequence: number,
  rule: PolicyRule,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `policy-created-${rule.id}-${timestamp}`,
    type: "policy.created",
    level: "info",
    message:
      `Policy created: ${rule.id}`,
    timestamp,
    payload: {
      policyId: rule.id,
      rule,
    },
  };
}

/**
 * Creates policy updated runtime event.
 *
 * @param sequence Runtime event sequence.
 * @param rule Updated policy rule.
 * @param timestamp Event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createPolicyUpdatedEvent(
  sequence: number,
  rule: PolicyRule,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `policy-updated-${rule.id}-${timestamp}`,
    type: "policy.updated",
    level: "info",
    message:
      `Policy updated: ${rule.id}`,
    timestamp,
    payload: {
      policyId: rule.id,
      rule,
    },
  };
}

/**
 * Creates policy deleted runtime event.
 *
 * @param sequence Runtime event sequence.
 * @param policyId Deleted policy id.
 * @param timestamp Event timestamp.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createPolicyDeletedEvent(
  sequence: number,
  policyId: string,
  timestamp: number
): RuntimeEventRecord {
  return {
    sequence,
    id:
      `policy-deleted-${policyId}-${timestamp}`,
    type: "policy.deleted",
    level: "warn",
    message:
      `Policy deleted: ${policyId}`,
    timestamp,
    payload: {
      policyId,
    },
  };
}