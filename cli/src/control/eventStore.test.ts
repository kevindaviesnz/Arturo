import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearEvents,
  getEvents,
  recordEvent,
} from "./eventStore";

beforeEach(() => {
  clearEvents();
});

describe("eventStore", () => {
  it("records events by pid", () => {
    recordEvent({
      pid: 1,
      type: "log",
      message: "hello",
      ts: 1,
    });

    expect(getEvents(1)).toEqual([
      {
        pid: 1,
        type: "log",
        message: "hello",
        ts: 1,
      },
    ]);
  });

  it("clears events", () => {
    recordEvent({
      pid: 1,
      type: "log",
      message: "hello",
      ts: 1,
    });

    clearEvents();

    expect(getEvents(1)).toEqual([]);
  });
});