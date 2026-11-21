import {
  describe,
  expect,
  it,
} from "vitest";

import {
  colourPreviousStepOutput,
  createJobDetailEntry,
  createJobNotFoundEntry,
  createJobUsageEntry,
  findJobDisplayPosition,
  findPreviousWorkflowJob,
  formatCurrentJobSection,
  formatDisplayedJobTask,
  formatJobDisplayPosition,
  formatOptionalJobText,
  formatPreviousJobSection,
  formatPreviousStepOutputSection,
  formatWorkerDisplayName,
  normalizeDisplayedJobTask,
  splitDisplayedJobTask,
} from "./uiJobDetailEntries";

import {
  createNumberedJobsListEntry,
  findJobByUiReference,
} from "./uiJobEntries";

describe(
  "job detail task display helpers",
  () => {
    it(
      "removes a leading Task label",
      () => {
        expect(
          normalizeDisplayedJobTask(
            "Task: Research customers"
          )
        ).toBe(
          "Research customers"
        );
      }
    );

    it(
      "leaves task text unchanged when no leading Task label exists",
      () => {
        expect(
          normalizeDisplayedJobTask(
            "Research customers"
          )
        ).toBe(
          "Research customers"
        );
      }
    );

    it(
      "splits current task text from previous step output",
      () => {
        expect(
          splitDisplayedJobTask(
            [
              "Task:",
              "Analyse competitors",
              "",
              "Previous step output:",
              "Research summary",
            ].join("\n")
          )
        ).toEqual({
          task:
            "Analyse competitors",
          previousStepOutput:
            "Research summary",
        });
      }
    );

    it(
      "removes run context from current task text",
      () => {
        expect(
          splitDisplayedJobTask(
            [
              "Task:",
              "Analyse competitors",
              "",
              "Run context:",
              "Create a full operational workflow",
              "",
              "Run task: Validate product",
            ].join("\n")
          )
        ).toEqual({
          task:
            "Analyse competitors",
          previousStepOutput:
            undefined,
        });
      }
    );

    it(
      "colours previous step output gray",
      () => {
        expect(
          colourPreviousStepOutput(
            [
              "Analyse competitors",
              "",
              "Previous step output:",
              "Research summary",
            ].join("\n")
          )
        ).toBe(
          [
            "Analyse competitors",
            "",
            "{gray-fg}Previous step output:",
            "Research summary{/gray-fg}",
          ].join("\n")
        );
      }
    );

    it(
      "formats displayed job task as current task only",
      () => {
        expect(
          formatDisplayedJobTask(
            [
              "Task:",
              "Analyse competitors",
              "",
              "Previous step output:",
              "Research summary",
            ].join("\n")
          )
        ).toBe(
          "Analyse competitors"
        );
      }
    );

    it(
      "formats previous step output section",
      () => {
        expect(
          formatPreviousStepOutputSection(
            "Research summary"
          )
        ).toBe(
          "{gray-fg}Research summary{/gray-fg}"
        );
      }
    );

    it(
      "returns undefined for empty previous step output section",
      () => {
        expect(
          formatPreviousStepOutputSection(
            undefined
          )
        ).toBeUndefined();
      }
    );
  }
);

describe(
  "uiJobDetailEntries",
  () => {
    it(
      "formats missing optional job text",
      () => {
        expect(
          formatOptionalJobText(
            undefined,
            "none"
          )
        ).toBe(
          "none"
        );
      }
    );

    it(
      "keeps present optional job text",
      () => {
        expect(
          formatOptionalJobText(
            "Done",
            "none"
          )
        ).toBe(
          "Done"
        );
      }
    );

    it(
      "formats worker display name",
      () => {
        expect(
          formatWorkerDisplayName(
            "auto-analyst"
          )
        ).toBe(
          "Auto-analyst"
        );
      }
    );

    it(
      "formats missing worker display name",
      () => {
        expect(
          formatWorkerDisplayName(
            undefined
          )
        ).toBe(
          "None"
        );
      }
    );

    it(
      "finds job display position",
      () => {
        const jobs = [
          {
            id: "job-1",
            task: "First",
          },
          {
            id: "job-2",
            task: "Second",
          },
        ] as never;

        expect(
          findJobDisplayPosition(
            jobs[1],
            jobs
          )
        ).toBe(
          2
        );
      }
    );

    it(
      "formats job display position",
      () => {
        const jobs = [
          {
            id: "job-1",
            task: "First",
          },
          {
            id: "job-2",
            task: "Second",
          },
        ] as never;

        expect(
          formatJobDisplayPosition(
            jobs[1],
            jobs
          )
        ).toBe(
          "2 / 2"
        );
      }
    );

    it(
      "finds previous workflow job",
      () => {
        const jobs = [
          {
            id: "job-1",
            task: "Research",
            workflowRunId: "run-1",
            workflowStepIndex: 0,
          },
          {
            id: "job-2",
            task: "Analyse",
            workflowRunId: "run-1",
            workflowStepIndex: 1,
          },
        ] as never;

        expect(
          findPreviousWorkflowJob(
            jobs[1],
            jobs
          )?.id
        ).toBe(
          "job-1"
        );
      }
    );

    it(
  "creates a numbered jobs list in oldest-first order",
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
      entry.body
    ).toContain(
      "1. First task\n   ID: job-1\n   Status: Queued"
    );

    expect(
      entry.body
    ).toContain(
      "2. Second task\n   ID: job-2\n   Status: Completed"
    );

    expect(
      entry.body
    ).not.toContain(
      "id: job-1"
    );

    expect(
      entry.body
    ).not.toContain(
      "id: job-2"
    );
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
      "creates job usage entry",
      () => {
        expect(
          createJobUsageEntry()
        ).toEqual({
          actor: "Arturo",
          label: "Usage",
          body: '/task inspect "<task-id>"',
        });
      }
    );

    it(
      "creates job not found entry",
      () => {
        expect(
          createJobNotFoundEntry(
            "job-1"
          )
        ).toEqual({
          actor: "Arturo",
          label: "Task not found",
          body: "No task found with id or title: job-1",
        });
      }
    );

    it(
      "formats current job section",
      () => {
        expect(
          formatCurrentJobSection(
            {
              id: "job-1",
              task: "Research Arturo",
              worker: "researcher",
              status: "completed",
              createdAt: 0,
              output: "Done.",
            } as never,
            [
              {
                id: "job-1",
                task: "Research Arturo",
                worker: "researcher",
                status: "completed",
                createdAt: 0,
                output: "Done.",
              },
            ] as never
          )
        ).toBe(
          [
            "Worker: Researcher",
            "ID: job-1",
            "Status: Completed",
            "  (Finished.)",
            "Task: 1 / 1",
            "Instruction: Research Arturo",
            "Sign-off: Nobody has signed off this result. Once you have read it and accept it: /task signoff job-1",
            "",
            "Done.",
          ].join("\n")
        );
      }
    );

    it(
      "creates job detail entry",
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

    it(
      "creates job detail entry without duplicated Task label",
      () => {
        const entry =
          createJobDetailEntry({
            id: "job-1",
            task: "Task: Research Arturo",
            worker: "researcher",
            status: "completed",
            createdAt: 0,
            output: "Done.",
          } as never);

        expect(
          entry.body
        ).toContain(
          "Instruction: Research Arturo"
        );

        expect(
          entry.body
        ).not.toContain(
          "Instruction: Task:"
        );
      }
    );

    it(
      "formats previous job section from previous workflow job",
      () => {
        const jobs = [
          {
            id: "job-1",
            task: "Research customers",
            worker: "auto-researcher",
            status: "completed",
            workflowRunId: "run-1",
            workflowStepIndex: 0,
            createdAt: 0,
            output: "Previous job output",
          },
          {
            id: "job-2",
            task: "Analyse competitors",
            worker: "auto-analyst",
            status: "completed",
            workflowRunId: "run-1",
            workflowStepIndex: 1,
            createdAt: 0,
            output: "Current job output",
          },
        ] as never;

        expect(
          formatPreviousJobSection(
            jobs[1],
            jobs
          )
        ).toBe(
          [
            "────────────────────────────────────────",
            "",
            "Previous output",
            "",
            "Worker: Auto-researcher",
            "Task: 1 / 2",
            "Instruction: Research customers",
            "",
            "{gray-fg}Previous job output{/gray-fg}",
          ].join("\n")
        );
      }
    );

    it(
      "creates job detail entry with tidy previous output section",
      () => {
        const jobs = [
          {
            id: "job-1",
            task: "Research customers",
            worker: "auto-researcher",
            status: "completed",
            workflowRunId: "run-1",
            workflowStepIndex: 0,
            createdAt: 0,
            output: "Previous job output",
          },
          {
            id: "job-2",
            task: [
              "Task:",
              "Analyse competitors",
              "",
              "Run context:",
              "Create a full operational workflow",
              "",
              "Previous step output:",
              "Embedded previous output",
            ].join("\n"),
            worker: "auto-analyst",
            status: "completed",
            workflowRunId: "run-1",
            workflowStepIndex: 1,
            createdAt: 0,
            output: "Current job output",
          },
        ] as never;

        const entry =
          createJobDetailEntry(
            jobs[1],
            jobs
          );

        expect(
          entry.body
        ).toBe(
          [
            "Worker: Auto-analyst",
            "ID: job-2",
            "Status: Completed",
            "  (Finished.)",
            "Task: 2 / 2",
            "Instruction: Analyse competitors",
            "Sign-off: Nobody has signed off this result. Once you have read it and accept it: /task signoff job-2",
            "",
            "Current job output",
            "",
            "────────────────────────────────────────",
            "",
            "Previous output",
            "",
            "Worker: Auto-researcher",
            "Task: 1 / 2",
            "Instruction: Research customers",
            "",
            "{gray-fg}Previous job output{/gray-fg}",
          ].join("\n")
        );
      }
    );
  }
);
