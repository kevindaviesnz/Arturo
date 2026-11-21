import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearWorkflowRuns,
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  formatWorkflowStatus,
  handleWorkflowStatusCommand,
} from "./workflowStatusCommands";

beforeEach(() => {
  clearBusinessFunctions();
  clearWorkflowRuns();
});

describe("workflowStatusCommands", () => {
  it("formats missing workflow run status", () => {
    expect(
      formatWorkflowStatus(
        "missing"
      )
    ).toBe(
      "workflow run not found: missing"
    );
  });

  it("formats draft workflow status", () => {
    const run =
      createWorkflowRun(
        "Build business",
        "Draft plan",
        "draft"
      );

    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: `${run.id}:function-1`,
        label: "Business Strategy",
        objective: "Define business model.",
        ownerWorker: "auto-planner",
      })
    );

    expect(
      formatWorkflowStatus(
        run.id
      )
    ).toBe(
      [
        "Workflow: run-1",
        "Objective: Build business",
        "",
        "Status: draft",
        "",
        "Progress:",
        "completed steps: 0 / 1",
        "tasks drafted: 1",
        "tasks created: 0",
        "",
        "Tasks:",
        "1. Business Strategy — draft",
      ].join("\n")
    );
  });

  it("prints usage when run id is missing", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    handleWorkflowStatusCommand([]);

    expect(log).toHaveBeenCalledWith(
      "Usage: /status <run-id>"
    );
  });
});
