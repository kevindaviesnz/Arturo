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
  refineBusinessFunction,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  formatTaskDetail,
  handleTaskDetailCommand,
} from "./taskDetailCommands";

beforeEach(() => {
  clearBusinessFunctions();
});

describe("taskDetailCommands", () => {
  it("formats missing task detail", () => {
    expect(
      formatTaskDetail(
        "missing"
      )
    ).toBe(
      "task not found: missing"
    );
  });

  it("formats task detail", () => {
    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "run-1:function-2",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    refineBusinessFunction(
      "run-1:function-2",
      "Focus on TikTok trend signals."
    );

    expect(
      formatTaskDetail(
        "run-1:function-2"
      )
    ).toBe(
      [
        "Market Research",
        "",
        "id: run-1:function-2",
        "status: draft",
        "owner: auto-researcher",
        "tasks: 0",
        "",
        "Objective:",
        "Research Gen Z fashion trends.",
        "",
        "Refinements:",
        "1. Focus on TikTok trend signals.",
      ].join("\n")
    );
  });

  it("prints usage when id is missing", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    handleTaskDetailCommand(
      []
    );

    expect(log).toHaveBeenCalledWith(
      "Usage: /task-detail <id>"
    );
  });
});
