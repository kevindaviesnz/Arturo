import type { AgentArchetype } from "./agentArchetype";
import type { ReviewLoopJobMetadata } from "../runtime/jobQueue";

export type ReviewLoopStep = {
  readonly archetype: AgentArchetype;
  readonly workerName: string;
};

/**
 * Infers a generic creator/reviewer feedback loop from workflow semantics.
 * Worker names are data, never triggers. Explicit workflow loop declarations can
 * replace this conservative inference when the plan schema gains that field.
 */
export function inferReviewLoopMetadata(
  steps: readonly ReviewLoopStep[],
  workflowRunId: string,
  workerName: string,
  attempt = 1,
  maxAttempts = 3
): ReviewLoopJobMetadata | undefined {
  const creatorIndex = steps.findIndex((step) => step.archetype === "creator");
  if (creatorIndex < 0) {
    return undefined;
  }

  const reviewer = steps
    .slice(creatorIndex + 1)
    .find((step) => step.archetype === "reviewer");
  const creator = steps[creatorIndex];

  if (!reviewer || (workerName !== creator.workerName && workerName !== reviewer.workerName)) {
    return undefined;
  }

  return {
    loopId: workflowRunId,
    draftWorkerName: creator.workerName,
    criticWorkerName: reviewer.workerName,
    decisionWorkerName: reviewer.workerName,
    attempt,
    maxAttempts,
  };
}
