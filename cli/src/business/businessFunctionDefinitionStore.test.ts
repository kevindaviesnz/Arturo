import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinition,
  listBusinessFunctionDefinitions,
} from "./businessFunctionDefinitionStore";

beforeEach(() => {
  clearBusinessFunctionDefinitions();
});

describe("businessFunctionDefinitionStore", () => {
  it("creates and stores a business function definition", () => {
    const definition =
      createAndSaveBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "News Discovery",
        objective: "Find trusted articles.",
        executionMode: "continuous",
        requiredArchetypes: [
          "researcher",
        ],
        now: 1000,
      });

    expect(
      getBusinessFunctionDefinition(
        "enterprise-1:function-1"
      )
    ).toEqual(
      definition
    );

    expect(
      listBusinessFunctionDefinitions()
    ).toEqual([
      definition,
    ]);
  });
});