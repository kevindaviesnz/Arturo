import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCronJob,
} from "./cronJob";

import {
  extractDueCronJobs,
} from "./cronJobDispatcher";

describe(
  "cronJobDispatcher",
  () => {
    it(
      "extracts due cron jobs",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            45,
            0
          ).getTime();

        const dueJob =
          createCronJob(
            "cron-job-1",
            "workflow-1",
            "30 * * * *",
            new Date(
              2026,
              0,
              1,
              10,
              0,
              0
            ).getTime()
          );

        const result =
          extractDueCronJobs(
            [dueJob],
            now
          );

        expect(
          result.dueJobs
        ).toHaveLength(1);

        expect(
          result.updatedJobs[0]
            .nextRunAt
        ).toBeGreaterThan(
          dueJob.nextRunAt
        );
      }
    );

    it(
      "ignores non-due jobs",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            10,
            0
          ).getTime();

        const job =
          createCronJob(
            "cron-job-1",
            "workflow-1",
            "30 * * * *",
            now
          );

        const result =
          extractDueCronJobs(
            [job],
            now
          );

        expect(
          result.dueJobs
        ).toEqual([]);

        expect(
          result.updatedJobs
        ).toEqual([job]);
      }
    );

    it(
      "preserves immutability",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            45,
            0
          ).getTime();

        const job =
          createCronJob(
            "cron-job-1",
            "workflow-1",
            "30 * * * *",
            new Date(
              2026,
              0,
              1,
              10,
              0,
              0
            ).getTime()
          );

        extractDueCronJobs(
          [job],
          now
        );

        expect(
          job.nextRunAt
        ).toBeLessThan(
          now
        );
      }
    );
  }
);