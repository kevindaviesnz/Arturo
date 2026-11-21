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
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  createBusinessFunctionEntries,
  createBusinessFunctionEntry,
  readBusinessFunctionEntries,
} from "./uiBusinessFunctionEntries";

beforeEach(() => {
  clearBusinessFunctions();
});

describe("uiBusinessFunctionEntries", () => {
  it("creates a business function entry", () => {
    expect(
      createBusinessFunctionEntry(
        createBusinessFunctionRuntime({
          id: "run-1:function-2",
          label: "Market Research",
          objective: "Research Gen Z fashion trends.",
          ownerWorker: "auto-researcher",
        })
      )
    ).toEqual({
      actor: "Market Research",
      label: "draft",
      body: [
        "id: run-1:function-2",
        "owner: auto-researcher",
        "tasks: 0",
        "refinements: 0",
      ].join("\n"),
    });
  });

  it("creates empty-state entries", () => {
    expect(
      createBusinessFunctionEntries(
        []
      )
    ).toEqual([
      {
        actor: "Arturo",
        label: "Running Functions",
        body: "No running Functions found.",
      },
    ]);
  });

  it("reads stored business function entries", () => {
    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "run-1:function-2",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    expect(
      readBusinessFunctionEntries()
    ).toEqual([
      {
        actor: "Market Research",
        label: "draft",
        body: [
          "id: run-1:function-2",
          "owner: auto-researcher",
          "tasks: 0",
          "refinements: 0",
        ].join("\n"),
      },
    ]);
  });
});
