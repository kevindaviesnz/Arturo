import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  clearBusinessFunctions,
  getBusinessFunction,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearJobs,
  listJobs,
} from "./jobQueue";

import {
  clearWorkflowRuns,
  createWorkflowRun,
  getWorkflowRun,
} from "./workflowRunStore";

import {
  startWorkflowRun,
} from "./startWorkflowRun";

beforeEach(() => {
  clearBusinessFunctions();
  clearJobs();
  clearWorkflowRuns();
});

describe("startWorkflowRun", () => {
  it("starts a draft workflow run", () => {
    const run =
      createWorkflowRun(
        "Build business",
        "Draft plan",
        "draft"
      );

    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id:
          `${run.id}:function-1`,
        label:
          "Business Strategy",
        objective:
          "Business Strategy: Define the business model.",
        ownerWorker:
          "auto-planner",
      })
    );

    const result =
      startWorkflowRun(
        run.id,
        {
          objective:
            "Build business",
          explanation:
            "Draft plan",
          steps: [
            {
              archetype:
                "planner",
              workerName:
                "auto-planner",
              instruction:
                "Business Strategy: Define the business model.",
            },
          ],
        }
      );

    expect(
      result.workflowRunId
    ).toBe(
      run.id
    );

    expect(
      result.jobIds
    ).toHaveLength(
      1
    );

    expect(
      listJobs()
    ).toHaveLength(
      1
    );

    expect(
      getWorkflowRun(
        run.id
      )?.status
    ).toBe(
      "running"
    );

    expect(
      getBusinessFunction(
        `${run.id}:function-1`
      )?.jobIds
    ).toEqual(
      result.jobIds
    );
  });

  it("rejects missing workflow runs", () => {
    expect(() =>
      startWorkflowRun(
        "missing",
        {
          objective:
            "Missing",
          steps: [
            {
              archetype:
                "planner",
              workerName:
                "auto-planner",
              instruction:
                "Plan.",
            },
          ],
        }
      )
    ).toThrow(
      "workflow run not found: missing"
    );
  });

  it("rejects non-draft workflow runs", () => {
    const run =
      createWorkflowRun(
        "Build business",
        "Draft plan",
        "running"
      );

    expect(() =>
      startWorkflowRun(
        run.id,
        {
          objective:
            "Build business",
          steps: [
            {
              archetype:
                "planner",
              workerName:
                "auto-planner",
              instruction:
                "Plan.",
            },
          ],
        }
      )
    ).toThrow(
      `workflow run is not draft: ${run.id}`
    );
  });
});