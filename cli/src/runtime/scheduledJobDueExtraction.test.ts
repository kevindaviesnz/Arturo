import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ScheduledJob,
} from "./scheduledJob";

import {
  extractDueScheduledJobs,
} from "./scheduledJobDueExtraction";

/**
 * Creates scheduled job fixture.
 *
 * @param overrides Partial scheduled job overrides.
 * @returns Scheduled job fixture.
 *
 * PURE: No side effects.
 */
function createScheduledJobFixture(
  overrides: Partial<ScheduledJob> = {}
): ScheduledJob {
  return {
    id: "scheduled-job-1",
    task: "Run task",
    workflowId: "workflow-1",
    runAt: 100,
    createdAt: 50,
    status: "queued",
    ...overrides,
  };
}

describe(
  "scheduledJobDueExtraction",
  () => {
    it(
      "extracts due jobs",
      () => {
        const result =
          extractDueScheduledJobs(
            [
              createScheduledJobFixture(
                {
                  id: "job-1",
                  runAt: 50,
                }
              ),
              createScheduledJobFixture(
                {
                  id: "job-2",
                  runAt: 150,
                }
              ),
            ],
            100
          );

        expect(
          result.dueJobs.map(
            (job) => job.id
          )
        ).toEqual([
          "job-1",
        ]);

        expect(
          result.futureJobs.map(
            (job) => job.id
          )
        ).toEqual([
          "job-2",
        ]);
      }
    );

    it(
      "treats exact timestamp as due",
      () => {
        const result =
          extractDueScheduledJobs(
            [
              createScheduledJobFixture(
                {
                  id: "job-1",
                  runAt: 100,
                }
              ),
            ],
            100
          );

        expect(
          result.dueJobs
        ).toHaveLength(1);

        expect(
          result.futureJobs
        ).toHaveLength(0);
      }
    );

    it(
      "returns empty groups for empty input",
      () => {
        expect(
          extractDueScheduledJobs(
            [],
            100
          )
        ).toEqual({
          dueJobs: [],
          futureJobs: [],
        });
      }
    );

    it(
      "does not mutate input jobs",
      () => {
        const jobs = [
          createScheduledJobFixture(),
        ];

        extractDueScheduledJobs(
          jobs,
          100
        );

        expect(jobs).toEqual([
          createScheduledJobFixture(),
        ]);
      }
    );
  }
);