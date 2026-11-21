import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRunStep,
  clearWorkflowRuns,
  updateRunStepStatusByJobId,
  completeWorkflowRun,
  createWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
} from "./workflowRunStore";

beforeEach(() => {
  clearWorkflowRuns();
});

describe("workflowRunStore", () => {
  it("creates workflow runs with resettable ids", () => {
    const run =
      createWorkflowRun("demo");

    expect(run.id).toBe("run-1");
    expect(run.status).toBe("running");
  });

  it("appends workflow run steps", () => {
    const run =
      createWorkflowRun("blog");

    appendRunStep(run.id, {
      index: 0,
      capability: "writing",
      task: "Write about Arturo",
      jobId: "job-1",
      worker: "writer",
      status: "queued",
    });

    expect(
      getWorkflowRun(run.id)?.steps
    ).toEqual([
      {
        index: 0,
        capability: "writing",
        task: "Write about Arturo",
        jobId: "job-1",
        worker: "writer",
        status: "queued",
      },
    ]);
  });

  it("updates workflow run step status by job id", () => {
    const run =
      createWorkflowRun("blog");

    appendRunStep(run.id, {
      index: 0,
      capability: "writing",
      task: "Write",
      jobId: "job-1",
      worker: "writer",
      status: "queued",
    });

    updateRunStepStatusByJobId(
      "job-1",
      "completed"
    );

    expect(
      getWorkflowRun(run.id)
        ?.steps[0].status
    ).toBe("completed");
  });

  it("gets and lists workflow runs", () => {
    const run =
      createWorkflowRun("blog");

    expect(
      getWorkflowRun(run.id)
    ).toEqual(run);

    expect(
      listWorkflowRuns()
    ).toEqual([
      run,
    ]);
  });

  it("marks workflow runs completed", () => {
    const run =
      createWorkflowRun("demo");

    completeWorkflowRun(run.id);

    expect(
      getWorkflowRun(run.id)?.status
    ).toBe("completed");
  });

  it("clears workflow runs and resets ids", () => {
    createWorkflowRun("one");

    clearWorkflowRuns();

    const run =
      createWorkflowRun("two");

    expect(listWorkflowRuns()).toHaveLength(1);
    expect(run.id).toBe("run-1");
  });
});