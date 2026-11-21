import type {
  PolicyEffect,
} from "./policyRule";

export type PolicyDecision = {
  effect: PolicyEffect;
  matchedRuleId?: string;
};