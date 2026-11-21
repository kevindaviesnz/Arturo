import type {
  PolicyRule,
} from "./policyRule";

import type {
  PolicyScope,
} from "./policyScope";

/**
 * Returns policies applicable
 * to a scope chain.
 *
 * PURE: No side effects.
 */
export function resolveInheritedPolicies(
  rules: readonly PolicyRule[],
  scopes: readonly PolicyScope[]
): PolicyRule[] {
  return rules.filter(
    (rule) =>
      !rule.scope ||
      scopes.some(
        (scope) =>
          scope.type ===
            rule.scope?.type &&
          scope.id ===
            rule.scope?.id
      )
  );
}