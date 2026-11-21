import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createWorkflowDefinition,
} from "./workflowDefinition";

describe("createWorkflowDefinition", () => {
  it("creates a deterministic workflow definition", () => {
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

    expect(workflow).toEqual({
      id: "blog",
      name: "Blog Workflow",
      steps: [
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
      ],
    });
  });
});