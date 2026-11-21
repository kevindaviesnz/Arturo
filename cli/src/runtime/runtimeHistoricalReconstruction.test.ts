import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  RuntimeEventRecord,
} from "./runtimeEventLog";

import {
  applyHistoricalRuntimeEvent,
  createEmptyHistoricalRuntimeState,
  getHistoricalApprovalStatus,
  getHistoricalCronJobStatus,
  getHistoricalJobStatus,
  getHistoricalScheduledJobStatus,
  getHistoricalWorkflowStatus,
  getStringPayloadField,
  reconstructHistoricalRuntimeState,
} from "./runtimeHistoricalReconstruction";

/**
 * Creates runtime event fixture.
 *
 * @param sequence Event sequence number.
 * @param type Runtime event type.
 * @param payload Runtime event payload.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
function createEvent(
  sequence: number,
  type: string,
  payload: Record<string, unknown> = {}
): RuntimeEventRecord {
  return {
    sequence,
    id: `event-${sequence}`,
    type,
    level: "info",
    message: type,
    timestamp: sequence,
    payload,
  };
}

describe("runtimeHistoricalReconstruction", () => {
  it("creates empty historical state", () => {
expect(
  createEmptyHistoricalRuntimeState()
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

  it("extracts string payload fields", () => {
    expect(
      getStringPayloadField(
        createEvent(
          1,
          "job.queued",
          {
            jobId: "job-1",
          }
        ),
        "jobId"
      )
    ).toBe("job-1");
  });

  it("ignores non-string payload fields", () => {
    expect(
      getStringPayloadField(
        createEvent(
          1,
          "job.queued",
          {
            jobId: 123,
          }
        ),
        "jobId"
      )
    ).toBeUndefined();
  });

  it("maps job statuses", () => {
    expect(
      getHistoricalJobStatus(
        "job.queued"
      )
    ).toBe("queued");

    expect(
      getHistoricalJobStatus(
        "job.started"
      )
    ).toBe("started");

    expect(
      getHistoricalJobStatus(
        "job.completed"
      )
    ).toBe("completed");

    expect(
      getHistoricalJobStatus(
        "job.failed"
      )
    ).toBe("failed");
  });

  it("maps approval statuses", () => {
    expect(
      getHistoricalApprovalStatus(
        "approval.requested"
      )
    ).toBe("requested");

    expect(
      getHistoricalApprovalStatus(
        "approval.approved"
      )
    ).toBe("approved");

    expect(
      getHistoricalApprovalStatus(
        "approval.rejected"
      )
    ).toBe("rejected");
  });

  it("maps workflow statuses", () => {
    expect(
      getHistoricalWorkflowStatus(
        "workflow.started"
      )
    ).toBe("started");

    expect(
      getHistoricalWorkflowStatus(
        "workflow.completed"
      )
    ).toBe("completed");

    expect(
      getHistoricalWorkflowStatus(
        "workflow.failed"
      )
    ).toBe("failed");
  });

  it("maps scheduled job statuses", () => {
    expect(
      getHistoricalScheduledJobStatus(
        "scheduled-job.queued"
      )
    ).toBe("queued");

    expect(
      getHistoricalScheduledJobStatus(
        "scheduled-job.dispatched"
      )
    ).toBe("dispatched");

    expect(
      getHistoricalScheduledJobStatus(
        "scheduled-job.retry-scheduled"
      )
    ).toBe("retry-scheduled");

    expect(
      getHistoricalScheduledJobStatus(
        "scheduled-job.dead-lettered"
      )
    ).toBe("dead-lettered");

    expect(
      getHistoricalScheduledJobStatus(
        "scheduled-job.ignored"
      )
    ).toBeUndefined();
  });

  it("maps cron job statuses", () => {
    expect(
      getHistoricalCronJobStatus(
        "cron-job.scheduled"
      )
    ).toBe("scheduled");

    expect(
      getHistoricalCronJobStatus(
        "cron-job.advanced"
      )
    ).toBe("advanced");

    expect(
      getHistoricalCronJobStatus(
        "cron-job.unknown"
      )
    ).toBeUndefined();
  });

  it("applies event immutably", () => {
    const original =
      createEmptyHistoricalRuntimeState();

    const updated =
      applyHistoricalRuntimeEvent(
        original,
        createEvent(
          1,
          "job.queued",
          {
            jobId: "job-1",
          }
        )
      );

    expect(original).toEqual(
      createEmptyHistoricalRuntimeState()
    );

    expect(
      updated.jobs["job-1"]
    ).toMatchObject({
      status: "queued",
      lastEventSequence: 1,
    });
  });

  it("tracks cron job lifecycle", () => {
    const state =
      reconstructHistoricalRuntimeState([
        createEvent(
          1,
          "cron-job.scheduled",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
        createEvent(
          2,
          "cron-job.advanced",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
      ]);

    expect(
      state.cronJobs["cron-job-1"]
    ).toEqual({
      id: "cron-job-1",
      status: "advanced",
      lastEventSequence: 2,
    });
  });

  it("reconstructs historical jobs approvals workflows notifications scheduled jobs and cron jobs", () => {
    const state =
      reconstructHistoricalRuntimeState([
        createEvent(
          1,
          "job.queued",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          2,
          "approval.requested",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          3,
          "approval.approved",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          4,
          "workflow.started",
          {
            workflowId: "workflow-1",
          }
        ),
        createEvent(
          5,
          "workflow.completed",
          {
            workflowId: "workflow-1",
          }
        ),
        createEvent(
          6,
          "notification.created",
          {}
        ),
        createEvent(
          7,
          "scheduled-job.queued",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          8,
          "scheduled-job.dispatched",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          9,
          "scheduled-job.retry-scheduled",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          10,
          "scheduled-job.dead-lettered",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          11,
          "cron-job.scheduled",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
        createEvent(
          12,
          "cron-job.advanced",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
      ]);

    expect(state).toMatchObject({
      eventCount: 12,
      jobs: {
        "job-1": {
          status: "queued",
          lastEventSequence: 1,
        },
      },
      approvals: {
        "job-1": {
          status: "approved",
          lastEventSequence: 3,
        },
      },
      workflows: {
        "workflow-1": {
          status: "completed",
          lastEventSequence: 5,
        },
      },
      scheduledJobs: {
        "scheduled-job-1": {
          id: "scheduled-job-1",
          workflowId: "workflow-1",
          status: "dead-lettered",
          lastEventSequence: 10,
        },
      },
      cronJobs: {
        "cron-job-1": {
          id: "cron-job-1",
          status: "advanced",
          lastEventSequence: 12,
        },
      },
    });

    expect(
      Object.keys(
        state.notifications
      )
    ).toEqual([
      "event-6",
    ]);
  });

  it(
  "reconstructs historical jobs approvals workflows notifications scheduled jobs and cron jobs",
  () => {
    const state =
      reconstructHistoricalRuntimeState([
        createEvent(
          1,
          "job.queued",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          2,
          "approval.requested",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          3,
          "approval.approved",
          {
            jobId: "job-1",
          }
        ),
        createEvent(
          4,
          "workflow.started",
          {
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          5,
          "workflow.completed",
          {
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          6,
          "notification.created",
          {}
        ),
        createEvent(
          7,
          "scheduled-job.queued",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          8,
          "scheduled-job.dispatched",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          9,
          "scheduled-job.retry-scheduled",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          10,
          "scheduled-job.dead-lettered",
          {
            scheduledJobId:
              "scheduled-job-1",
            workflowId:
              "workflow-1",
          }
        ),
        createEvent(
          11,
          "cron-job.scheduled",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
        createEvent(
          12,
          "cron-job.advanced",
          {
            cronJobId:
              "cron-job-1",
          }
        ),
        createEvent(
          13,
          "policy.evaluated",
          {
            capabilityId:
              "filesystem.delete",
            riskLevel:
              "high",
            role:
              "worker",
            effect:
              "deny",
            matchedRuleId:
              "deny-worker-delete",
          }
        ),
      ]);

    expect(state).toMatchObject({
      eventCount: 13,

      jobs: {
        "job-1": {
          status: "queued",
          lastEventSequence: 1,
        },
      },

      approvals: {
        "job-1": {
          status: "approved",
          lastEventSequence: 3,
        },
      },

      workflows: {
        "workflow-1": {
          status: "completed",
          lastEventSequence: 5,
        },
      },

      scheduledJobs: {
        "scheduled-job-1": {
          id:
            "scheduled-job-1",
          workflowId:
            "workflow-1",
          status:
            "dead-lettered",
          lastEventSequence:
            10,
        },
      },

      cronJobs: {
        "cron-job-1": {
          id: "cron-job-1",
          status:
            "advanced",
          lastEventSequence:
            12,
        },
      },

      policyEvaluations: {
        "event-13": {
          id: "event-13",
          capabilityId:
            "filesystem.delete",
          riskLevel:
            "high",
          role:
            "worker",
          effect:
            "deny",
          matchedRuleId:
            "deny-worker-delete",
          lastEventSequence:
            13,
        },
      },
    });

    expect(
      Object.keys(
        state.notifications
      )
    ).toEqual([
      "event-6",
    ]);
  }
  );
  
});