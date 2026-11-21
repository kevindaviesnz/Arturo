import type {
  PolicyRule,
} from "./policyRule";

export type PolicyAuditAction =
  | "policy.created"
  | "policy.updated"
  | "policy.deleted";

export type PolicyAuditRecord = {
  id: string;
  sequence: number;
  action: PolicyAuditAction;
  policyId: string;
  timestamp: number;
  rule?: PolicyRule;
};

/**
 * Creates empty policy audit log.
 *
 * @returns Empty audit log.
 *
 * PURE: No side effects.
 */
export function createPolicyAuditLog():
  PolicyAuditRecord[] {
  return [];
}

/**
 * Appends policy audit record immutably.
 *
 * @param log Existing audit log.
 * @param record Audit record.
 * @returns Updated audit log.
 *
 * PURE: No side effects.
 */
export function appendPolicyAuditRecord(
  log: readonly PolicyAuditRecord[],
  record: PolicyAuditRecord
): PolicyAuditRecord[] {
  return [
    ...log,
    record,
  ];
}