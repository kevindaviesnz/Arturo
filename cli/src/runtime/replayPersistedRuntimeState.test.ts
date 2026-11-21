import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearKernelSnapshot,
  saveKernelSnapshot,
} from "../kernel/kernelPersistence";

import {
  clearRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtimeEventLog";

import {
  replayPersistedRuntimeState,
} from "./replayPersistedRuntimeState";

describe(
  "replayPersistedRuntimeState",
  () => {
    beforeEach(() => {
      clearKernelSnapshot();
      clearRuntimeEventLog();
    });

    afterEach(() => {
      clearKernelSnapshot();
      clearRuntimeEventLog();
    });

    it(
      "returns failed verification when snapshot is missing",
      () => {
        saveRuntimeEventLog(
          createRuntimeEventLog()
        );

        expect(
          replayPersistedRuntimeState()
            .verification
        ).toMatchObject({
          valid: false,
          error:
            "Kernel snapshot not found",
        });
      }
    );

    it(
      "returns failed verification when replay state differs from snapshot",
      () => {
        saveKernelSnapshot({
          version:
            "1.0.0",

          createdAt:
            1,

          nextPid:
            2,

          processes:
            {},

          readyQueue:
            [],

          blockedQueue:
            [],

          timers:
            [],

          pendingCalls:
            {},

          results:
            {},
        });

        saveRuntimeEventLog(
          appendRuntimeEvent(
            createRuntimeEventLog(),
            {
              id:
                "event-1",

              type:
                "job.completed",

              level:
                "success",

              message:
                "Job completed",

              timestamp:
                1000,

              payload: {
                jobId:
                  "job-1",
              },
            }
          )
        );

        expect(
          replayPersistedRuntimeState()
            .verification
        ).toMatchObject({
          valid: false,
          error:
            "Replay state mismatch",
          diff: {
            identical:
              false,
          },
        });
      }
    );

    it(
      "returns successful verification when snapshot and replay state match",
      () => {
        const replayState = {
          eventCount:
            0,

          jobs:
            {},
        };

        saveKernelSnapshot(
          replayState as any
        );

        saveRuntimeEventLog(
          createRuntimeEventLog()
        );

        expect(
          replayPersistedRuntimeState()
            .verification
        ).toEqual({
          valid: true,
          diff: {
            identical: true,
            differences: [],
          },
        });
      }
    );
  }
);