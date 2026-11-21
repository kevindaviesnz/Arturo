import { describe, expect, it } from "vitest";
import { inferReviewLoopMetadata } from "./reviewLoopInference";

describe("inferReviewLoopMetadata", () => {
  it("infers feedback from archetypes without relying on worker names", () => {
    const steps = [
      { archetype: "creator" as const, workerName: "Studio 47" },
      { archetype: "reviewer" as const, workerName: "Quality Council" },
    ];

    expect(
      inferReviewLoopMetadata(steps, "run-9", "Quality Council")
    ).toEqual({
      loopId: "run-9",
      draftWorkerName: "Studio 47",
      criticWorkerName: "Quality Council",
      decisionWorkerName: "Quality Council",
      attempt: 1,
      maxAttempts: 3,
    });
  });

  it("does not invent a loop without a reviewer after the creator", () => {
    expect(
      inferReviewLoopMetadata(
        [{ archetype: "creator", workerName: "Writer" }],
        "run-1",
        "Writer"
      )
    ).toBeUndefined();
  });
});
