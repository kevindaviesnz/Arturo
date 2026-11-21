import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Kernel,
  resolvePendingKernelCall,
} from "./kernel";

import {
  createKernelState,
} from "./state";

import type {
  WorkerGenerator,
} from "./process";

describe(
  "call resolution integrity",
  () => {
    it(
      "rejects duplicate call resolution",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "research-process",

          context: {},

          run: function* (): WorkerGenerator<
            string,
            string
          > {
            return yield {
              type: "call",

              capability:
                "research",

              input:
                "AI safety",
            };
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

        const first =
          kernel.syscall({
            type:
              "resolve-call",

            callId:
              pendingCall.callId,

            result:
              "Research complete",
          });

        const stateAfterFirst =
          kernel.getState();

        const second =
          kernel.syscall({
            type:
              "resolve-call",

            callId:
              pendingCall.callId,

            result:
              "Replay attack",
          });

        expect(first).toBe(true);
        expect(second).toBe(false);

        expect(
          kernel.getState()
        ).toEqual(
          stateAfterFirst
        );

        expect(
          Object.values(
            kernel.getState()
              .pendingCalls
          )
        ).toHaveLength(0);
      }
    );

    it(
      "ignores resolution for unknown call id",
      () => {
        const kernel =
          new Kernel();

        const before =
          kernel.getState();

        const resolved =
          kernel.syscall({
            type:
              "resolve-call",

            callId:
              "missing-call",

            result:
              "hello",
          });

        expect(resolved).toBe(false);

        expect(
          kernel.getState()
        ).toEqual(before);
      }
    );

    it(
      "does not resume a stale call after process termination",
      () => {
        const consoleError =
          vi.spyOn(
            console,
            "error"
          ).mockImplementation(
            () => {}
          );

        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name:
            "failing-process",

          context: {},

          run: function* (): WorkerGenerator {
            yield {
              type: "call",

              capability:
                "research",

              input:
                "AI safety",
            };

            throw new Error(
              "boom"
            );
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

        const resolved =
          kernel.syscall({
            type:
              "resolve-call",

            callId:
              pendingCall.callId,

            result:
              "Research complete",
          });

        expect(resolved).toBe(true);

        kernel.syscall({
          type: "tick",
        });

        expect(
          kernel.getState()
            .processes[1]
            .state
        ).toBe(
          "terminated"
        );

        const staleResolution =
          kernel.syscall({
            type:
              "resolve-call",

            callId:
              pendingCall.callId,

            result:
              "Replay attack",
          });

        expect(
          staleResolution
        ).toBe(false);

        expect(
          kernel.getState()
            .processes[1]
            .state
        ).toBe(
          "terminated"
        );

        consoleError.mockRestore();
      }
    );

    it(
      "pure resolver leaves state unchanged for missing call id",
      () => {
        const state =
          createKernelState();

        const result =
          resolvePendingKernelCall(
            state,
            "missing-call",
            "result"
          );

        expect(
          result
        ).toEqual({
          resolved: false,
          state,
        });
      }
    );
  }
);