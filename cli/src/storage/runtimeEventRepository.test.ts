import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "../runtime/runtimeEventLog";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
  saveRuntimeEventLog,
} from "./runtimeEventRepository";

/**
 * Creates persisted runtime event log fixture.
 *
 * @returns Runtime event log with one event.
 *
 * PURE: No side effects.
 */
function createPersistedLogFixture() {
  return appendRuntimeEvent(
    createRuntimeEventLog(),
    {
      id: "event-1",
      type: "job.created",
      level: "info",
      message: "Job created",
      timestamp: 1000,
    }
  );
}

afterEach(() => {
  clearRuntimeEventLog();
});

describe("runtimeEventRepository", () => {
  it("returns empty log when no persisted log exists", () => {
    clearRuntimeEventLog();

    expect(
      loadRuntimeEventLog()
    ).toEqual(
      createRuntimeEventLog()
    );
  });

  it("saves and loads runtime event log", () => {
    const log =
      createPersistedLogFixture();

    saveRuntimeEventLog(log);

    expect(
      loadRuntimeEventLog()
    ).toEqual(log);
  });

  it("clears runtime event log", () => {
    saveRuntimeEventLog(
      createPersistedLogFixture()
    );

    clearRuntimeEventLog();

    expect(
      loadRuntimeEventLog()
    ).toEqual(
      createRuntimeEventLog()
    );
  });
});