import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  clearJobs,
} from "../runtime/jobQueue";

import {
  clearWorkflowRuns,
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  formatStartWorkflowResult,
  handleStartWorkflowCommand,
} from "./startWorkflowCommands";

beforeEach(() => {
  clearBusinessFunctions();
  clearJobs();
  clearWorkflowRuns();
  vi.clearAllMocks();
});

describe("startWorkflowCommands", () => {
  it("formats workflow start result", () => {
    expect(
      formatStartWorkflowResult(
        "run-1",
        [
          "job-1",
        ]
      )
    ).toBe(
      [
        "Workflow started.",
        "",
        "Run: run-1",
        "Tasks created: 1",
        "",
        "Use /tasks or /timeline to inspect progress.",
      ].join("\n")
    );
  });

  it("prints usage when run id is missing", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    handleStartWorkflowCommand([]);

    expect(log).toHaveBeenCalledWith(
      "Usage: /start <run-id>"
    );
  });

  it("starts a draft workflow run", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    const run =
      createWorkflowRun(
        "Build business",
        "Draft plan",
        "draft",
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

    handleStartWorkflowCommand([
      run.id,
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Workflow started.",
        "",
        "Run: run-1",
        "Tasks created: 1",
        "",
        "Use /tasks or /timeline to inspect progress.",
      ].join("\n")
    );
  });
});
