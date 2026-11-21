import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isWorkflowArchetype,
  isWorkflowStep,
  parseWorkflowPlan,
  instructionRequiresPublicationControl,
} from "./workflowPlanValidation";

describe("isWorkflowArchetype", () => {
  it("returns true for a valid archetype", () => {
    expect(
      isWorkflowArchetype(
        "researcher"
      )
    ).toBe(true);
  });

      it(
      "does not treat launch planning as final publication",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Create a launch campaign plan for Arturo."
          )
        ).toBe(false);
      }
    );

    it(
      "does not treat launch strategy as final publication",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Draft a launch strategy for the MVP."
          )
        ).toBe(false);
      }
    );

    it(
      "still detects direct launch execution",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Launch the campaign."
          )
        ).toBe(true);
      }
    );

  it("returns false for an invalid archetype", () => {
    expect(
      isWorkflowArchetype(
        "writer"
      )
    ).toBe(false);
  });
});

describe("isWorkflowStep", () => {
  it("returns true for a valid workflow step", () => {
    expect(
      isWorkflowStep({
        archetype: "researcher",
        instruction:
          "Research renewable energy.",
      })
    ).toBe(true);
  });

  it("returns false when instruction is empty", () => {
    expect(
      isWorkflowStep({
        archetype: "researcher",
        instruction: "",
      })
    ).toBe(false);
  });

  it("returns false for an unknown archetype", () => {
    expect(
      isWorkflowStep({
        archetype: "writer",
        instruction:
          "Write a report.",
      })
    ).toBe(false);
  });
});

describe(
  "instructionRequiresPublicationControl",
  () => {
    it(
      "does not treat reviewer handoff as publication",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Review the article before sending to Sarah."
          )
        ).toBe(false);
      }
    );

    it(
      "detects publication approval",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Approve final output before publication."
          )
        ).toBe(true);
      }
    );

    it(
      "detects launch actions",
      () => {
        expect(
          instructionRequiresPublicationControl(
            "Launch the release."
          )
        ).toBe(true);
      }
    );
  }
);

describe("parseWorkflowPlan", () => {
  it("parses a valid workflow plan", () => {
    expect(
      parseWorkflowPlan(
        JSON.stringify({
          objective:
            "Create a renewable energy report",
          steps: [
            {
              archetype: "researcher",
              instruction:
                "Research renewable energy.",
            },
            {
              archetype: "creator",
              instruction:
                "Create a report from the research.",
            },
            {
              archetype: "reviewer",
              instruction:
                "Review the report.",
            },
          ],
        })
      )
    ).toEqual({
      objective:
        "Create a renewable energy report",
      steps: [
        {
          archetype: "researcher",
          instruction:
            "Research renewable energy.",
        },
        {
          archetype: "creator",
          instruction:
            "Create a report from the research.",
        },
        {
          archetype: "reviewer",
          instruction:
            "Review the report.",
        },
      ],
    });
  });

  it("throws for invalid JSON", () => {
    expect(() =>
      parseWorkflowPlan(
        "not json"
      )
    ).toThrow();
  });

  it("throws for missing objective", () => {
    expect(() =>
      parseWorkflowPlan(
        JSON.stringify({
          steps: [
            {
              archetype: "researcher",
              instruction:
                "Research renewable energy.",
            },
          ],
        })
      )
    ).toThrow(
      "Invalid workflow objective"
    );
  });

  it("throws for empty steps", () => {
    expect(() =>
      parseWorkflowPlan(
        JSON.stringify({
          objective:
            "Create report",
          steps: [],
        })
      )
    ).toThrow(
      "Invalid workflow steps"
    );
  });

  it("throws for invalid step", () => {
    expect(() =>
      parseWorkflowPlan(
        JSON.stringify({
          objective:
            "Create report",
          steps: [
            {
              archetype: "writer",
              instruction:
                "Write report.",
            },
          ],
        })
      )
    ).toThrow(
      "Invalid workflow step"
    );
  });
});