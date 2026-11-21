import type {
  PolicyRule,
} from "./policyRule";

export type PolicyConflictStrategy =
  | "first-match-wins"
  | "deny-wins";

/**
 * Resolves policy rule conflicts.
 *
 * @param rules Candidate policy rules.
 * @param strategy Conflict resolution strategy.
 * @returns Ordered/resolved policy rules.
 *
 * PURE: No side effects.
 */
export function resolvePolicyConflicts(
  rules: readonly PolicyRule[],
  strategy: PolicyConflictStrategy
): PolicyRule[] {
  if (
    strategy ===
    "first-match-wins"
  ) {
    return [...rules];
  }

  if (
    strategy ===
    "deny-wins"
  ) {
    return [
      ...rules.filter(
        (rule) =>
          rule.effect === "deny"
      ),
      ...rules.filter(
        (rule) =>
          rule.effect !== "deny"
      ),
    ];
  }

  return [...rules];
}