import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionDefinition,
  setBusinessFunctionDescription,
  setBusinessFunctionObjective,
} from "./businessFunctionDefinition";

describe("businessFunctionDefinition", () => {
  it("creates a manual business function definition", () => {
    expect(
      createBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "News Discovery",
        objective: "Find relevant articles from trusted sources.",
        executionMode: "manual",
        requiredArchetypes: [
          "researcher",
        ],
        inputs: [
          "trusted source list",
        ],
        outputs: [
          "candidate article list",
        ],
        successCriteria: [
          "Only trusted sources are used.",
        ],
        policies: [
          "Avoid duplicate articles.",
        ],
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "News Discovery",
      objective: "Find relevant articles from trusted sources.",
      description: undefined,
      status: "declared",
      runtimeId: undefined,
      executionMode: "manual",
      requiredArchetypes: [
        "researcher",
      ],
      inputs: [
        "trusted source list",
      ],
      outputs: [
        "candidate article list",
      ],
      successCriteria: [
        "Only trusted sources are used.",
      ],
      policies: [
        "Avoid duplicate articles.",
      ],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("creates a declared business function with default values", () => {
    expect(
      createBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "Hydration Reminder",
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Hydration Reminder",
      objective: "",
      description: undefined,
      status: "declared",
      runtimeId: undefined,
      executionMode: "manual",
      requiredArchetypes: [],
      inputs: [],
      outputs: [],
      successCriteria: [],
      policies: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("creates a business function with a description", () => {
    expect(
      createBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "Hydration Reminder",
        description:
          "Determines when the user should be reminded to drink water, and what the reminder should say.",
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Hydration Reminder",
      objective: "",
      description:
        "Determines when the user should be reminded to drink water, and what the reminder should say.",
      status: "declared",
      runtimeId: undefined,
      executionMode: "manual",
      requiredArchetypes: [],
      inputs: [],
      outputs: [],
      successCriteria: [],
      policies: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("updates a business function description", () => {
    const definition =
      createBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "Hydration Reminder",
        now: 1000,
      });

    expect(
      setBusinessFunctionDescription(
        definition,
        "Determines when the user should be reminded to drink water, and what the reminder should say.",
        2000
      )
    ).toEqual({
      ...definition,
      description:
        "Determines when the user should be reminded to drink water, and what the reminder should say.",
      updatedAt: 2000,
    });
  });

  it("updates a business function objective", () => {
    const definition = createBusinessFunctionDefinition({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Quality and Verification",
      objective: "Challenge claims verify behaviour.",
      now: 1000,
    });

    expect(
      setBusinessFunctionObjective(
        definition,
        "Challenge claims, verify behaviour, and define completion evidence.",
        2000
      )
    ).toEqual({
      ...definition,
      objective: "Challenge claims, verify behaviour, and define completion evidence.",
      updatedAt: 2000,
    });
  });
});
