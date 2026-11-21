import {
  describe,
  expect,
  it,
} from "vitest";

import {
  webhookCapabilityDefinition,
} from "./webhookCapabilityDefinition";

describe("webhookCapabilityDefinition", () => {
  it("creates webhook.send capability definition", () => {
    expect(
      webhookCapabilityDefinition
    ).toMatchObject({
      id: "webhook.send",
      riskLevel: "medium",
      requiresApproval: true,
      timeoutMs: 30000,
    });
  });
});
