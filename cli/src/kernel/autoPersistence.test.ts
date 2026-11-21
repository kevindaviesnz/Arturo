import fs from "fs";
import path from "path";
import os from "os";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  Kernel,
} from "./kernel";

import type {
  WorkerGenerator,
} from "./process";

import {
  clearKernelSnapshot,
  loadKernelSnapshot,
} from "./kernelPersistence";

const ORIGINAL_SNAPSHOT_FILE =
  process.env.ARTURO_SNAPSHOT_FILE;

const TEST_SNAPSHOT_FILE =
  path.join(
    os.tmpdir(),
    `arturo-auto-persistence-${process.pid}.snapshot.json`
  );

const SNAPSHOT_FILE =
  TEST_SNAPSHOT_FILE;

describe(
  "automatic kernel persistence",
  () => {
    beforeEach(() => {
      process.env.ARTURO_SNAPSHOT_FILE =
        TEST_SNAPSHOT_FILE;

      clearKernelSnapshot();
    });

    afterEach(() => {
      clearKernelSnapshot();

      if (
        ORIGINAL_SNAPSHOT_FILE ===
        undefined
      ) {
        delete process.env
          .ARTURO_SNAPSHOT_FILE;
      } else {
        process.env.ARTURO_SNAPSHOT_FILE =
          ORIGINAL_SNAPSHOT_FILE;
      }
    });

    it(
      "persists snapshot automatically after spawn",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name: "demo",

          context: {},

          run: function* (): WorkerGenerator {
            yield {
              type: "log",
              message:
                "hello",
            };
          },
        });

        expect(
          fs.existsSync(
            SNAPSHOT_FILE
          )
        ).toBe(true);

        const snapshot =
          loadKernelSnapshot();

        expect(
          snapshot
        ).not.toBeNull();

        expect(
          snapshot?.processes[1]
            .name
        ).toBe("demo");
      }
    );

    it(
      "persists pending calls after tick",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name: "demo",

          context: {},

          run: function* (): WorkerGenerator {
            yield {
              type: "call",

              capability:
                "research",

              input:
                "AI startups",
            };
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const snapshot =
          loadKernelSnapshot();

        expect(
          snapshot
        ).not.toBeNull();

        expect(
          Object.values(
            snapshot!
              .pendingCalls
          )
        ).toHaveLength(1);
      }
    );

    it(
      "persists resolved calls",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name: "demo",

          context: {},

          run: function* (): WorkerGenerator {
            const result =
              yield {
                type: "call",

                capability:
                  "research",

                input:
                  "AI startups",
              };

            return result;
          },
        });

        kernel.syscall({
          type: "tick",
        });

        const pendingCall =
          Object.values(
            kernel.getState()
              .pendingCalls
          )[0];

        kernel.syscall({
          type:
            "resolve-call",

          callId:
            pendingCall.callId,

          result:
            "done",
        });

        const snapshot =
          loadKernelSnapshot();

        expect(
          snapshot
        ).not.toBeNull();

        expect(
          Object.values(
            snapshot!
              .pendingCalls
          )
        ).toHaveLength(0);
      }
    );
  }
);
