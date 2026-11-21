import type { ApprovalDecisionKind } from "./approvalChainStore";
import { approveJob, replaceJob, type Job } from "./jobQueue";

/**
 * Whether approval of this Task authorises work that has yet to run.
 *
 * Governance holds such a Task before execution, so approving it must send it
 * to a Worker. A Task that *is* a Human review has nothing left to execute:
 * the approval is its result.
 *
 * PURE: No side effects.
 */
export function isGovernedExecutionJob(
  job: Pick<Job, "requiredCapabilities">
): boolean {
  return !(job.requiredCapabilities ?? []).includes("human-review");
}

/**
 * Says which of the two things a decision on this Task decides.
 *
 * One command answers both, and the record used to keep only "approved": a
 * go-ahead for work nobody had seen yet read exactly like acceptance of a
 * finished piece. The kind is written inside the signed decision so the record
 * cannot later be read as the stronger of the two.
 *
 * PURE: No side effects.
 */
export function approvalDecisionKind(
  job: Pick<Job, "requiredCapabilities">
): ApprovalDecisionKind {
  return isGovernedExecutionJob(job) ? "release" : "review";
}

/**
 * Applies a fully approved decision to its Task.
 *
 * A governed Task goes back on the queue to be executed; a Human review is
 * completed with `reviewOutput` as its result. The caller must already have
 * confirmed, with `refuseApprovalRelease`, that the approval chain is satisfied.
 *
 * Every decision surface releases through here. The terminal did this inline
 * and the review link completed whatever it was given, which for a governed
 * Task would have recorded the work as done without it ever running.
 *
 * SIDE EFFECT: Mutates and persists job state.
 */
export function releaseApprovedJob(
  job: Job,
  reviewOutput: string
): Job {
  return isGovernedExecutionJob(job)
    ? replaceJob({
        ...job,
        status: "queued",
        approvedAt: Date.now(),
      })
    : approveJob(job.id, reviewOutput);
}
