import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  KernelState,
} from "./state";

import type {
  Process,
} from "./process";

import {
  tick,
} from "./scheduler";

/**
 * Creates a test process.
 *
 * @returns Test process.
 *
 * PURE: No side effects.
 */
function createTestProcess(): Process {
  return {
    pid: 1,
    name: "test-process",
    state: "ready",
    context: {},
    mailbox: [],
    run: function* () {
      yield {
        type: "log",
        message: "hello",
      };
    },
  };
}

/**
 * Creates a test kernel state.
 *
 * @returns Kernel state.
 *
 * PURE: No side effects.
 */
function createTestKernelState(): KernelState {
  return {
    nextPid: 2,
    processes: {
      1: createTestProcess(),
    },
    readyQueue: [
      1,
    ],
    blockedQueue: [],
    timers: [],
    pendingCalls: {},
    results: {},
  };
}

describe("scheduler", () => {
  it("does not mutate original process table", () => {
    const state =
      createTestKernelState();

    const originalProcesses =
      state.processes;

    const originalProcess =
      state.processes[1];

    const nextState =
      tick(state);

    expect(
      state.processes
    ).toBe(
      originalProcesses
    );

    expect(
      state.processes[1]
    ).toBe(
      originalProcess
    );

    expect(
      nextState.processes
    ).not.toBe(
      state.processes
    );
  });
});