import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtimeEventLog";

import {
  clearRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  replayHistoricalRuntimeState,
} from "./runtimeHistoricalReplay";

/**
 * Creates historical replay event log fixture.
 *
 * @returns Runtime event log fixture.
 *
 * PURE: No side effects.
 */
function createHistoricalReplayLogFixture() {
  return appendRuntimeEvent(
    appendRuntimeEvent(
      appendRuntimeEvent(
        appendRuntimeEvent(
          appendRuntimeEvent(
            appendRuntimeEvent(
              createRuntimeEventLog(),
              {
                id: "event-1",
                type: "job.queued",
                level: "info",
                message: "Job queued",
                timestamp: 1000,
                payload: {
                  jobId: "job-1",
                },
              }
            ),
            {
              id: "event-2",
              type: "approval.approved",
              level: "success",
              message: "Approval recorded",
              timestamp: 2000,
              payload: {
                jobId: "job-1",
              },
            }
          ),
          {
            id: "event-3",
            type: "workflow.completed",
            level: "success",
            message: "Workflow completed",
            timestamp: 3000,
            payload: {
              workflowId: "workflow-1",
            },
          }
        ),
        {
          id: "event-4",
          type: "scheduled-job.dispatched",
          level: "info",
          message:
            "Scheduled job dispatched",
          timestamp: 4000,
          payload: {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          },
        }
      ),
      {
        id: "event-5",
        type:
          "scheduled-job.retry-scheduled",
        level: "warn",
        message:
          "Scheduled job retry scheduled",
        timestamp: 5000,
        payload: {
          scheduledJobId:
            "scheduled-job-1",
          workflowId:
            "workflow-1",
        },
      }
    ),
    {
      id: "event-6",
      type:
        "scheduled-job.dead-lettered",
      level: "error",
      message:
        "Scheduled job dead-lettered",
      timestamp: 6000,
      payload: {
        scheduledJobId:
          "scheduled-job-1",
        workflowId:
          "workflow-1",
      },
    }
  );
}

afterEach(() => {
  clearRuntimeEventLog();
});

describe("runtimeHistoricalReplay", () => {
  it("replays persisted runtime events into historical state", () => {
    saveRuntimeEventLog(
      createHistoricalReplayLogFixture()
    );

    expect(
      replayHistoricalRuntimeState()
    ).toMatchObject({
      eventCount: 6,
      jobs: {
        "job-1": {
          status: "queued",
          lastEventSequence: 1,
        },
      },
      approvals: {
        "job-1": {
          status: "approved",
          lastEventSequence: 2,
        },
      },
      workflows: {
        "workflow-1": {
          status: "completed",
          lastEventSequence: 3,
        },
      },
      scheduledJobs: {
        "scheduled-job-1": {
          status: "dead-lettered",
          lastEventSequence: 6,
        },
      },
    });
  });

  it("returns empty historical state when no events are persisted", () => {
    clearRuntimeEventLog();

expect(
  replayHistoricalRuntimeState()
).toEqual({
  jobs: {},
  approvals: {},
  workflows: {},
  notifications: {},
  scheduledJobs: {},
  cronJobs: {},
  policyEvaluations: {},
  eventCount: 0,
});
  });
});