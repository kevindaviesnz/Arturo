import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearRuntimeEventStore,
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  createHealthUsageEntry,
  handleUiHealthCommand,
} from "./uiHealthEntries";

describe("uiHealthEntries", () => {
  beforeEach(() => {
    clearBusinessFunctionDefinitions();
    clearRuntimeEventStore();
  });
    
afterEach(() => {
  clearRuntimeEventStore();
  clearBusinessFunctionDefinitions();
});

  it("creates a usage entry", () => {
    expect(
      createHealthUsageEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Usage",
      body: 'Use /health "<business-function-name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
    });
  });

  it("returns not found for an unknown Function", () => {
    expect(
      handleUiHealthCommand([
        "Missing Function",
      ])
    ).toEqual({
      actor: "Arturo",
      label: "Function not found",
      body: "function not found: Missing Function",
    });
  });

  it("returns a health report and records a health checked Event", () => {
    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Product Safety",
    });

    const entry =
      handleUiHealthCommand([
        "Product Safety",
      ]);

    expect(
      entry.actor
    ).toBe(
      "Arturo"
    );

    expect(
      entry.label
    ).toBe(
      "Health"
    );

    expect(
      entry.body
    ).toContain(
      "Overall Health:\n  Unknown"
    );

    expect(
      entry.body
    ).toContain(
      "Tasks Completed"
    );

    expect(
      listRuntimeEventStore().map(
        (event) =>
          event.type
      )
    ).toContain(
      "health.updated"
    );
  });
});
