import { describe, expect, it } from "vitest";

import {
  isApprovalCapableMode,
  resolveDefaultHumanWorkerMode,
} from "./humanWorkerMode";

describe("resolveDefaultHumanWorkerMode", () => {
  it("makes guardians and reviewers approval-capable, and everyone else a task worker", () => {
    expect(resolveDefaultHumanWorkerMode("guardian")).toBe("approval");
    expect(resolveDefaultHumanWorkerMode("reviewer")).toBe("review");
    expect(resolveDefaultHumanWorkerMode("assistant")).toBe("task");
    expect(resolveDefaultHumanWorkerMode(undefined)).toBe("task");
  });
});

describe("isApprovalCapableMode", () => {
  it("accepts the approving modes and rejects task-only and unset", () => {
    expect(isApprovalCapableMode("approval")).toBe(true);
    expect(isApprovalCapableMode("decision")).toBe(true);
    expect(isApprovalCapableMode("review")).toBe(true);
    expect(isApprovalCapableMode("task")).toBe(false);
    expect(isApprovalCapableMode(undefined)).toBe(false);
  });

  it("agrees with the default a bare /add-human-worker produces (cannot approve)", () => {
    // The default `/add-human-worker "<name>"` supplies no archetype, so the
    // person lands in "task" mode and must not be treated as an approver.
    expect(
      isApprovalCapableMode(resolveDefaultHumanWorkerMode(undefined))
    ).toBe(false);
  });
});
