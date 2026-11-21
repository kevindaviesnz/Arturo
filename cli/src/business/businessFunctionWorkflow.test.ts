import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PRODUCT_COMPANY_FUNCTIONS,
} from "./businessFunction";

import {
  createBusinessFunctionInstruction,
  createWorkflowPlanFromBusinessFunctions,
  createWorkflowStepsFromBusinessFunctions,
} from "./businessFunctionWorkflow";

describe("businessFunctionWorkflow", () => {
  it("creates a concrete business function instruction", () => {
    const instruction =
      createBusinessFunctionInstruction(
        PRODUCT_COMPANY_FUNCTIONS[0],
        "Build me an AI-native fast fashion business"
      );

    expect(instruction).toContain(
      "Business Strategy:"
    );

    expect(instruction).toContain(
      "Original business objective: Build me an AI-native fast fashion business"
    );

    expect(instruction).toContain(
      "Avoid vague summaries."
    );
  });

  it("creates workflow steps from business functions", () => {
    const steps =
      createWorkflowStepsFromBusinessFunctions(
        {
          businessPatternId:
            "product_company",
          functions:
            PRODUCT_COMPANY_FUNCTIONS,
        },
        "Build me an AI-native fast fashion business"
      );

    expect(
      steps.map((step) => step.archetype)
    ).toEqual([
      "planner",
      "researcher",
      "analyst",
      "creator",
      "analyst",
      "advisor",
      "advisor",
      "guardian",
      "planner",
    ]);

    expect(
      steps[3].instruction
    ).toContain(
      "Product Design:"
    );
  });

  it("creates a workflow plan from business functions", () => {
    expect(
      createWorkflowPlanFromBusinessFunctions(
        {
          businessPatternId:
            "product_company",
          functions:
            PRODUCT_COMPANY_FUNCTIONS,
        },
        "Build me an AI-native fast fashion business"
      )
    ).toMatchObject({
      objective:
        "Build me an AI-native fast fashion business",
      explanation:
        "Created a business-function workflow for product_company.",
    });
  });
});