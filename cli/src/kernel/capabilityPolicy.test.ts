import {
  describe,
  expect,
  it,
} from "vitest";

import {
  decideCapabilityPolicy,
} from "./capabilityPolicy";

describe("decideCapabilityPolicy", () => {
  it("allows normal capabilities", () => {
    expect(
      decideCapabilityPolicy(
        "research"
      )
    ).toEqual({
      type: "allow",
    });

    expect(
      decideCapabilityPolicy(
        "writing"
      )
    ).toEqual({
      type: "allow",
    });
  });

  it("requires approval for sensitive capabilities", () => {
    expect(
      decideCapabilityPolicy(
        "email.send"
      )
    ).toEqual({
      type: "require-approval",
      reason:
        "Capability requires approval: email.send",
    });

    expect(
      decideCapabilityPolicy(
        "shell.exec"
      )
    ).toEqual({
      type: "require-approval",
      reason:
        "Capability requires approval: shell.exec",
    });

    expect(
      decideCapabilityPolicy(
        "file.delete"
      )
    ).toEqual({
      type: "require-approval",
      reason:
        "Capability requires approval: file.delete",
    });

    for (const capability of [
      "http.get",
      "http.post",
      "webhook.send",
    ]) {
      expect(
        decideCapabilityPolicy(capability)
      ).toEqual({
        type: "require-approval",
        reason:
          `Capability requires approval: ${capability}`,
      });
    }
  });

  it("denies admin capabilities", () => {
    expect(
      decideCapabilityPolicy(
        "admin.shutdown"
      )
    ).toEqual({
      type: "deny",
      reason:
        "Capability denied: admin.shutdown",
    });
  });
});
