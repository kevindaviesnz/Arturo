import {
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
  createRuntimeEventRecord,
  getLatestRuntimeEvent,
  listRuntimeEvents,
  parseRuntimeEventLog,
  serializeRuntimeEventLog,
} from "./runtimeEventLog";

const eventInput = {
  id: "event-1",
  type: "job.created",
  level: "info" as const,
  message: "Job created",
  timestamp: 1000,
};

/**
 * Creates test event log with one event.
 *
 * @returns Runtime event log fixture.
 *
 * PURE: No side effects.
 */
function createLogWithOneEvent() {
  return appendRuntimeEvent(
    createRuntimeEventLog(),
    eventInput
  );
}

describe("runtimeEventLog", () => {
  it("creates an empty runtime event log", () => {
    expect(
      createRuntimeEventLog()
    ).toEqual({
      nextSequence: 1,
      events: [],
    });
  });

  it("creates runtime event record", () => {
    expect(
      createRuntimeEventRecord(
        1,
        eventInput
      )
    ).toEqual({
      sequence: 1,
      ...eventInput,
      payload: undefined,
    });
  });

  it("appends event immutably", () => {
    const original =
      createRuntimeEventLog();

    const updated =
      appendRuntimeEvent(
        original,
        eventInput
      );

    expect(original.events).toEqual([]);
    expect(updated.events).toHaveLength(1);
    expect(updated.nextSequence).toBe(2);
  });

  it("assigns increasing sequence numbers", () => {
    const updated =
      appendRuntimeEvent(
        createLogWithOneEvent(),
        {
          ...eventInput,
          id: "event-2",
        }
      );

    expect(
      updated.events.map(
        (event) => event.sequence
      )
    ).toEqual([
      1,
      2,
    ]);
  });

  it("lists runtime events immutably", () => {
    const log =
      createLogWithOneEvent();

    const events =
      listRuntimeEvents(log);

    expect(events).toEqual(log.events);
    expect(events).not.toBe(log.events);
  });

  it("gets latest runtime event", () => {
    const log =
      createLogWithOneEvent();

    expect(
      getLatestRuntimeEvent(log)
    ).toMatchObject({
      id: "event-1",
      sequence: 1,
    });
  });

  it("serializes and parses runtime event log", () => {
    const log =
      createLogWithOneEvent();

    expect(
      parseRuntimeEventLog(
        serializeRuntimeEventLog(log)
      )
    ).toEqual(log);
  });
});