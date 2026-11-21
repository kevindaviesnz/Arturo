import {
  createWorkerEntries,
  formatWorkerCapabilities,
} from "./uiWorkerEntries";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiWorkerEntries",
  () => {
    it(
      "formats empty capabilities",
      () => {
        expect(
          formatWorkerCapabilities(
            [],
            5
          )
        ).toBe(
          "none"
        );
      }
    );

    it(
      "formats capabilities within the limit",
      () => {
        expect(
          formatWorkerCapabilities(
            [
              "llm",
              "research",
            ],
            5
          )
        ).toBe(
          "llm, research"
        );
      }
    );

    it(
      "formats capabilities beyond the limit",
      () => {
        expect(
          formatWorkerCapabilities(
            [
              "llm",
              "research",
              "writing",
            ],
            2
          )
        ).toBe(
          "llm, research +1 more"
        );
      }
    );

    it(
      "creates an empty worker entry",
      () => {
        expect(
          createWorkerEntries(
            []
          )
        ).toEqual([
          {
            actor: "Arturo",
            label: "Workers",
            body: "No workers found.",
          },
        ]);
      }
    );

    it(
      "creates worker entries",
      () => {
        const entries =
          createWorkerEntries([
            {
              name: "researcher",
              displayName: "Researcher",
              kind: "ai",
              archetype: "researcher",
              model: "llama3.2",
              trust: false,
              capabilities: [
                "llm",
                "research",
              ],
            },
          ] as never);

expect(
  entries
).toEqual([
  {
    actor: "Arturo",
    label: "Workers",
    body: [
      "Workers",
      "",
      "1.",
      "  Researcher",
      "  Type:         AI",
      "  Archetype:    researcher",
      "  Availability: available",
      "  Status:       Available",
      "  Current Tasks: 0",
    ].join("\n"),
  },
]);
      }
    );

    it(
      "identifies human workers and their participation mode",
      () => {
        const entries =
          createWorkerEntries([
            {
              name: "kevin",
              displayName: "Kevin",
              kind: "human",
              archetype: "guardian",
              humanMode: "approval",
              availability: "available",
            },
          ] as never);

        expect(entries[0].body).toContain(
          "Type:         Human"
        );
        expect(entries[0].body).toContain(
          "Participation: approval"
        );
        expect(entries[0].body).toContain(
          "Email:        none"
        );
      }
    );
  }
);
