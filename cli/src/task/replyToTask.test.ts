import { describe, expect, it } from "vitest";
import type { Job } from "../runtime/jobQueue";
import { buildTaskReply, canReplyToTask, taskNeedsInput } from "./replyToTask";

function completedJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "task-1",
    task: "Find eco-friendly packaging suppliers in New Zealand.",
    worker: "Research AI worker",
    status: "completed",
    createdAt: 1_700_000_000_000,
    completedAt: 1_700_000_005_000,
    requestedBy: "Amy Wise",
    businessFunctionId: "fn-1",
    ...overrides,
  };
}

describe("taskNeedsInput", () => {
  it("detects when an AI worker asks for missing details or clarification", () => {
    expect(taskNeedsInput("Before I can complete this, please provide the target materials and budget.")).toBe(true);
    expect(taskNeedsInput("The agreement was not supplied. Could you attach the draft?")).toBe(true);
    expect(taskNeedsInput("Which packaging sizes are you looking for?")).toBe(true);
  });

  it("does not flag ordinary completed answers", () => {
    expect(
      taskNeedsInput(
        "Summary of Clauses:\n1. Indemnity is uncapped.\n2. Termination allows 7 days notice.\n3. Governing law is New Zealand.\n4. Liability cap is absent.\n5. IP transfers on payment.\n6. Confidentiality lasts 5 years.\n7. Payment is due in 30 days.\n8. Disputes go to mediation.\n9. No force majeure clause is included."
      )
    ).toBe(false);
    expect(taskNeedsInput("")).toBe(false);
    expect(taskNeedsInput(undefined)).toBe(false);
  });
});

describe("buildTaskReply", () => {
  it("builds governed createTask arguments preserving function, enterprise, artefacts, and metadata", () => {
    const plan = buildTaskReply(
      completedJob({ inputArtefactRefs: ["artefact-1@1"], clientId: "client-2" }),
      "task-1",
      "Recycled cardboard boxes, 20cm x 20cm, minimum order 500.",
      {
        functionLabel: "Supplier Research",
        enterpriseName: "Koru Toys",
        extraArtefactRef: "artefact-2@1",
      }
    );

    expect(plan.reply).toBe(true);
    if (!plan.reply) return;
    expect(plan.createArgs[0]).toContain("Find eco-friendly packaging suppliers in New Zealand.");
    expect(plan.createArgs[0]).toContain("Additional details supplied in reply to task-1:");
    expect(plan.createArgs[0]).toContain("Recycled cardboard boxes, 20cm x 20cm, minimum order 500.");
    expect(plan.createArgs).toContain("--function");
    expect(plan.createArgs).toContain("Supplier Research");
    expect(plan.createArgs).toContain("--enterprise");
    expect(plan.createArgs).toContain("Koru Toys");
    expect(plan.createArgs).toContain("--input-artefact");
    expect(plan.createArgs).toContain("artefact-1@1,artefact-2@1");
    expect(plan.createArgs).toContain("--client");
    expect(plan.createArgs).toContain("client-2");
    expect(plan.createArgs).toContain("--asked-by");
    expect(plan.createArgs).toContain("Amy Wise");
  });

  it("refuses empty replies, unfinished tasks, checks, and set-aside results", () => {
    expect(buildTaskReply(completedJob(), "task-1", "   ", {})).toMatchObject({ reply: false });
    expect(buildTaskReply(completedJob({ status: "running" }), "task-1", "Details", {})).toMatchObject({ reply: false });
    expect(buildTaskReply(completedJob(), "task-1", "Details", { isSetAside: true })).toMatchObject({ reply: false });
    expect(buildTaskReply(completedJob(), "task-1", "Details", { isCheck: true })).toMatchObject({ reply: false });
    expect(canReplyToTask(completedJob(), { isSetAside: true })).toBe(false);
    expect(canReplyToTask(completedJob())).toBe(true);
  });
});
