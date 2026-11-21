import type {
  PolicyRule,
} from "../policy/policyRule";

import type {
  ProposedHumanApproval,
} from "./staffingPlanner";

/**
 * Turns the Human approval requirements in an applied staffing plan into
 * deterministic policy rules.
 *
 * `/staff` asks the operator to approve a plan that says, in as many words,
 * that a Function's work needs a person to sign it off. Applying the plan
 * recorded that only as a staffing assignment, which nothing consulted except
 * the readiness check in `/function start`. A walkthrough took the `/suggest`
 * route instead, never started the Function, and watched a Task on a Function
 * marked "needs Human approval" run to completion with no approval requested
 * and no Human registered — while `/enterprise inspect` showed Policies (0).
 *
 * Deterministic policy evaluation is the product's claim, so the requirement
 * has to become a rule the engine evaluates, not a line of display text.
 */

/** Rule id for a Function's staffing-derived approval requirement. */
export function staffingApprovalRuleId(
  businessFunctionId: string
): string {
  return `staffing-approval:${businessFunctionId}`;
}

/**
 * Builds the approval rules an applied plan implies.
 *
 * The rule is scoped to the Enterprise and matched on the Business Function
 * *and* on whether the work has an effect outside Arturo. It used to match on
 * the Function alone, which gated everything that Function did — drafting,
 * analysis, summarising — and produced the complaint that "just about
 * everything needs my approval". Asking a person to authorise a paragraph of
 * analysis teaches them to approve without reading, which costs more than it
 * protects.
 *
 * Narrowing by consequence is not the same as narrowing by a named capability,
 * which `staffingApprovalPolicy.test.ts` rightly refuses: a named capability
 * is an enumeration whose complement grows silently, whereas
 * `isConsequentialCapability` is the same predicate the engine already uses to
 * fail closed when no rule matches at all (`jobGovernance.ts`). So the work
 * this rule now declines to gate is exactly the work governance had already
 * decided may run ungoverned — `consequential ⇒ gated` still holds everywhere.
 *
 * PURE: No side effects.
 */
export function buildStaffingApprovalRules(
  humanApprovals: readonly ProposedHumanApproval[],
  enterpriseId: string,
  labelFor: (businessFunctionId: string) => string
): readonly PolicyRule[] {
  const seen = new Set<string>();

  return humanApprovals.flatMap(
    (approval) => {
      if (seen.has(approval.functionId)) return [];
      seen.add(approval.functionId);

      return [{
        id: staffingApprovalRuleId(
          approval.functionId
        ),
        description: `Human approval required before ${labelFor(approval.functionId)} does anything with an effect outside Arturo, from the staffing plan you applied.`,
        match: {
          businessFunctionId: approval.functionId,
          consequentialOnly: true,
        },
        effect: "require-approval" as const,
        scope: {
          type: "organization" as const,
          id: enterpriseId,
        },
        requiredApprovals: 1,
      }];
    }
  );
}

/**
 * Merges new approval rules into the existing set.
 *
 * Approval rules go first: conflict resolution is first-match-wins, and a
 * requirement the operator explicitly approved must not be shadowed by a
 * broader allow rule written earlier. Re-running `/staff` replaces a Function's
 * rule rather than adding a second.
 *
 * PURE: No side effects.
 */
export function mergeStaffingApprovalRules(
  existing: readonly PolicyRule[],
  approvalRules: readonly PolicyRule[]
): readonly PolicyRule[] {
  const replaced = new Set(
    approvalRules.map((rule) => rule.id)
  );

  return [
    ...approvalRules,
    ...existing.filter(
      (rule) => !replaced.has(rule.id)
    ),
  ];
}
