import type {
  PolicyConflictStrategy,
} from "./policyConflictResolution";

import type {
  PolicyScope,
} from "./policyScope";

export type PolicyEvaluationOptions = {
  scopes?: readonly PolicyScope[];
  conflictStrategy?: PolicyConflictStrategy;
};