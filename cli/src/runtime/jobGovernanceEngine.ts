import type { Job } from "./jobQueue";
import type { PolicyContext } from "../policy/policyContext";
import type { PolicyDecision } from "../policy/policyDecision";
import { policyRuleMatches, evaluatePolicyAtBoundary } from "../policy/policyEngine";
import { persistPolicyEvaluationEvent } from "../policy/policyEventStore";
import { resolveInheritedPolicies } from "../policy/policyInheritance";
import { loadPolicyRules } from "../storage/policyRepository";
import { listBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { getBusinessFunctionDefinitionByRuntimeId } from "../business/businessFunctionDefinitionStore";
import { getCapabilityRiskLevel } from "../capabilities/capabilityCatalog";
import { requiresDefaultJobApproval as isConsequentialCapability } from "../capabilities/capabilityCatalog";
export { requiresDefaultJobApproval as isConsequentialCapability } from "../capabilities/capabilityCatalog";
import { resolveJobEnterpriseId, JobOrganisationConflictError } from "./jobOrganisation";
import type { JobGovernanceDomain } from "../policy/jobGovernanceDomain";

export type JobGovernanceDecision = PolicyDecision & {
  capabilityId: string;
  // Governance-authored approval count for require-approval decisions, when the
  // matching rule specifies one. Authoritative over job routing metadata.
  requiredApprovals?: number;
};

/** Marker rule id recorded when governance fails closed with no explicit rule. */
export { FAIL_CLOSED_CONSEQUENTIAL_RULE_ID } from "../policy/policyEngine";

/** Ranks effects so the most restrictive decision across capabilities wins. */
function effectPrecedence(effect: PolicyDecision["effect"]): number {
  if (effect === "deny") return 3;
  if (effect === "require-approval") return 2;
  return 1;
}


/**
 * The Business Function a Job belongs to.
 *
 * Prefers the id recorded on the Job itself. The runtime scan is kept as a
 * fallback for Jobs created before the field existed, but it only finds a
 * Function that is running — which is why it could not be relied on.
 */
function jobBusinessFunctionId(job: Job): string | undefined {
  if (job.businessFunctionId) return job.businessFunctionId;

  const runtime = listBusinessFunctions().find((candidate) => candidate.jobIds.includes(job.id));
  return runtime
    ? getBusinessFunctionDefinitionByRuntimeId(runtime.id)?.id
    : undefined;
}

function riskForCapability(capabilityId: string): PolicyContext["riskLevel"] {
  const risk = getCapabilityRiskLevel(capabilityId);
  if (risk === "critical") return "high";
  return risk === "low" || risk === "medium" || risk === "high" ? risk : "low";
}

/**
 * Evaluates governance across every capability a Job requests and returns the
 * most restrictive decision (deny > require-approval > allow).
 *
 * Unlike a first-match scan, this cannot be bypassed by listing a benign
 * capability ahead of a dangerous one. Consequential capabilities (high/critical
 * risk or external side effects) with no matching rule fail closed to
 * require-approval rather than executing ungoverned.
 */
export function evaluateJobGovernanceWithDomain(
  job: Job,
  resolveDomain: JobGovernanceDomain = () => ({})
): JobGovernanceDecision | undefined {
  let enterpriseId: string | undefined;
  try {
    enterpriseId = resolveJobEnterpriseId(job);
  } catch (error) {
    if (!(error instanceof JobOrganisationConflictError)) throw error;
    const capabilityId = job.requiredCapabilities?.[0] ?? "";
    const decision: PolicyDecision = { effect: "deny", matchedRuleId: "organisation-scope-conflict" };
    persistPolicyEvaluationEvent({ capabilityId, riskLevel: riskForCapability(capabilityId), role: "worker", trustBoundary: "restricted", businessFunctionId: job.businessFunctionId }, decision, Date.now());
    return { ...decision, capabilityId };
  }
  const scopes = [
    { type: "global" as const, id: "global" },
    ...(enterpriseId ? [{ type: "organization" as const, id: enterpriseId }] : []),
  ];
  const allRules = loadPolicyRules();
  const rules = resolveInheritedPolicies(allRules, scopes);

  const decisions: JobGovernanceDecision[] = [];
  const businessFunctionId = jobBusinessFunctionId(job);

  // A rule matching on Function, risk, role or boundary alone says nothing
  // about capabilities, so a Task that requests none must still be evaluated
  // against it — hence the sentinel.
  //
  // Note what that sentinel is *not* consequential: a Task declaring no
  // capability declares no effect outside Arturo, so it does not match a
  // consequentialOnly rule and is free to run. That is deliberate. It used to
  // be the reverse, and this comment used to justify the sentinel by saying
  // "this Function needs a Human" must not be escapable by asking for nothing
  // — true when a Function rule gated everything, wrong now that approval
  // tracks what the work can actually do.
  const capabilityIds =
    (job.requiredCapabilities ?? []).length > 0
      ? (job.requiredCapabilities ?? [])
      : [""];

  for (const capabilityId of capabilityIds) {
    const context: PolicyContext = {
      capabilityId,
      riskLevel: riskForCapability(capabilityId),
      role: "worker",
      trustBoundary: "restricted",
      businessFunctionId,
      consequential: isConsequentialCapability(capabilityId),
    };
    const domain = resolveDomain({ context, enterpriseId });
    const evaluation = evaluatePolicyAtBoundary(rules, context, "job-execution", domain.contextForRule);
    const matched = evaluation.matchedRule;
    if (matched) {
      const decision = evaluation.decision!;
      persistPolicyEvaluationEvent(context, decision, Date.now());
      decisions.push({
        ...decision,
        capabilityId,
        ...(typeof matched.requiredApprovals === "number"
          ? { requiredApprovals: matched.requiredApprovals }
          : {}),
      });
      continue;
    }

    const ambiguousEnterpriseRule = !enterpriseId
      ? allRules.find((rule) =>
          rule.scope?.type === "organization" && policyRuleMatches(rule, context)
        )
      : undefined;
    if (ambiguousEnterpriseRule) {
      const decision: PolicyDecision = {
        effect: "deny",
        matchedRuleId: ambiguousEnterpriseRule.id,
      };
      persistPolicyEvaluationEvent(context, decision, Date.now());
      decisions.push({ ...decision, capabilityId });
      continue;
    }

    // Domain defaults apply only after explicit policies and ambiguous-scope
    // refusal have been considered. All decisions retain the original audit context.
    const decision = domain.unmatchedDecision ?? evaluation.decision;
    if (decision) {
      persistPolicyEvaluationEvent(context, decision, Date.now());
      decisions.push({ ...decision, capabilityId });
    }
  }

  if (decisions.length === 0) return undefined;

  return decisions.reduce((mostRestrictive, candidate) =>
    effectPrecedence(candidate.effect) > effectPrecedence(mostRestrictive.effect)
      ? candidate
      : mostRestrictive
  );
}
