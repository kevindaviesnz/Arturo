import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatRiskAssessedEventMessage,
  riskLevelToRuntimeLevel,
} from "./riskRuntime";

describe("riskRuntime", () => {
  it("maps Risk levels to Runtime event levels", () => {
    expect(
      riskLevelToRuntimeLevel(
        "low"
      )
    ).toBe("info");

    expect(
      riskLevelToRuntimeLevel(
        "medium"
      )
    ).toBe("warn");

    expect(
      riskLevelToRuntimeLevel(
        "high"
      )
    ).toBe("error");
  });

  it("formats a Risk assessed Event message", () => {
    expect(
      formatRiskAssessedEventMessage({
        businessFunctionLabel:
          "Hydration Reminder",
        jobDescription:
          "Evaluate reminder safety.",
        category: "ethical",
        level: "medium",
        response: "request_approval",
        reason:
          "User intake is declining.",
        signals: [],
      })
    ).toBe(
      "Risk assessed: Hydration Reminder — ethical/medium — response: Request approval"
    );
  });
});