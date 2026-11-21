import {
  describe,
  expect,
  it,
} from "vitest";

import {
  diffRecordFields,
  diffReplayStates,
  getUniqueSortedKeys,
  replayValuesEqual,
} from "./runtimeReplayDiff";

describe("runtimeReplayDiff", () => {
  it("gets unique sorted keys", () => {
    expect(
      getUniqueSortedKeys(
        {
          b: 1,
          a: 1,
        },
        {
          c: 1,
          a: 1,
        }
      )
    ).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("treats equivalent object key order as equal", () => {
    expect(
      replayValuesEqual(
        {
          b: 2,
          a: 1,
        },
        {
          a: 1,
          b: 2,
        }
      )
    ).toBe(true);
  });

  it("detects missing expected field", () => {
    expect(
      diffRecordFields(
        "state.jobs",
        {},
        {
          "job-1": {
            status: "completed",
          },
        }
      )
    ).toEqual([
      "state.jobs.job-1 missing from expected state",
    ]);
  });

  it("detects missing actual field", () => {
    expect(
      diffRecordFields(
        "state.jobs",
        {
          "job-1": {
            status: "completed",
          },
        },
        {}
      )
    ).toEqual([
      "state.jobs.job-1 missing from actual state",
    ]);
  });

  it("detects changed field", () => {
    expect(
      diffRecordFields(
        "state.jobs",
        {
          "job-1": {
            status: "completed",
          },
        },
        {
          "job-1": {
            status: "failed",
          },
        }
      )
    ).toEqual([
      "state.jobs.job-1 differs",
    ]);
  });

  it("diffs identical replay states", () => {
    expect(
      diffReplayStates(
        {
          eventCount: 1,
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
          eventCount: 1,
        }
      )
    ).toEqual({
      identical: true,
      differences: [],
    });
  });

  it("diffs divergent replay states", () => {
    expect(
      diffReplayStates(
        {
          eventCount: 1,
          jobs: {
            "job-1": {
              status: "completed",
            },
          },
        },
        {
          eventCount: 2,
          jobs: {
            "job-1": {
              status: "failed",
            },
          },
        }
      )
    ).toEqual({
      identical: false,
      differences: [
        "state.eventCount differs",
        "state.jobs differs",
      ],
    });
  });
});