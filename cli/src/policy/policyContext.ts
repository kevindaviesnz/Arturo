import type {
  CapabilityTrustBoundary,
} from "./capabilityTrustBoundary";

import type {
  PolicyRiskLevel,
} from "./policyRule";

import type {
  PolicyRole,
} from "./policyRole";

export type PolicyContext = {
  capabilityId: string;
  riskLevel: PolicyRiskLevel;
  role?: PolicyRole;
  trustBoundary?: CapabilityTrustBoundary;
  /**
   * The Business Function the work belongs to, when it is known.
   *
   * Governance reasoned only about how dangerous a capability is, which cannot
   * express "a person must sign off anything this Function does" — the
   * requirement `/staff` asks the operator to approve. Without it, a Function
   * the operator was told needs a Human approver ran Tasks unapproved whenever
   * those Tasks used ordinary capabilities.
   */
  businessFunctionId?: string;
  /**
   * Whether this capability has an effect outside Arturo.
   *
   * Supplied by the caller rather than derived here, because the predicate
   * (`isConsequentialCapability`) lives in `runtime/` and `policy/` sits below
   * it. Absent is read as false, so a caller that does not set it can only
   * ever fail to match a `consequentialOnly` rule — never match one by
   * accident.
   */
  consequential?: boolean;
};