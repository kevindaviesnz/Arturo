import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createCronJob,
} from "./cronJob";

import {
  createScheduledJob,
} from "./scheduledJob";

import {
  addDeadLetterJob,
  createDeadLetterQueue,
} from "./deadLetterQueue";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtimeEventLog";

import type {
  RetryableScheduledJob,
} from "./scheduledJobRetry";

import {
  clearCronJobs,
  saveCronJobs,
} from "../storage/cronJobRepository";

import {
  clearScheduledJobs,
  saveScheduledJobs,
} from "../storage/scheduledJobRepository";

import {
  clearDeadLetterQueue,
  saveDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

import {
  clearRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  recoverRuntimeState,
} from "./runtimeRecoveryRuntime";

function createRetryableScheduledJobFixture(
  id: string
): RetryableScheduledJob {
  return {
    id,
    workflowId: "workflow-1",
    task: "Example task",
    runAt: 1000,
    createdAt: 0,
    status: "queued",
    retryCount: 3,
  };
}

function clearRuntimeRecoveryTestState():
  void {
  clearScheduledJobs();
  clearCronJobs();
  clearDeadLetterQueue();
  clearRuntimeEventLog();
}

beforeEach(() => {
  clearRuntimeRecoveryTestState();
});

afterEach(() => {
  clearRuntimeRecoveryTestState();
});

describe("runtimeRecoveryRuntime", () => {
  it("recovers persisted runtime state", () => {
    const scheduledJob =
      createScheduledJob(
        "scheduled-job-1",
        "workflow-1",
        1000,
        0
      );

    const cronJob =
      createCronJob(
        "cron-job-1",
        "workflow-1",
        "0 * * * *",
        1000
      );

    const deadLetterQueue =
      addDeadLetterJob(
        createDeadLetterQueue(),
        createRetryableScheduledJobFixture(
          "failed-job-1"
        ),
        "failure",
        2000
      );

const runtimeLog =
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
  );
    
    saveScheduledJobs([
      scheduledJob,
    ]);

    saveCronJobs([
      cronJob,
    ]);

    saveDeadLetterQueue(
      deadLetterQueue
    );

    saveRuntimeEventLog(
      runtimeLog
    );

    expect(
      recoverRuntimeState()
    ).toMatchObject({
      scheduledJobs: [
        scheduledJob,
      ],
      cronJobs: [
        cronJob,
      ],
      deadLetterQueue,
      historicalState: {
        eventCount: 1,
        jobs: {
          "job-1": {
            id: "job-1",
            status: "queued",
            lastEventSequence: 1,
          },
        },
      },
    });
  });
});