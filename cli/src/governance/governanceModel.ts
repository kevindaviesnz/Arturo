import type { PolicyRule } from "../policy/policyRule";

export type GovernanceSummary = {
  readonly policyCount: number;
  readonly approvalRules: "Enabled" | "Disabled";
  readonly complianceChecks: "Active" | "Inactive";
  readonly auditTrail: "Enabled" | "Disabled";
};

/** Derives governance status from the policy rules that can actually execute. */
export function createGovernanceSummary(
  rules: readonly PolicyRule[]
): GovernanceSummary {
  return {
    policyCount: rules.length,
    approvalRules: rules.some((rule) => rule.effect === "require-approval")
      ? "Enabled"
      : "Disabled",
    complianceChecks: rules.length > 0 ? "Active" : "Inactive",
    auditTrail: "Enabled",
  };
}

/** Finds a stored policy by exact id or case-insensitive description. */
export function findGovernancePolicy(
  rules: readonly PolicyRule[],
  reference: string
): PolicyRule | undefined {
  const normalised = reference.trim().toLowerCase();
  return rules.find((rule) =>
    rule.id === reference || rule.description.toLowerCase() === normalised
  );
}
