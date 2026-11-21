import { randomUUID } from "node:crypto";
import type {
  PolicyEffect,
  PolicyMatch,
  PolicyRiskLevel,
  PolicyRule,
} from "../policy/policyRule";
import type { PolicyRole } from "../policy/policyRole";
import type { CapabilityTrustBoundary } from "../policy/capabilityTrustBoundary";
import { recordPolicyCreated, recordPolicyDeleted } from "../policy/policyAuditRuntime";
import { loadEnterprises } from "../storage/enterpriseRepository";
import { loadPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { findGovernancePolicy } from "./governanceModel";
import { isWorkerCapability } from "../control/workers";

export type GovernanceMutationResult =
  | { ok: true; rule: PolicyRule }
  | { ok: false; error: string };

const effects: readonly PolicyEffect[] = ["allow", "deny", "require-approval"];
const risks: readonly PolicyRiskLevel[] = ["low", "medium", "high"];
const roles: readonly PolicyRole[] = ["admin", "operator", "auditor", "worker"];
const boundaries: readonly CapabilityTrustBoundary[] = ["trusted", "restricted", "external", "untrusted"];

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1]?.trim() : undefined;
}

function validOption<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string
): T | undefined {
  if (!value) return undefined;
  if (!allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Creates a validated, executable policy scoped to the current enterprise by default. */
export function addGovernancePolicy(args: readonly string[]): GovernanceMutationResult {
  const description = args[0]?.trim();
  if (!description) return { ok: false, error: "policy description must be a non-empty string" };

  try {
    const effect = validOption(option(args, "--effect"), effects, "effect");
    if (!effect) return { ok: false, error: "--effect is required" };

    const match: PolicyMatch = {};
    const capabilityId = option(args, "--capability");
    if (capabilityId && !isWorkerCapability(capabilityId)) {
      return { ok: false, error: `unknown executable Task capability: ${capabilityId}` };
    }
    const riskLevel = validOption(option(args, "--risk"), risks, "risk");
    const role = validOption(option(args, "--role"), roles, "role");
    const trustBoundary = validOption(option(args, "--boundary"), boundaries, "boundary");
    if (capabilityId) match.capabilityId = capabilityId;
    if (riskLevel) match.riskLevel = riskLevel;
    if (role) match.role = role;
    if (trustBoundary) match.trustBoundary = trustBoundary;
    if (Object.keys(match).length === 0) {
      return { ok: false, error: "at least one match is required: --capability, --risk, --role, or --boundary" };
    }

    const enterprises =
      loadEnterprises();
    const requestedScope = option(args, "--scope") ?? "enterprise";
    if (requestedScope !== "enterprise" && requestedScope !== "global") {
      return { ok: false, error: "scope must be enterprise or global" };
    }
    const enterpriseReference =
      option(
        args,
        "--enterprise"
      );
    if (
      requestedScope === "global" &&
      enterpriseReference
    ) {
      return {
        ok: false,
        error: "--enterprise cannot be combined with --scope global",
      };
    }
    const normalizedEnterpriseReference =
      enterpriseReference?.toLowerCase();
    const enterprise =
      enterpriseReference
        ? enterprises.find(
            (candidate) =>
              candidate.id ===
                enterpriseReference ||
              candidate.name.toLowerCase() ===
                normalizedEnterpriseReference
          )
        : enterprises.length === 1
          ? enterprises[0]
          : undefined;
    if (requestedScope === "enterprise" && !enterprise) {
      if (enterpriseReference) {
        return {
          ok: false,
          error: `enterprise not found: ${enterpriseReference}`,
        };
      }
      if (enterprises.length > 1 && !enterpriseReference) {
        return {
          ok: false,
          error: 'more than one enterprise exists; use --enterprise "<enterprise-name-or-id>"',
        };
      }
      return { ok: false, error: "no enterprise exists; use --scope global or create an enterprise first" };
    }

    const rules = loadPolicyRules();
    if (findGovernancePolicy(rules, description)) {
      return { ok: false, error: `governance policy already exists: ${description}` };
    }

    const rule: PolicyRule = {
      id: `policy-${randomUUID()}`,
      description,
      effect,
      match,
      ...(requestedScope === "enterprise"
        ? { scope: { type: "organization" as const, id: enterprise!.id } }
        : { scope: { type: "global" as const, id: "global" } }),
    };
    savePolicyRules([...rules, rule]);
    recordPolicyCreated(rule);
    return { ok: true, rule };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Removes one exact stored policy and audits the mutation. */
export function removeGovernancePolicy(reference: string): GovernanceMutationResult {
  const rules = loadPolicyRules();
  const rule = findGovernancePolicy(rules, reference);
  if (!rule) return { ok: false, error: `governance policy not found: ${reference}` };
  savePolicyRules(rules.filter((candidate) => candidate.id !== rule.id));
  recordPolicyDeleted(rule.id);
  return { ok: true, rule };
}
