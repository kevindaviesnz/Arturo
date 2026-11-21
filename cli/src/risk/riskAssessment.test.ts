import {
  describe,
  expect,
  it,
} from "vitest";

import {
  chooseRiskResponse,
  evaluateRisk,
  getRiskLevelSeverity,
  selectHighestRiskSignal,
} from "./riskAssessment";

describe("riskAssessment", () => {
  it("orders Risk levels by severity", () => {
    expect(
      getRiskLevelSeverity(
        "low"
      )
    ).toBe(1);

    expect(
      getRiskLevelSeverity(
        "medium"
      )
    ).toBe(2);

    expect(
      getRiskLevelSeverity(
        "high"
      )
    ).toBe(3);
  });

  it("selects the highest Risk signal", () => {
    expect(
      selectHighestRiskSignal([
        {
          category: "technical",
          level: "low",
          reason: "Minor uncertainty.",
        },
        {
          category: "ethical",
          level: "high",
          reason: "Potential user harm.",
        },
      ])
    ).toEqual({
      category: "ethical",
      level: "high",
      reason: "Potential user harm.",
    });
  });

  it("responds to low Risk by proceeding", () => {
    expect(
      chooseRiskResponse({
        category: "operational",
        level: "low",
        reason: "Routine situation.",
      })
    ).toBe("proceed");
  });

  it("responds to medium operational Risk by assigning a specialist Worker", () => {
    expect(
      chooseRiskResponse({
        category: "operational",
        level: "medium",
        reason: "Process uncertainty detected.",
      })
    ).toBe("assign_specialist_worker");
  });

  it("responds to medium ethical Risk by requesting approval", () => {
    expect(
      chooseRiskResponse({
        category: "ethical",
        level: "medium",
        reason: "Potential user impact.",
      })
    ).toBe("request_approval");
  });

  it("responds to high ethical Risk by escalating to a human", () => {
    expect(
      chooseRiskResponse({
        category: "ethical",
        level: "high",
        reason: "Potential harm.",
      })
    ).toBe("escalate_to_human");
  });

  it("evaluates the Chapter 14 Hydration Reminder Risk example", () => {
    expect(
      evaluateRisk(
        {
          businessFunctionLabel: "Hydration Reminder",
          signals: [
            {
              category: "ethical",
              level: "medium",
              reason: "Potential user impact requires review.",
            },
          ],
        }
      )
    ).toMatchObject({
      businessFunctionLabel:
        "Hydration Reminder",
      category: "ethical",
      level: "medium",
      response: "request_approval",
    });
  });

  it("defaults to low operational Risk when no signals exist", () => {
    expect(
      evaluateRisk({
        businessFunctionLabel:
          "Hydration Reminder",
        signals: [],
      })
    ).toMatchObject({
      category: "operational",
      level: "low",
      response: "proceed",
    });
  });
});
