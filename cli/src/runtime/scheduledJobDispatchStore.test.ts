import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRuntimeEventLog,
} from "./runtimeEventLog";

import {
  appendScheduledJobDispatchEvents,
} from "./scheduledJobDispatchStore";

describe(
  "scheduledJobDispatchStore",
  () => {
    it(
      "appends scheduled job dispatch events",
      () => {
        const updated =
          appendScheduledJobDispatchEvents(
            createRuntimeEventLog(),
            [
              {
                scheduledJobId:
                  "scheduled-job-1",
                workflowId:
                  "workflow-1",
              },
            ],
            5000
          );

        expect(
          updated.events
        ).toHaveLength(1);

        expect(
          updated.events[0]
        ).toMatchObject({
          sequence: 1,
          type:
            "scheduled-job.dispatched",
          payload: {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          },
        });
      }
    );

    it(
      "appends deterministic sequences",
      () => {
        const updated =
          appendScheduledJobDispatchEvents(
            createRuntimeEventLog(),
            [
              {
                scheduledJobId:
                  "job-a",
                workflowId:
                  "workflow-a",
              },
              {
                scheduledJobId:
                  "job-b",
                workflowId:
                  "workflow-b",
              },
            ],
            1000
          );

        expect(
          updated.events.map(
            (event) =>
              event.sequence
          )
        ).toEqual([
          1,
          2,
        ]);
      }
    );

    it(
      "returns original log for empty executions",
      () => {
        const log =
          createRuntimeEventLog();

        expect(
          appendScheduledJobDispatchEvents(
            log,
            [],
            1000
          )
        ).toBe(log);
      }
    );
  }
);