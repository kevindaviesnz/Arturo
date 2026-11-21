import type {
  PolicyAuditRecord,
} from "../policy/policyAuditLog";

let persistedPolicyAuditLog:
  PolicyAuditRecord[] = [];

/**
 * Loads persisted policy audit log.
 *
 * @returns Persisted policy audit records.
 *
 * SIDE EFFECT: Reads repository state.
 */
export function loadPolicyAuditLog():
  PolicyAuditRecord[] {
  return [
    ...persistedPolicyAuditLog,
  ];
}

/**
 * Saves policy audit log.
 *
 * @param log Policy audit records.
 *
 * SIDE EFFECT: Writes repository state.
 */
export function savePolicyAuditLog(
  log: readonly PolicyAuditRecord[]
): void {
  persistedPolicyAuditLog = [
    ...log,
  ];
}

/**
 * Clears policy audit log.
 *
 * SIDE EFFECT: Mutates repository state.
 */
export function clearPolicyAuditLog():
  void {
  persistedPolicyAuditLog = [];
}