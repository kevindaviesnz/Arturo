import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isPlainObject,
  normalizeForStableSerialization,
  stableSerializeReplayState,
  verifyReplayState,
} from "./runtimeReplayVerification";

describe("runtimeReplayVerification", () => {
  it("detects plain objects", () => {
    expect(
      isPlainObject({
        a: 1,
      })
    ).toBe(true);

    expect(
      isPlainObject([
        "a",
      ])
    ).toBe(false);

    expect(
      isPlainObject(null)
    ).toBe(false);
  });

  it("normalizes object keys recursively", () => {
    expect(
      normalizeForStableSerialization({
        b: 2,
        a: {
          d: 4,
          c: 3,
        },
      })
    ).toEqual({
      a: {
        c: 3,
        d: 4,
      },
      b: 2,
    });
  });

  it("serializes equivalent object states deterministically", () => {
    expect(
      stableSerializeReplayState({
        b: 2,
        a: 1,
      })
    ).toBe(
      stableSerializeReplayState({
        a: 1,
        b: 2,
      })
    );
  });

  it("verifies matching replay state", () => {
    expect(
      verifyReplayState(
        {
          jobs: {
            "job-1": {
              status: "completed",
            },
          },
        },
        {
          jobs: {
            "job-1": {
              status: "completed",
            },
          },
        }
      )
    ).toEqual({
      valid: true,
      diff: {
        identical: true,
        differences: [],
      },
    });
  });

  it("verifies matching replay state with different object key order", () => {
    expect(
      verifyReplayState(
        {
          eventCount: 1,
          jobs: {
            "job-1": {
              id: "job-1",
              status: "completed",
            },
          },
        },
        {
          jobs: {
            "job-1": {
              status: "completed",
              id: "job-1",
            },
          },
          eventCount: 1,
        }
      )
    ).toEqual({
      valid: true,
      diff: {
        identical: true,
        differences: [],
      },
    });
  });

  it("rejects mismatched replay state with diff", () => {
    expect(
      verifyReplayState(
        {
          jobs: {
            "job-1": {
              status: "completed",
            },
          },
        },
        {
          jobs: {
            "job-1": {
              status: "failed",
            },
          },
        }
      )
    ).toEqual({
      valid: false,
      error:
        "Replay state mismatch",
      diff: {
        identical: false,
        differences: [
          "state.jobs differs",
        ],
      },
    });
  });

  it("rejects missing jobs with diff", () => {
    expect(
      verifyReplayState(
        {
          jobs: {
            "job-1": {
              status: "completed",
            },
          },
        },
        {
          jobs: {},
        }
      )
    ).toEqual({
      valid: false,
      error:
        "Replay state mismatch",
      diff: {
        identical: false,
        differences: [
          "state.jobs differs",
        ],
      },
    });
  });
});