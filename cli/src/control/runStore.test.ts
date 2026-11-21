import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendEvent,
  clearRuns,
  createRun,
  getRun,
  listRuns,
} from "./runStore";

beforeEach(() => {
  clearRuns();
});

describe("runStore", () => {
  it("creates runs with resettable ids", () => {
    const run =
      createRun("demo");

    expect(run.id).toBe(1);
    expect(run.workflow).toBe("demo");
  });

  it("appends events immutably to a run", () => {
    const run =
      createRun(
        "example"
      );

    appendEvent(
      run,
      {
        type: "log",
        message: "done",
      }
    );

    expect(
      run.events
    ).toEqual([]);

    expect(
      getRun(
        run.id
      )?.events
    ).toEqual([
      {
        type: "log",
        message: "done",
      },
    ]);
  });

  it("clears runs and resets ids", () => {
    createRun("one");

    clearRuns();

    const run =
      createRun("two");

    expect(listRuns()).toHaveLength(1);
    expect(getRun(1)).toBe(run);
  });
});