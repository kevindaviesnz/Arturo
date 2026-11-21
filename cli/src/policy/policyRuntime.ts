import {
  loadPolicyRules,
} from "../storage/policyRepository";

import type {
  PolicyContext,
} from "./policyContext";

import type {
  PolicyDecision,
} from "./policyDecision";

import {
  evaluatePolicy,
} from "./policyEngine";

import {
  persistPolicyEvaluationEvent,
} from "./policyEventStore";

import type {
  PolicyEvaluationOptions,
} from "./policyEvaluationOptions";

import {
  resolvePolicyConflicts,
} from "./policyConflictResolution";

import {
  resolveInheritedPolicies,
} from "./policyInheritance";

/**
 * Evaluates persisted policy rules.
 *
 * @param context Policy evaluation context.
 * @returns Policy decision.
 *
 * SIDE EFFECT:
 * - Reads persisted policy rules.
 */
export function evaluateStrictRuntimePolicy(
  context: PolicyContext,
  options: PolicyEvaluationOptions = {}
): PolicyDecision {
  const inheritedPolicies =
    resolveInheritedPolicies(
      loadPolicyRules(),
      options.scopes ?? []
    );

  const resolvedPolicies =
    resolvePolicyConflicts(
      inheritedPolicies,
      options.conflictStrategy ??
        "first-match-wins"
    );

  return evaluatePolicy(
    resolvedPolicies,
    context
  );
}

/**
 * Evaluates persisted policy rules and records audit event.
 *
 * @param context Policy evaluation context.
 * @param timestamp Evaluation timestamp.
 * @returns Policy decision.
 *
 * SIDE EFFECT:
 * - Reads persisted policy rules.
 * - Reads persisted runtime event log.
 * - Writes persisted runtime event log.
 */
export function evaluateAndPersistRuntimePolicy(
  context: PolicyContext,
  timestamp: number,
  options: PolicyEvaluationOptions = {}
): PolicyDecision {
  const decision =
    evaluateStrictRuntimePolicy(
      context,
      options
    );

  return persistPolicyEvaluationEvent(
    context,
    decision,
    timestamp
  );
}


/** Compatibility name for strict access checks. Job execution uses jobGovernance. */
export const evaluateRuntimePolicy = evaluateStrictRuntimePolicy;
