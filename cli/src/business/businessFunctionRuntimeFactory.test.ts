import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionRuntimeId,
  createBusinessFunctionRuntimesFromWorkflowPlan,
  getBusinessFunctionLabelFromStep,
} from "./businessFunctionRuntimeFactory";

describe("businessFunctionRuntimeFactory", () => {
  it("extracts a business function label from a step instruction", () => {
    expect(
      getBusinessFunctionLabelFromStep(
        {
          archetype: "researcher",
          instruction: "Market Research: Research Gen Z fashion trends.",
        },
        0
      )
    ).toBe("Market Research");
  });

  it("uses a fallback label when no label exists", () => {
    expect(
      getBusinessFunctionLabelFromStep(
        {
          archetype: "researcher",
          instruction: "",
        },
        1
      )
    ).toBe("Workflow step 2");
  });

  it("creates a stable runtime id", () => {
    expect(
      createBusinessFunctionRuntimeId(
        "run-1",
        2
      )
    ).toBe("run-1:function-3");
  });

  it("creates runtime business functions from a workflow plan", () => {
    expect(
      createBusinessFunctionRuntimesFromWorkflowPlan(
        "run-1",
        {
          objective: "Build me an AI-native fast fashion business",
          explanation: "Business-function workflow.",
          steps: [
            {
              archetype: "planner",
              workerName: "auto-planner",
              instruction: "Business Strategy: Define the operating model.",
            },
            {
              archetype: "researcher",
              workerName: "auto-researcher",
              instruction: "Market Research: Research customers.",
            },
          ],
        },
        [
          "auto-planner",
          "auto-researcher",
        ]
      )
    ).toEqual([
      {
        id: "run-1:function-1",
        label: "Business Strategy",
        objective: "Business Strategy: Define the operating model.",
        ownerWorker: "auto-planner",
        refinements: [],
        state: "draft",
        jobIds: [],
      },
      {
        id: "run-1:function-2",
        label: "Market Research",
        objective: "Market Research: Research customers.",
        ownerWorker: "auto-researcher",
        refinements: [],
        state: "draft",
        jobIds: [],
      },
    ]);
  });
});
