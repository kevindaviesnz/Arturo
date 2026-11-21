import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearJobs, enqueueJob, getJob, replaceJob } from "./jobQueue";
import { approvalDecisionKind, isGovernedExecutionJob, releaseApprovedJob } from "./approvedJobRelease";

describe("releasing an approved Task", () => {
  beforeEach(clearJobs);
  afterEach(clearJobs);

  it("queues a governed Task to be executed, leaving it without a result", () => {
    const held = replaceJob({
      ...enqueueJob("Send the advice to the client.", undefined, { requiredCapabilities: ["email-send"] }),
      status: "awaiting_approval",
    });

    expect(isGovernedExecutionJob(held)).toBe(true);
    const released = releaseApprovedJob(held, "Human review approved");

    expect(released.status).toBe("queued");
    expect(released.approvedAt).toBeTypeOf("number");
    expect(getJob(held.id)?.output).toBeUndefined();
  });

  it("calls a decision on work still to run a release, and on a Human review a review", () => {
    expect(approvalDecisionKind({ requiredCapabilities: ["email-send"] })).toBe("release");
    expect(approvalDecisionKind({})).toBe("release");
    expect(approvalDecisionKind({ requiredCapabilities: ["human-review"] })).toBe("review");
  });

  it("completes a Human review with the review's own result", () => {
    const review = replaceJob({
      ...enqueueJob("Review the draft.", "Priya", { requiredCapabilities: ["human-review"] }),
      status: "awaiting_review",
    });

    expect(isGovernedExecutionJob(review)).toBe(false);
    const released = releaseApprovedJob(review, "Human review approved");

    expect(released.status).toBe("completed");
    expect(getJob(review.id)?.output).toBe("Human review approved");
  });

  it("treats a Task with no recorded capabilities as work still to run", () => {
    expect(isGovernedExecutionJob({})).toBe(true);
  });
});
