import {
  describe,
  expect,
  it,
} from "vitest";

import {
  builtInCapabilityRegistry,
} from "./builtInCapabilities";

describe("builtInCapabilityRegistry", () => {
  it("contains core built-in capabilities", () => {
    expect(
      builtInCapabilityRegistry.research
    ).toMatchObject({
      id: "research",
      riskLevel: "low",
      requiresApproval: false,
    });

    expect(
      builtInCapabilityRegistry["human-review"]
    ).toMatchObject({
      id: "human-review",
      requiresApproval: true,
    });

    expect(
      builtInCapabilityRegistry["shell.exec"]
    ).toMatchObject({
      id: "shell.exec",
      riskLevel: "critical",
      requiresApproval: true,
    });
  });
});