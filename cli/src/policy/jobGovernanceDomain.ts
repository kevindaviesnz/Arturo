import type { PolicyContext } from "./policyContext";
import type { PolicyDecision } from "./policyDecision";
import type { PolicyRule } from "./policyRule";

/** Trusted application composition only; never supplied by a Job or model. */
export type JobGovernanceDomain = (input: {
  context: PolicyContext;
  enterpriseId?: string;
}) => {
  contextForRule?: (rule: PolicyRule) => PolicyContext;
  unmatchedDecision?: PolicyDecision;
};
