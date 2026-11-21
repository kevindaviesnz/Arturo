import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAutoDispatchDecision,
} from "./autoDispatch";

describe("createAutoDispatchDecision", () => {
  it("dispatches process call events with capability and call id", () => {
    expect(
      createAutoDispatchDecision({
        type: "process:call",
        callId: "call-1",
        capability: "research",
        input: "AI-native startups",
      })
    ).toEqual({
      type: "dispatch",
      callId: "call-1",
      capability: "research",
      input: "AI-native startups",
    });
  });

  it("ignores non-call events", () => {
    expect(
      createAutoDispatchDecision({
        type: "process:spawn",
      })
    ).toEqual({
      type: "ignore",
      reason: "Event is not a kernel call",
    });
  });

  it("ignores human review calls", () => {
expect(
  createAutoDispatchDecision({
    type: "process:call",
    callId: "call-1",
    capability: "human-review",
    input: "Draft article",
  })
).toEqual({
  type: "human-review",
  callId: "call-1",
  input: "Draft article",
});
  });
});