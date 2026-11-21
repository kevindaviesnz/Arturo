import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityDefinition,
} from "./capabilityDefinition";

import {
  createCapabilityRegistry,
  getCapabilityDefinition,
} from "./capabilityRegistry";

describe("capabilityRegistry", () => {
  it("indexes capabilities by id", () => {
    const research =
      createCapabilityDefinition({
        id: "research",
        description:
          "Researches a topic.",
        riskLevel: "low",
        requiresApproval: false,
        timeoutMs: 30000,
        version: "1.0.0",
      });

    const registry =
      createCapabilityRegistry([
        research,
      ]);

    expect(
      getCapabilityDefinition(
        registry,
        "research"
      )
    ).toEqual(research);

    expect(
      getCapabilityDefinition(
        registry,
        "missing"
      )
    ).toBeUndefined();
  });
});