import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  Kernel,
} from "./kernel";

import {
  clearKernelSnapshot,
} from "./kernelPersistence";

describe("kernel snapshot syscalls", () => {
  afterEach(() => {
    clearKernelSnapshot();
  });

  it("saves, loads, and clears snapshots through syscalls", () => {
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

    const saved =
      kernel.syscall({
        type: "save-snapshot",
      });

    expect(
      saved.processes[1]
    ).toMatchObject({
      pid: 1,
      name: "demo",
      state: "waiting_call",
    });

    const read =
      kernel.syscall({
        type: "read-snapshot",
      });

    expect(
      read
    ).toEqual(saved);

    expect(
      kernel.syscall({
        type: "load-snapshot",
      })
    ).toBe(true);

    expect(
      kernel.syscall({
        type: "clear-snapshot",
      })
    ).toBe(true);

    expect(
      kernel.syscall({
        type: "load-snapshot",
      })
    ).toBeNull();
  });
});