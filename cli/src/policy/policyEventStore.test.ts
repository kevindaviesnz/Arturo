import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearRuntimeEventLog,
  loadRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  persistPolicyEvaluationEvent,
} from "./policyEventStore";

// Before as well as after: the event log is shared with every other test file,
// and one that leaves events behind would otherwise shift these sequence numbers.
beforeEach(() => {
  clearRuntimeEventLog();
});

afterEach(() => {
  clearRuntimeEventLog();
});

describe("policyEventStore", () => {
  it("persists policy evaluation event", () => {
    expect(
      persistPolicyEvaluationEvent(
        {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
        },
        {
          effect: "deny",
          matchedRuleId:
            "deny-high-risk",
        },
        1000
      )
    ).toEqual({
      effect: "deny",
      matchedRuleId:
        "deny-high-risk",
    });

    expect(
      loadRuntimeEventLog().events
    ).toMatchObject([
      {
        sequence: 1,
        type: "policy.evaluated",
        level: "warn",
        payload: {
          capabilityId:
            "filesystem.delete",
          riskLevel: "high",
          effect: "deny",
          matchedRuleId:
            "deny-high-risk",
        },
      },
    ]);
  });

  it("appends deterministic event sequence", () => {
    persistPolicyEvaluationEvent(
      {
        capabilityId:
          "filesystem.read",
        riskLevel: "low",
      },
      {
        effect: "allow",
      },
      1000
    );

    persistPolicyEvaluationEvent(
      {
        capabilityId:
          "filesystem.delete",
        riskLevel: "high",
      },
      {
        effect: "deny",
      },
      2000
    );

    expect(
      loadRuntimeEventLog().events.map(
        (event) => event.sequence
      )
    ).toEqual([
      1,
      2,
    ]);
  });
});