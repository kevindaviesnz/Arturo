import {
  createHumanTaskEntries,
  formatOptionalTaskText,
} from "./uiHumanTaskEntries";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiHumanTaskEntries",
  () => {
    it(
      "formats missing optional task text",
      () => {
        expect(
          formatOptionalTaskText(
            undefined,
            "none"
          )
        ).toBe(
          "none"
        );
      }
    );

    it(
      "formats present optional task text",
      () => {
        expect(
          formatOptionalTaskText(
            "Review this",
            "none"
          )
        ).toBe(
          "Review this"
        );
      }
    );

    it(
      "creates an empty human task entry",
      () => {
        expect(
          createHumanTaskEntries(
            []
          )
        ).toEqual([
          {
            actor: "Arturo",
            label: "Human tasks",
            body: "No human tasks found.",
          },
        ]);
      }
    );

    it(
      "creates human task entries newest first",
      () => {
        const entries =
          createHumanTaskEntries([
            {
              id: "human-task-1",
              status: "open",
              createdAt: 1,
              title: "First",
              owner: "operator",
              purpose: "Review",
              instructions: "Check the first task.",
              sourceJobId: "job-1",
            },
            {
              id: "human-task-2",
              status: "completed",
              createdAt: 2,
              title: "Second",
              owner: "reviewer",
              instructions: "Check the second task.",
            },
          ] as never);

        expect(
          entries[0]
        ).toEqual({
          actor: "reviewer",
          label: "human-task-2 · completed",
          // Only rows that carry something: no purpose was given, the task
          // has no source Task, and nobody is recorded as having done it.
          body: [
            "title: Second",
            "instructions: Check the second task.",
          ].join("\n"),
        });
      }
    );
  }
);
