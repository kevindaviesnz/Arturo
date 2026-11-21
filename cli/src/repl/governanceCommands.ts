import type { PolicyRule } from "../policy/policyRule";
import { createGovernanceSummary, findGovernancePolicy, type GovernanceSummary } from "../governance/governanceModel";
import { addGovernancePolicy, removeGovernancePolicy } from "../governance/governancePolicyCommands";
import { loadPolicyRules } from "../storage/policyRepository";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";

export const GOVERNANCE_USAGE = [
  "Usage:",
  "  /governance",
  "  /governance policy list",
  '  /governance policy inspect "<policy-id-or-description>"',
  '  /governance policy add "<description>" --effect <allow|deny|require-approval> --capability "<id>" [--risk <low|medium|high>] [--role <admin|operator|auditor|worker>] [--boundary <trusted|restricted|external|untrusted>] [--scope <enterprise|global>] [--enterprise "<enterprise-name-or-id>"]',
  '  /governance policy remove "<policy-id-or-description>"',
].join("\n");

export function formatGovernanceSummary(summary: GovernanceSummary): string {
  const lines = [
    "Governance", "",
    `Policies:          ${summary.policyCount}`,
    `Approval Rules:    ${summary.approvalRules}`,
    `Compliance Checks: ${summary.complianceChecks}`,
    `Audit Trail:       ${summary.auditTrail}`,
  ];
  if (summary.policyCount > 0) {
    lines.push("", "Use /governance policy list to inspect active rules.");
  }
  return lines.join("\n");
}

function formatMatch(rule: PolicyRule): string {
  const entries = Object.entries(rule.match);
  if (entries.length === 0) return "any work at all";
  // "capabilityId=analysis" is the stored shape; a reader being asked whether
  // the rule is right needs to know what it catches, not how it is keyed.
  const readable: Record<string, string> = {
    capabilityId: "work needing",
    workerName: "work done by",
    businessFunctionId: "work in",
    enterpriseId: "work in",
    riskLevel: "work whose risk is",
  };
  return entries
    .flatMap(([key, value]) => {
      // A boolean has no value worth printing — "consequentialOnly true" says
      // nothing to a reader deciding whether the rule is right. Say what it
      // catches, and drop it entirely when it is not narrowing anything.
      if (key === "consequentialOnly") {
        return value ? ["work with an effect outside Arturo"] : [];
      }
      return [`${readable[key] ?? key} ${value}`];
    })
    .join(", ");
}

/** Says what a rule does, rather than naming its stored effect. */
function describePolicyEffect(effect: string): string {
  const plain: Record<string, string> = {
    "require-approval": "a person has to approve it first",
    allow: "let it run",
    deny: "do not let it run",
  };
  return plain[effect] ?? effect.replace(/-/g, " ");
}

/** Says where a rule applies, rather than printing a composite id. */
function describePolicyScope(rule: PolicyRule): string {
  if (!rule.scope) return "everywhere";
  return `${rule.scope.type}: ${rule.scope.id}`;
}

export function formatGovernancePolicy(rule: PolicyRule): string {
  return [
    `Policy: ${rule.description}`,
    `  ID:              ${rule.id}`,
    `  Then:            ${describePolicyEffect(rule.effect)}`,
    `  Applies to:      ${formatMatch(rule)}`,
    `  Where:           ${describePolicyScope(rule)}`,
  ].join("\n");
}

export function formatGovernancePolicyList(rules: readonly PolicyRule[]): string {
  if (rules.length === 0) return "Governance policies\n\nNo policies configured.";
  return ["Governance policies", "", ...rules.flatMap((rule, index) => [
    `${index + 1}. ${rule.description}`,
    `   ID: ${rule.id}`,
    `   Applies to ${formatMatch(rule)} · then ${describePolicyEffect(rule.effect)} · ${describePolicyScope(rule)}`,
  ])].join("\n");
}

export function governanceCommandOutput(args: readonly string[] = []): { label: string; body: string } {
  const [subcommand, action, ...rest] = args;
  if (!subcommand) {
    broadcastEvent("governance.inspected", "success", "Governance inspected.");
    return { label: "Governance", body: formatGovernanceSummary(createGovernanceSummary(loadPolicyRules())) };
  }
  if (subcommand !== "policy") return { label: "Usage", body: GOVERNANCE_USAGE };

  if (action === "list") {
    broadcastEvent("governance.inspected", "success", "Governance policies inspected.");
    return { label: "Governance policies", body: formatGovernancePolicyList(loadPolicyRules()) };
  }
  if (action === "inspect") {
    const reference = rest[0];
    if (!reference) return { label: "Usage", body: GOVERNANCE_USAGE };
    const rule = findGovernancePolicy(loadPolicyRules(), reference);
    if (!rule) return { label: "Governance policy not found", body: `governance policy not found: ${reference}` };
    broadcastEvent("governance.policy.inspected", "success", `Governance policy inspected: ${rule.description}`);
    return { label: "Governance policy", body: formatGovernancePolicy(rule) };
  }
  if (action === "add") {
    const result = addGovernancePolicy(rest);
    return result.ok
      ? { label: "Governance policy added", body: formatGovernancePolicy(result.rule) }
      : { label: "Governance policy not added", body: result.error };
  }
  if (action === "remove") {
    const reference = rest[0];
    if (!reference) return { label: "Usage", body: GOVERNANCE_USAGE };
    const result = removeGovernancePolicy(reference);
    return result.ok
      ? { label: "Governance policy removed", body: `Removed ${result.rule.description} (${result.rule.id}).` }
      : { label: "Governance policy not removed", body: result.error };
  }
  return { label: "Usage", body: GOVERNANCE_USAGE };
}

export function handleGovernanceCommand(args: readonly string[] = []): void {
  console.log(governanceCommandOutput(args).body);
}
