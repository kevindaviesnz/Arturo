import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Kernel,
} from "./kernel";

import {
  createKernelSnapshot,
} from "./kernelSnapshot";

describe("createKernelSnapshot", () => {
  it("creates a serializable snapshot without fibers or run functions", () => {
    const kernel =
      new Kernel();

    kernel.syscall({
      type: "spawn",
      name: "demo",
      context: {
        topic: "AI startups",
      },
      run: function* () {
        yield {
          type: "call",
          capability: "research",
          input: "AI startups",
        };
      },
    });

    kernel.syscall({
      type: "tick",
    });

    const snapshot =
      createKernelSnapshot(
        kernel.getState()
      );

    expect(snapshot.version).toBe(
      "1.0.0"
    );

    expect(
      snapshot.processes[1]
    ).toMatchObject({
      pid: 1,
      name: "demo",
      state: "waiting_call",
      context: {
        topic: "AI startups",
      },
    });

    expect(
      "fiber" in snapshot.processes[1]
    ).toBe(false);

    expect(
      "run" in snapshot.processes[1]
    ).toBe(false);

    expect(
      Object.values(
        snapshot.pendingCalls
      )
    ).toHaveLength(1);
  });
});