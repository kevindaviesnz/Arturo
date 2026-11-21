import {
  describe,
  expect,
  it,
} from "vitest";

import {
  hashReplayState,
} from "./runtimeReplayHash";

describe("runtimeReplayHash", () => {
  it("hashes equivalent object key ordering identically", () => {
    expect(
      hashReplayState({
        b: 2,
        a: 1,
      })
    ).toBe(
      hashReplayState({
        a: 1,
        b: 2,
      })
    );
  });

  it("hashes different values differently", () => {
    expect(
      hashReplayState({
        status: "completed",
      })
    ).not.toBe(
      hashReplayState({
        status: "failed",
      })
    );
  });

  it("hashes nested object ordering stably", () => {
    expect(
      hashReplayState({
        job: {
          z: 1,
          a: 2,
        },
      })
    ).toBe(
      hashReplayState({
        job: {
          a: 2,
          z: 1,
        },
      })
    );
  });

  it("preserves array ordering", () => {
    expect(
      hashReplayState([
        "a",
        "b",
      ])
    ).not.toBe(
      hashReplayState([
        "b",
        "a",
      ])
    );
  });

  it("hashes empty object stably", () => {
    expect(
      hashReplayState({})
    ).toBe(
      hashReplayState({})
    );
  });

  it("creates SHA-256 hex hash", () => {
    expect(
      hashReplayState({
        eventCount: 1,
      })
    ).toMatch(
      /^[a-f0-9]{64}$/
    );
  });
});