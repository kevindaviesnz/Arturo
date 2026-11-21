import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";

import {
  clearWorkflowRuns,
  createWorkflowRun,
  getWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  queueWorkflowExecution,
  queueWorkflowExecutionForRun,
} from "./queueWorkflowExecution";

beforeEach(() => {
  clearJobs();
  clearWorkflowRuns();
});

describe(
  "queueWorkflowExecution",
  () => {
    it(
      "queues execution for an existing workflow run",
      () => {
        const run =
          createWorkflowRun(
            "Existing draft",
            "Draft plan",
            "draft"
          );

        const jobIds =
          queueWorkflowExecutionForRun(
            run.id,
            {
              objective:
                "Existing draft",
              explanation:
                "Draft plan",
              steps: [
                {
                  archetype:
                    "researcher",
                  workerName:
                    "Researcher",
                  instruction:
                    "Research the market.",
                },
              ],
            }
          );

        expect(
          jobIds
        ).toHaveLength(
          1
        );

        expect(
          getWorkflowRun(
            run.id
          )?.steps
        ).toHaveLength(
          1
        );
      }
    );

    it(
      "queues only the first workflow step",
      () => {
        const result =
          queueWorkflowExecution({
            objective:
              "Create renewable energy report",

            steps: [
              {
                archetype:
                  "researcher",

                workerName:
                  "Albert Einstein",

                instruction:
                  "Research renewable energy.",
              },

              {
                archetype:
                  "creator",

                workerName:
                  "Isaac Asimov",

                instruction:
                  "Create the report.",
              },
            ],
          });

        expect(
          result.jobIds
        ).toHaveLength(
          1
        );

        expect(
          listJobs().map(
            (job) =>
              job.worker
          )
        ).toEqual([
          "Albert Einstein",
        ]);

        const run =
          getWorkflowRun(
            result.workflowRunId
          );

        expect(
          run?.steps
        ).toHaveLength(
          1
        );

        expect(
          run?.steps[0]
            .worker
        ).toBe(
          "Albert Einstein"
        );

        expect(
          run?.steps[0]
            .capability
        ).toBe(
          "researcher"
        );
      }
    );

    it(
      // A plan may be written by a model, so a search line in it never makes a step search (S4).
      "never turns a Workflow search line into search words",
      () => {
        const result =
          queueWorkflowExecution(
            {
              objective:
                "Research current fashion evidence",
              steps: [
                {
                  archetype:
                    "researcher",
                  workerName:
                    "Fashion Web Researcher",
                  instruction:
                    "Web search query: current recycled cotton outerwear trends",
                },
              ],
            },
            [],
            "enterprise-1"
          );
        const job =
          listJobs().find(
            (candidate) =>
              candidate.id ===
              result.jobIds[0]
          );

        expect(
          job
        ).toMatchObject({
          enterpriseId:
            "enterprise-1",
        });
        expect(job?.webSearchQuery).toBeUndefined();
      }
    );
  }
);
