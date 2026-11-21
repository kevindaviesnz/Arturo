import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Kernel,
} from "./kernel";

describe(
  "restoreKernelState",
  () => {
    it(
      "restores pending calls and process metadata",
      () => {
        const kernel =
          new Kernel();

        kernel.syscall({
          type: "spawn",

          name: "demo",

          context: {
            topic:
              "AI startups",
          },

          run: function* () {
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

        kernel.syscall({
          type:
            "save-snapshot",
        });

        const restored =
          new Kernel();

        restored.syscall({
          type:
            "load-snapshot",
        });

        const state =
          restored.getState();

        expect(
          Object.values(
            state.pendingCalls
          )
        ).toHaveLength(1);

        expect(
          state.processes[1]
            .name
        ).toBe("demo");

        expect(
          state.processes[1]
            .state
        ).toBe(
          "waiting_call"
        );

        expect(
          state.processes[1]
            .fiber
        ).toBeUndefined();
      }
    );
  }
);