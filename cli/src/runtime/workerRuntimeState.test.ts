import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createWorkerRuntimeState,
  markWorkerRuntimeBusy,
  markWorkerRuntimeIdle,
  markWorkerRuntimeStarted,
} from "./workerRuntimeState";

describe("workerRuntimeState", () => {
  it("creates initial runtime state", () => {
    expect(
      createWorkerRuntimeState()
    ).toEqual({
      started: false,
      busy: false,
    });
  });

  it("marks runtime as started immutably", () => {
    const state =
      createWorkerRuntimeState();

    const updated =
      markWorkerRuntimeStarted(state);

    expect(updated).toEqual({
      started: true,
      busy: false,
    });

    expect(state).toEqual({
      started: false,
      busy: false,
    });
  });

  it("marks runtime as busy immutably", () => {
    const state =
      createWorkerRuntimeState();

    const updated =
      markWorkerRuntimeBusy(state);

    expect(updated).toEqual({
      started: false,
      busy: true,
    });

    expect(state).toEqual({
      started: false,
      busy: false,
    });
  });

  it("marks runtime as idle immutably", () => {
    const state = {
      started: true,
      busy: true,
    };

    const updated =
      markWorkerRuntimeIdle(state);

    expect(updated).toEqual({
      started: true,
      busy: false,
    });

    expect(state).toEqual({
      started: true,
      busy: true,
    });
  });
});