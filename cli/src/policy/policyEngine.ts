import type {
  PolicyContext,
} from "./policyContext";

import type {
  PolicyRule,
} from "./policyRule";

import type {
  PolicyDecision,
} from "./policyDecision";

/**
 * Determines whether a policy rule matches
 * the supplied context.
 *
 * @param rule Policy rule.
 * @param context Policy evaluation context.
 * @returns True when rule matches.
 *
 * PURE: No side effects.
 */
export function policyRuleMatches(
  rule: PolicyRule,
  context: PolicyContext
): boolean {
  const capabilityMatches =
    !rule.match.capabilityId ||
    rule.match.capabilityId ===
      context.capabilityId;

  const riskMatches =
    !rule.match.riskLevel ||
    rule.match.riskLevel ===
      context.riskLevel;

  const roleMatches =
    !rule.match.role ||
    rule.match.role ===
      context.role;

  const trustBoundaryMatches =
    !rule.match.trustBoundary ||
    rule.match.trustBoundary ===
      context.trustBoundary;

  // A Function-scoped rule requires a known Function. Treating "no Function" as
  // a match would let unattributable work inherit another Function's approval
  // requirement; treating it as a wildcard would let it escape its own.
  const businessFunctionMatches =
    !rule.match.businessFunctionId ||
    rule.match.businessFunctionId ===
      context.businessFunctionId;

  // Compared against undefined rather than falsiness, unlike the clauses
  // above. `consequentialOnly: false` has to mean "work with no outside
  // effect", not "any work" — a rule that says false is making a statement,
  // where an absent field is declining to.
  const consequentialMatches =
    rule.match.consequentialOnly === undefined ||
    rule.match.consequentialOnly ===
      Boolean(context.consequential);

  return (
    capabilityMatches &&
    riskMatches &&
    roleMatches &&
    trustBoundaryMatches &&
    businessFunctionMatches &&
    consequentialMatches
  );
}

/**
 * Evaluates policy rules using deterministic first-match-wins semantics.
 *
 * Rules are order-sensitive. Earlier matching rules take precedence over later
 * matching rules. No matching rule is treated as deny-by-default.
 *
 * @param rules Ordered policy rules.
 * @param context Evaluation context.
 * @returns Policy decision.
 *
 * PURE: No side effects.
 */
export function evaluatePolicy(
  rules: readonly PolicyRule[],
  context: PolicyContext
): PolicyDecision {
  return evaluatePolicyAtBoundary(rules, context, "strict-access").decision!;
}

export type PolicyBoundary = "strict-access" | "job-execution";
export const FAIL_CLOSED_CONSEQUENTIAL_RULE_ID = "fail-closed:consequential-default";
export type PolicyEvaluation = { matchedRule?: PolicyRule; decision?: PolicyDecision };

/**
 * Shared first-match evaluation. Defaults are chosen explicitly by the caller's
 * boundary: access checks deny; consequential Jobs request approval; other Jobs
 * have no additional governance decision. Neither default implies execution.
 */
export function evaluatePolicyAtBoundary(
  rules: readonly PolicyRule[],
  context: PolicyContext,
  boundary: PolicyBoundary,
  contextForRule: (rule: PolicyRule) => PolicyContext = () => context
): PolicyEvaluation {
  const matchedRule = rules.find(rule => policyRuleMatches(rule, contextForRule(rule)));
  if (matchedRule) {
    return { matchedRule, decision: { effect: matchedRule.effect, matchedRuleId: matchedRule.id } };
  }
  if (boundary === "strict-access") return { decision: { effect: "deny" } };
  return {
    decision: context.consequential
      ? { effect: "require-approval", matchedRuleId: FAIL_CLOSED_CONSEQUENTIAL_RULE_ID }
      : undefined,
  };
}
