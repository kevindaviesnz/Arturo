import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityCall,
} from "./capabilityCall";

describe(
  "createCapabilityCall",
  () => {
    it(
      "creates a deterministic capability call",
      () => {
        const call =
          createCapabilityCall(
            "call-1",
            42,
            "research",
            "AI startups"
          );

        expect(
          call.callId
        ).toBe("call-1");

        expect(
          call.pid
        ).toBe(42);

        expect(
          call.capability
        ).toBe(
          "research"
        );

        expect(
          call.input
        ).toBe(
          "AI startups"
        );

        expect(
          typeof call.createdAt
        ).toBe(
          "number"
        );
      }
    );
  }
);