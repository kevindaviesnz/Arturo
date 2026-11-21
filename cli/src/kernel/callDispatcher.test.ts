import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createKernelCallDispatchDecision,
  listKernelCallDispatchDecisions,
} from "./callDispatcher";

describe("createKernelCallDispatchDecision", () => {
  it("creates a dispatch decision for a pending call", () => {
    expect(
      createKernelCallDispatchDecision({
        callId: "call-1",
        pid: 1,
        capability: "research",
        input: "AI-native startups",
        createdAt: 1000,
      })
    ).toEqual({
      type: "dispatch",
      callId: "call-1",
      capability: "research",
      input: "AI-native startups",
    });
  });

  it("ignores missing calls", () => {
    expect(
      createKernelCallDispatchDecision(
        undefined
      )
    ).toEqual({
      type: "ignore",
      reason: "No pending call provided",
    });
  });
});

describe("listKernelCallDispatchDecisions", () => {
  it("creates dispatch decisions for all pending calls", () => {
    expect(
      listKernelCallDispatchDecisions({
        "call-1": {
          callId: "call-1",
          pid: 1,
          capability: "research",
          input: "topic",
          createdAt: 1000,
        },
      })
    ).toEqual([
      {
        type: "dispatch",
        callId: "call-1",
        capability: "research",
        input: "topic",
      },
    ]);
  });
});