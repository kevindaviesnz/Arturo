import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createWorkflowDefinition,
} from "./workflowDefinition";

import {
  runWorkflowDefinition,
} from "./runWorkflowDefinition";

describe("runWorkflowDefinition", () => {
  it("runs workflow steps in deterministic order", () => {
    const workflow =
      createWorkflowDefinition(
        "blog",
        "Blog Workflow",
        [
          {
            id: "research",
            capability: "research",
          },
          {
            id: "writing",
            capability: "writing",
          },
          {
            id: "review",
            capability: "human-review",
          },
        ]
      );

    const generator =
      runWorkflowDefinition(
        workflow,
        "AI startups"
      );

    const first =
      generator.next();

    expect(first.value).toEqual({
      type: "call",
      capability: "research",
      input: "AI startups",
    });

    const second =
      generator.next(
        "Research notes"
      );

    expect(second.value).toEqual({
      type: "call",
      capability: "writing",
      input: "Research notes",
    });

    const third =
      generator.next(
        "Draft article"
      );

    expect(third.value).toEqual({
      type: "call",
      capability: "human-review",
      input: "Draft article",
    });

    const done =
      generator.next(
        "Approved article"
      );

    expect(done.done).toBe(true);

    expect(done.value).toBe(
      "Approved article"
    );
  });
});