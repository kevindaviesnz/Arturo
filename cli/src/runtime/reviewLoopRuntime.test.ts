import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Job,
  ReviewLoopJobMetadata,
} from "./jobQueue";

import type {
  RejectedReviewLoopDecision,
  ReviewLoopDecision,
} from "./reviewLoopDecision";

import {
  buildReviewLoopRevisionPrompt,
  buildReviewLoopRevisionRouting,
  canContinueReviewLoop,
  createNextReviewLoopMetadata,
  formatRequiredRevisions,
  getCompletedJobOutput,
  isApprovedReviewLoopDecision,
  isRejectedReviewLoopDecision,
} from "./reviewLoopRuntime";

const baseReviewLoopMetadata: ReviewLoopJobMetadata = {
  loopId:
    "loop-1",
  draftWorkerName:
    "Writer AI",
  criticWorkerName:
    "Reviewer AI",
  decisionWorkerName:
    "Reviewer AI",
  attempt:
    1,
  maxAttempts:
    3,
};

const createCompletedJob = (
  output: string
): Job => ({
  id:
    "job-1",
  task:
    "Review draft.",
  status:
    "completed",
  output,
  createdAt:
    1,
});

/**
 * Tests the pure review-loop runtime helpers.
 */
describe("reviewLoopRuntime", () => {
  describe("isRejectedReviewLoopDecision", () => {
    it("detects rejected decisions", () => {
      const decision: ReviewLoopDecision = {
        decision:
          "rejected",
        reason:
          "Too generic.",
        requiredRevisions: [
          "Clarify feedback loops.",
        ],
        confidence:
          "medium",
      };

      expect(
        isRejectedReviewLoopDecision(
          decision
        )
      ).toBe(true);
    });

    it("rejects approved decisions", () => {
      const decision: ReviewLoopDecision = {
        decision:
          "approved",
        reason:
          "Clear enough.",
        confidence:
          "medium",
      };

      expect(
        isRejectedReviewLoopDecision(
          decision
        )
      ).toBe(false);
    });
  });

  describe("isApprovedReviewLoopDecision", () => {
    it("detects approved decisions", () => {
      const decision: ReviewLoopDecision = {
        decision:
          "approved",
        reason:
          "Clear enough.",
        confidence:
          "high",
      };

      expect(
        isApprovedReviewLoopDecision(
          decision
        )
      ).toBe(true);
    });

    it("rejects rejected decisions", () => {
      const decision: ReviewLoopDecision = {
        decision:
          "rejected",
        reason:
          "Too vague.",
        requiredRevisions: [
          "Explain Arturo more clearly.",
        ],
        confidence:
          "medium",
      };

      expect(
        isApprovedReviewLoopDecision(
          decision
        )
      ).toBe(false);
    });
  });

  describe("canContinueReviewLoop", () => {
    it("allows continuation before max attempts", () => {
      expect(
        canContinueReviewLoop(
          baseReviewLoopMetadata
        )
      ).toBe(true);
    });

    it("stops at max attempts", () => {
      expect(
        canContinueReviewLoop({
          ...baseReviewLoopMetadata,
          attempt:
            3,
        })
      ).toBe(false);
    });
  });

  describe("createNextReviewLoopMetadata", () => {
    it("increments the attempt", () => {
      expect(
        createNextReviewLoopMetadata(
          baseReviewLoopMetadata
        )
      ).toEqual({
        ...baseReviewLoopMetadata,
        attempt:
          2,
      });
    });
  });

  describe("formatRequiredRevisions", () => {
    it("formats revisions as bullet points", () => {
      expect(
        formatRequiredRevisions([
          "Explain Arturo in plain English.",
          "Mention feedback loops.",
        ])
      ).toBe(
        [
          "- Explain Arturo in plain English.",
          "- Mention feedback loops.",
        ].join("\n")
      );
    });
  });

  describe("getCompletedJobOutput", () => {
    it("prefers output over rawOutput", () => {
      expect(
        getCompletedJobOutput({
          id:
            "job-1",
          task:
            "Task",
          status:
            "completed",
          output:
            "clean output",
          rawOutput:
            "raw output",
          createdAt:
            1,
        })
      ).toBe("clean output");
    });

    it("falls back to rawOutput", () => {
      expect(
        getCompletedJobOutput({
          id:
            "job-1",
          task:
            "Task",
          status:
            "completed",
          rawOutput:
            "raw output",
          createdAt:
            1,
        })
      ).toBe("raw output");
    });

    it("returns empty string when no output exists", () => {
      expect(
        getCompletedJobOutput({
          id:
            "job-1",
          task:
            "Task",
          status:
            "completed",
          createdAt:
            1,
        })
      ).toBe("");
    });
  });

  describe("buildReviewLoopRevisionPrompt", () => {
    it("builds a revision prompt from a rejected decision", () => {
      const decision: RejectedReviewLoopDecision = {
        decision:
          "rejected",
        reason:
          "The explanation is too generic.",
        requiredRevisions: [
          "Explain Arturo as a workflow system.",
          "Mention review, rejection, and revision.",
        ],
        confidence:
          "medium",
      };

      const prompt =
        buildReviewLoopRevisionPrompt(
          "Explain Arturo clearly.",
          createCompletedJob(
            "Arturo is a generic conversational AI."
          ),
          decision
        );

      expect(
        prompt
      ).toContain(
        "Original objective:"
      );

      expect(
        prompt
      ).toContain(
        "Explain Arturo clearly."
      );

      expect(
        prompt
      ).toContain(
        "Arturo is a generic conversational AI."
      );

      expect(
        prompt
      ).toContain(
        "The explanation is too generic."
      );

      expect(
        prompt
      ).toContain(
        "- Explain Arturo as a workflow system."
      );

      expect(
        prompt
      ).toContain(
        "Reviewer rejection reason:"
      );
    });
  });

  describe("buildReviewLoopRevisionRouting", () => {
    it("creates routing metadata for the next attempt", () => {
      expect(
        buildReviewLoopRevisionRouting(
          baseReviewLoopMetadata
        )
      ).toEqual({
        reviewLoop: {
          ...baseReviewLoopMetadata,
          attempt:
            2,
        },
      });
    });
  });
});