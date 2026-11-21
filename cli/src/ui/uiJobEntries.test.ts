import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createJobWorkStreamEntry,
  createNumberedJobsListEntry,
  findJobByUiReference,
  formatTaskPreview,
} from "./uiJobEntries";

import {
  createJobDetailEntry,
} from "./uiJobDetailEntries";

describe(
  "uiJobEntries",
  () => {
    it(
      "keeps short task preview unchanged",
      () => {
        expect(
          formatTaskPreview(
            "Short task",
            20
          )
        ).toBe(
          "Short task"
        );
      }
    );

    it(
      "truncates long task preview",
      () => {
        expect(
          formatTaskPreview(
            "This is a very long task preview",
            10
          )
        ).toBe(
          "This is a ..."
        );
      }
    );

    it(
      "removes leading Task label from task preview",
      () => {
        expect(
          formatTaskPreview(
            "Task: Research customers",
            50
          )
        ).toBe(
          "Research customers"
        );
      }
    );

    it(
      "creates a job work stream entry",
      () => {
        expect(
          createJobWorkStreamEntry({
            id: "job-1",
            worker: "researcher",
            status: "queued",
            task: "Research Arturo",
          } as never)
        ).toEqual({
          actor: "researcher",
          label: "Task job-1 · queued",
          body: "Research Arturo",
        });
      }
    );

    it(
      "creates a recent jobs list in oldest-first numbered order",
      () => {
        const entry =
          createNumberedJobsListEntry(
            [
              {
                id: "job-1",
                worker: "researcher",
                status: "queued",
                task: "First task",
              },
              {
                id: "job-2",
                worker: "creator",
                status: "completed",
                task: "Second task",
              },
            ] as never,
            2
          );

expect(
  entry
).toEqual({
  actor: "Arturo",
  label: "Tasks",
  body: [
    "Tasks",
    "",
    "1. First task",
    "   ID: job-1",
    "   Status: Queued",
    "   Worker: researcher",
    "",
    "2. Second task",
    "   ID: job-2",
    "   Status: Completed",
    "   Worker: creator",
  ].join("\n"),
});
      }
    );

    it(
      "creates an empty jobs list entry",
      () => {
        expect(
          createNumberedJobsListEntry(
            [],
            5
          )
        ).toEqual({
          actor: "Arturo",
          label: "Tasks",
          body: "No tasks found.",
        });
      }
    );

    it(
      "finds latest job by UI reference",
      () => {
        const job =
          findJobByUiReference(
            [
              {
                id: "job-1",
                task: "First",
              },
              {
                id: "job-2",
                task: "Second",
              },
            ] as never,
            "latest"
          );

        expect(
          job?.id
        ).toBe(
          "job-2"
        );
      }
    );

    it(
      "finds first numbered job by oldest-first UI reference",
      () => {
        const job =
          findJobByUiReference(
            [
              {
                id: "job-1",
                task: "First",
              },
              {
                id: "job-2",
                task: "Second",
              },
            ] as never,
            "1"
          );

        expect(
          job?.id
        ).toBe(
          "job-1"
        );
      }
    );

    it(
      "finds second numbered job by oldest-first UI reference",
      () => {
        const job =
          findJobByUiReference(
            [
              {
                id: "job-1",
                task: "First",
              },
              {
                id: "job-2",
                task: "Second",
              },
            ] as never,
            "2"
          );

        expect(
          job?.id
        ).toBe(
          "job-2"
        );
      }
    );

    it(
      "finds full job id by UI reference",
      () => {
        const job =
          findJobByUiReference(
            [
              {
                id: "job-1",
                task: "First",
              },
              {
                id: "job-2",
                task: "Second",
              },
            ] as never,
            "job-2"
          );

        expect(
          job?.id
        ).toBe(
          "job-2"
        );
      }
    );

    it(
      "returns undefined for unknown UI reference",
      () => {
        expect(
          findJobByUiReference(
            [
              {
                id: "job-1",
                task: "First",
              },
            ] as never,
            "unknown"
          )
        ).toBeUndefined();
      }
    );
  }
);

describe(
  "uiJobDetailEntries legacy import coverage",
  () => {
    it(
      "creates job detail entry with current tidy layout",
      () => {
        const entry =
          createJobDetailEntry({
            id: "job-1",
            task: "Research Arturo",
            worker: "researcher",
            status: "completed",
            createdAt: 0,
            output: "Done.",
          } as never);

        expect(
          entry
        ).toEqual({
          actor: "",
          label: "Task details",
          body: [
            "Worker: Researcher",
            "ID: job-1",
            "Status: Completed",
            "  (Finished.)",
            "Task: 1 / 1",
            "Instruction: Research Arturo",
            "Sign-off: Nobody has signed off this result. Once you have read it and accept it: /task signoff job-1",
            "",
            "Done.",
          ].join("\n"),
        });
      }
    );
  }
);
