import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildWorkflowStepPrompt,
} from "./buildWorkflowStepPrompt";

describe(
  "buildWorkflowStepPrompt",
  () => {
    it(
      "returns a task section when no previous output exists",
      () => {
        expect(
          buildWorkflowStepPrompt(
            "Research renewable energy.",
            ""
          )
        ).toContain(
`Task:

Research renewable energy.`
        );
      }
    );

    it(
      "includes previous output when provided",
      () => {
        expect(
          buildWorkflowStepPrompt(
            "Create a report.",
            "Solar power is growing rapidly."
          )
        ).toContain(
`Task:

Create a report.

Previous step output:

Solar power is growing rapidly.`
        );
      }
    );

    it(
      "preserves multi-line previous output",
      () => {
        expect(
          buildWorkflowStepPrompt(
            "Review the report.",
            `Line 1
Line 2
Line 3`
          )
        ).toContain(
`Task:

Review the report.

Previous step output:

Line 1
Line 2
Line 3`
        );
      }
    );

    it(
      "includes workflow context when provided",
      () => {
        expect(
          buildWorkflowStepPrompt(
            "Coach the article.",
            "Reviewer approved.",
            `Step 1 — Researcher:
Research output.`
          )
        ).toContain(
`Task:

Coach the article.

Previous step output:

Reviewer approved.

Workflow context:

Step 1 — Researcher:
Research output.`
        );
      }
    );

    it(
      "handles large outputs",
      () => {
        const previousOutput =
          "A".repeat(1000);

        const result =
          buildWorkflowStepPrompt(
            "Create report.",
            previousOutput
          );

        expect(
          result
        ).toContain(
          previousOutput
        );
      }
    );

    it(
      "handles whitespace-only previous output",
      () => {
        expect(
          buildWorkflowStepPrompt(
            "Research topic.",
            "   "
          )
        ).toContain(
`Task:

Research topic.`
        );
      }
    );
  }
);