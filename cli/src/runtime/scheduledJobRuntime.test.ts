import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  dispatchScheduledJobs,
} from "./scheduledJobRuntime";

function createJob(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "job-1",
    task: "Run task",
    workflowId: "workflow-1",
    runAt: 100,
    createdAt: 50,
    status: "queued",
    ...overrides,
  };
}

describe(
  "scheduledJobRuntime",
  () => {
    it(
      "dispatches runnable jobs",
      () => {
        expect(
          dispatchScheduledJobs(
            [
              createJob({
                id: "job-1",
                runAt: 100,
              }),
              createJob({
                id: "job-2",
                runAt: 500,
              }),
            ],
            200
          )
        ).toEqual({
          remainingJobs: [
            createJob({
              id: "job-2",
              runAt: 500,
            }),
          ],

          executedJobs: [
            {
              scheduledJobId:
                "job-1",
              workflowId:
                "workflow-1",
            },
          ],
        });
      }
    );

    it(
      "does not dispatch future jobs",
      () => {
        expect(
          dispatchScheduledJobs(
            [
              createJob({
                runAt: 500,
              }),
            ],
            100
          )
        ).toEqual({
          remainingJobs: [
            createJob({
              runAt: 500,
            }),
          ],

          executedJobs: [],
        });
      }
    );

    it(
      "dispatches jobs deterministically",
      () => {
        expect(
          dispatchScheduledJobs(
            [
              createJob({
                id: "b",
                runAt: 100,
              }),
              createJob({
                id: "a",
                runAt: 100,
                createdAt: 10,
              }),
            ],
            200
          ).executedJobs.map(
            (job) =>
              job.scheduledJobId
          )
        ).toEqual([
          "a",
          "b",
        ]);
      }
    );
  }
);