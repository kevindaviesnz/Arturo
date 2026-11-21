import type { Job } from "./jobQueue";
import { evaluateJobGovernanceWithDomain, type JobGovernanceDecision } from "./jobGovernanceEngine";

export type { JobGovernanceDecision } from "./jobGovernanceEngine";
export { FAIL_CLOSED_CONSEQUENTIAL_RULE_ID, isConsequentialCapability } from "./jobGovernanceEngine";

/** Evaluates deterministic Governance policies for a Task. */
export function evaluateJobGovernance(job: Job): JobGovernanceDecision | undefined {
  return evaluateJobGovernanceWithDomain(job);
}
