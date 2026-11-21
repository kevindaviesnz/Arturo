import { describe, expect, it } from "vitest";
import { buildTaskRetry } from "./taskRetry";
import type { Job } from "../runtime/jobQueue";

const failed = (fields: Partial<Job> = {}): Job =>
  ({
    id: "task-1",
    task: "Review the supplied agreement.",
    status: "failed",
    createdAt: 1,
    error: "Arturo could not reach the local AI model.",
    ...fields,
  }) as Job;

const OWNER = { functionLabel: "Client Advice", enterpriseName: "Harbour Legal" };

describe("buildTaskRetry", () => {
  it("rebuilds the command that created a failed Task", () => {
    expect(buildTaskRetry(failed(), "task-1", OWNER)).toEqual({
      retry: true,
      createArgs: ["Review the supplied agreement.", "--function", "Client Advice", "--enterprise", "Harbour Legal", "--write-only"],
    });
  });

  it("carries the supplied documents by reference, not the copy pasted into the instruction", () => {
    const result = buildTaskRetry(
      failed({
        task: "Review the supplied agreement.\n\nSupplied Artefacts\n\nReference: artefact-1@1\nContent:\n1. Services.\n\nEnd of Supplied Artefacts.",
        inputArtefactRefs: ["artefact-1@1", "artefact-2@3"],
      }),
      "task-1",
      OWNER
    );

    expect(result).toEqual({
      retry: true,
      createArgs: [
        "Review the supplied agreement.",
        "--function", "Client Advice",
        "--enterprise", "Harbour Legal",
        "--input-artefact", "artefact-1@1,artefact-2@3",
        "--write-only",
      ],
    });
  });

  it("leaves out an owner it was not given", () => {
    expect(buildTaskRetry(failed(), "task-1", {})).toEqual({ retry: true, createArgs: ["Review the supplied agreement.", "--write-only"] });
  });

  it("refuses a Task that does not exist or did not fail", () => {
    expect(buildTaskRetry(undefined, "task-9", OWNER)).toEqual({
      retry: false,
      reason: "No Task found with id task-9. Check /tasks for the exact id.",
    });
    for (const status of ["completed", "queued", "running", "awaiting_approval"] as const) {
      const result = buildTaskRetry(failed({ status }), "task-1", OWNER);
      expect(result.retry, status).toBe(false);
      expect(result).toMatchObject({ reason: expect.stringContaining(`Its status is ${status}.`) });
    }
  });

  it("refuses a Task whose context it cannot rebuild exactly, and says which", () => {
    const cases: readonly (readonly [Partial<Job>, string])[] = [
      [{ workflowRunId: "run-1" }, "it is a step of a Workflow run"],
      [{ webSearchQuery: "nz contract law" }, "it used a Web Search"],
      [{ sourceTaskId: "task-0" }, "it followed earlier work"],
      [{ sourceHumanTaskId: "human-task-1" }, "it followed earlier work"],
      [{ artefactApprovalDependencies: ["artefact-1@1"] }, "it waited on an Artefact approval"],
      [{ procedureRef: "proc-1@1" }, "it ran a Procedure"],
    ];

    for (const [fields, why] of cases) {
      const result = buildTaskRetry(failed(fields), "task-1", OWNER);
      expect(result).toMatchObject({ retry: false, reason: expect.stringContaining(why) });
      expect(result).toMatchObject({ reason: expect.stringContaining("Create it again with /task create") });
    }
  });
});
