import {
  appendPolicyAuditRecord,
  type PolicyAuditRecord,
} from "./policyAuditLog";

import {
  loadPolicyAuditLog,
  savePolicyAuditLog,
} from "../storage/policyAuditLogRepository";

import {
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import type {
  PolicyRule,
} from "./policyRule";

import {
  appendRuntimeEvent,
} from "../runtime/runtimeEventLog";

import {
  createPolicyCreatedEvent,
  createPolicyUpdatedEvent,
  createPolicyDeletedEvent,
} from "./policyAuditEvents";

/**
 * Records policy creation.
 *
 * @param rule Policy rule.
 *
 * SIDE EFFECT:
 * Persists audit record.
 */
export function recordPolicyCreated(
  rule: PolicyRule
): PolicyAuditRecord {
  const log =
    loadPolicyAuditLog();

  const record: PolicyAuditRecord = {
    id:
      `policy-audit-${
        log.length + 1
      }`,
    sequence:
      log.length + 1,
    action:
      "policy.created",
    policyId:
      rule.id,
    timestamp:
      Date.now(),
    rule,
  };

  savePolicyAuditLog(
    appendPolicyAuditRecord(
      log,
      record
    )
  );

  const timestamp =
    Date.now();

  const runtimeEventLog =
    loadRuntimeEventLog();

  saveRuntimeEventLog(
    appendRuntimeEvent(
      runtimeEventLog,
      createPolicyCreatedEvent(
        runtimeEventLog.events.length + 1,
        rule,
        timestamp
      )
    )
  );

  return record;
}

/**
 * Records policy update.
 *
 * @param rule Updated policy rule.
 *
 * SIDE EFFECT:
 * Persists audit record.
 */
export function recordPolicyUpdated(
  rule: PolicyRule
): PolicyAuditRecord {
  const log =
    loadPolicyAuditLog();

  const record: PolicyAuditRecord = {
    id:
      `policy-audit-${
        log.length + 1
      }`,
    sequence:
      log.length + 1,
    action:
      "policy.updated",
    policyId:
      rule.id,
    timestamp:
      Date.now(),
    rule,
  };

  savePolicyAuditLog(
    appendPolicyAuditRecord(
      log,
      record
    )
  );

  const timestamp =
    Date.now();

  const runtimeEventLog =
    loadRuntimeEventLog();

  saveRuntimeEventLog(
    appendRuntimeEvent(
      runtimeEventLog,
      createPolicyUpdatedEvent(
        runtimeEventLog.events.length + 1,
        rule,
        timestamp
      )
    )
  );

  return record;
}

/**
 * Records policy deletion.
 *
 * @param policyId Policy identifier.
 *
 * SIDE EFFECT:
 * Persists audit record.
 */
export function recordPolicyDeleted(
  policyId: string
): PolicyAuditRecord {
  const log =
    loadPolicyAuditLog();

  const record: PolicyAuditRecord = {
    id:
      `policy-audit-${
        log.length + 1
      }`,
    sequence:
      log.length + 1,
    action:
      "policy.deleted",
    policyId,
    timestamp:
      Date.now(),
  };

  savePolicyAuditLog(
    appendPolicyAuditRecord(
      log,
      record
    )
  );

  const timestamp =
    Date.now();

  const runtimeEventLog =
    loadRuntimeEventLog();

  saveRuntimeEventLog(
    appendRuntimeEvent(
      runtimeEventLog,
      createPolicyDeletedEvent(
        runtimeEventLog.events.length + 1,
        policyId,
        timestamp
      )
    )
  );

  return record;
}