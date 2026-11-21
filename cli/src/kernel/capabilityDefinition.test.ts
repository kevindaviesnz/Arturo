import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityDefinition,
} from "./capabilityDefinition";

describe(
  "createCapabilityDefinition",
  () => {
    it(
      "creates a capability definition",
      () => {
        const capability =
          createCapabilityDefinition({
            id: "research",
            description:
              "Researches a topic and returns notes.",
            riskLevel: "low",
            requiresApproval: false,
            timeoutMs: 30000,
            version: "1.0.0",
          });

        expect(
          capability
        ).toEqual({
          id: "research",

          description:
            "Researches a topic and returns notes.",

          riskLevel: "low",

          requiresApproval:
            false,

          timeoutMs: 30000,

          version: "1.0.0",

          inputSchema: {
            type: "any",
          },

          outputSchema: {
            type: "any",
          },
        });
      }
    );
  }
);