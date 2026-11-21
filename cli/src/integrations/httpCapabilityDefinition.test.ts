import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHttpGetCapabilityDefinition,
} from "./httpCapabilityDefinition";

describe("httpCapabilityDefinition", () => {
  it("creates HTTP GET capability definition", () => {
    expect(
      createHttpGetCapabilityDefinition()
    ).toMatchObject({
      id: "http.get",
      riskLevel: "medium",
      requiresApproval: true,
      timeoutMs: 5000,
    });
  });
});