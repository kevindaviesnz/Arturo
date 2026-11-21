import {
  describe,
  expect,
  it,
} from "vitest";

import {
  blogWorkflowDefinition,
} from "./kernelWorkflowPrototype";

describe(
  "blogWorkflowDefinition",
  () => {
    it(
      "defines deterministic blog workflow steps",
      () => {
        expect(
          blogWorkflowDefinition
        ).toEqual({
          id: "kernel-blog",

          name:
            "Kernel Blog Workflow",

          steps: [
            {
              id: "research",
              capability:
                "research",
            },
            {
              id: "writing",
              capability:
                "writing",
            },
            {
              id: "review",
              capability:
                "human-review",
            },
          ],
        });
      }
    );
  }
);