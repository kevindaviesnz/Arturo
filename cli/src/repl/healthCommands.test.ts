import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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
  formatHealthIndicator,
  formatHealthReport,
  handleHealthCommand,
} from "./healthCommands";

describe("healthCommands", () => {
  beforeEach(() => {
    clearBusinessFunctionDefinitions();
    clearRuntimeEventStore();
    vi.restoreAllMocks();
  });

afterEach(() => {
  clearRuntimeEventStore();
  clearBusinessFunctionDefinitions();
  vi.restoreAllMocks();
});
    
  it("formats a health indicator", () => {
    expect(
      formatHealthIndicator({
        label: "Reminder Delivery",
        value: "98%",
      })
    ).toBe(
      "  Reminder Delivery        98%"
    );
  });

  it("formats a Product Safety health report", () => {
    expect(
      formatHealthReport({
        businessFunctionLabel: "Product Safety",
        overallHealth: "Healthy",
        indicators: [
          {
            label: "Reviews Completed",
            value: "98%",
          },
          {
            label: "First-pass Compliance",
            value: "84%",
          },
          {
            label: "Escaped Safety Defects",
            value: "0",
          },
        ],
        trend: "Improving",
      })
    ).toBe(
      [
        "Function:",
        "  Product Safety",
        "",
        "Overall Health:",
        "  Healthy",
        "",
        "Indicators",
        "  Reviews Completed        98%",
        "  First-pass Compliance    84%",
        "  Escaped Safety Defects   0",
        "",
        "Trend:",
        "  Improving",
      ].join("\n")
    );
  });

  it("prints usage when no Business Function is supplied", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleHealthCommand([]);

    expect(
      log
    ).toHaveBeenCalledWith(
      'Usage: /health "<job-name-or-id>" [--enterprise "<enterprise-name-or-id>"]'
    );
  });

  it("prints not found for an unknown Business Function", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleHealthCommand([
      "Missing Function",
    ]);

    expect(
      log
    ).toHaveBeenCalledWith(
      "function not found: Missing Function"
    );
  });

  it("prints health and records a health checked Event", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Product Safety",
    });

    handleHealthCommand([
      "Product Safety",
    ]);

    expect(
      log.mock.calls[0][0]
    ).toContain(
      "Overall Health:\n  Unknown"
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
