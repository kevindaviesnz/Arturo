import {
  afterEach,
  beforeEach,
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
  clearRuntimeReplayCheckpoint,
} from "../storage/runtimeReplayCheckpointRepository";

import {
  createAndSaveReplayCheckpoint,
} from "./runtimeReplayCheckpointStore";

import {
  createPersistedRuntimeReplayAuditReport,
} from "./runtimeReplayAuditReportStore";

/**
 * Creates persisted runtime log fixture.
 *
 * @returns Runtime event log fixture.
 *
 * PURE: No side effects.
 */
function createPersistedRuntimeLogFixture() {
  return appendRuntimeEvent(
    createRuntimeEventLog(),
    {
      id: "event-1",
      type: "job.completed",
      level: "success",
      message: "Job completed",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    }
  );
}

/**
 * Clears audit report store test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears persisted runtime event log.
 * - Clears persisted runtime replay checkpoint.
 */
function clearAuditReportStoreTestState():
  void {
  clearRuntimeEventLog();
  clearRuntimeReplayCheckpoint();
}

beforeEach(() => {
  clearAuditReportStoreTestState();
});

afterEach(() => {
  clearAuditReportStoreTestState();
});

describe("runtimeReplayAuditReportStore", () => {
  it("creates persisted replay audit report without checkpoint", () => {
    saveRuntimeEventLog(
      createPersistedRuntimeLogFixture()
    );

    expect(
      createPersistedRuntimeReplayAuditReport(
        100
      )
    ).toEqual({
      generatedAt: 100,
      eventCount: 1,
      replayVerified: true,
      checkpointVerified: false,
      replayAttestationVerified: true,
      replayAttestationSignature:
        expect.any(String),
      jobCount: 1,
      approvalCount: 0,
      workflowCount: 0,
      notificationCount: 0,
      anomalies: [
        "Checkpoint verification: Runtime replay checkpoint not found",
      ],
    });
  });

  it("creates persisted replay audit report with checkpoint", () => {
    saveRuntimeEventLog(
      createPersistedRuntimeLogFixture()
    );

    createAndSaveReplayCheckpoint(
      4000
    );

    expect(
      createPersistedRuntimeReplayAuditReport(
        100
      )
    ).toMatchObject({
      replayAttestationVerified: true,
      replayAttestationSignature:
        expect.any(String),
      approvalCount: 0,
      workflowCount: 0,
    });
  });

  it("includes approval and workflow counts in audit report", () => {
    saveRuntimeEventLog(
      appendRuntimeEvent(
        appendRuntimeEvent(
          createPersistedRuntimeLogFixture(),
          {
            id: "event-2",
            type: "approval.approved",
            level: "success",
            message:
              "Approval approved",
            timestamp: 2000,
            payload: {
              jobId: "job-1",
            },
          }
        ),
        {
          id: "event-3",
          type:
            "workflow.completed",
          level: "success",
          message:
            "Workflow completed",
          timestamp: 3000,
          payload: {
            workflowId:
              "workflow-1",
          },
        }
      )
    );

    createAndSaveReplayCheckpoint(
      4000
    );

    expect(
      createPersistedRuntimeReplayAuditReport(
        100
      )
    ).toMatchObject({
      replayAttestationVerified: true,
      replayAttestationSignature:
        expect.any(String),
      approvalCount: 1,
      workflowCount: 1,
    });
  });
});