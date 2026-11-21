import type {
  CapabilityTrustBoundary,
} from "./capabilityTrustBoundary";

import type {
  PolicyRole,
} from "./policyRole";

import type {
  PolicyScope,
} from "./policyScope";

export type PolicyEffect =
  | "allow"
  | "deny"
  | "require-approval";

export type PolicyRiskLevel =
  | "low"
  | "medium"
  | "high";

export type PolicyMatch = {
  capabilityId?: string;
  riskLevel?: PolicyRiskLevel;
  role?: PolicyRole;
  trustBoundary?: CapabilityTrustBoundary;
  /**
   * Restricts the rule to work belonging to one Business Function.
   *
   * A rule that names a Function matches nothing when the context has no
   * Function, so an unattributable Job can never be waved through by a rule
   * that was meant to govern a specific Function's work.
   */
  businessFunctionId?: string;
  /**
   * Restricts the rule to work that has an effect outside Arturo.
   *
   * A rule on a Business Function alone gates everything that Function does,
   * including drafting and analysis, which is how "just about everything needs
   * my approval" happened. This narrows a rule to the work that can actually
   * do something irreversible, without narrowing it by a *named* capability —
   * an enumeration whose complement grows silently every time a capability is
   * added.
   *
   * The predicate is `isConsequentialCapability` in
   * `runtime/jobGovernance.ts`, and the caller supplies its result as
   * `PolicyContext.consequential`. It is not evaluated here: `policy/` is
   * below `runtime/` and must not import from it.
   */
  consequentialOnly?: boolean;
};

/**
 * Policy rule evaluated by the policy engine.
 *
 * Rules are order-sensitive. The default policy conflict strategy is
 * first-match-wins, so earlier matching rules take precedence over later
 * matching rules.
 */
export type PolicyRule = {
  id: string;
  description: string;
  match: PolicyMatch;
  effect: PolicyEffect;
  scope?: PolicyScope;
  // For "require-approval" rules, how many approvals governance mandates. When
  // set, this is authoritative over any count supplied in job routing metadata,
  // so a rule can require e.g. two approvers rather than "one of anyone".
  requiredApprovals?: number;
};