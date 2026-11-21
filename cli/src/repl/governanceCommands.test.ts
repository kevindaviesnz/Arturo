import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRuntimeEventStore } from "../runtime/runtimeEventStore";
import { clearPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { formatGovernancePolicy, formatGovernanceSummary, handleGovernanceCommand } from "./governanceCommands";

describe("governanceCommands", () => {
  beforeEach(() => { clearRuntimeEventStore(); clearPolicyRules(); vi.restoreAllMocks(); });
  afterEach(() => { clearRuntimeEventStore(); clearPolicyRules(); vi.restoreAllMocks(); });

  it("formats a derived Chapter 11 governance summary", () => {
    expect(formatGovernanceSummary({
      policyCount: 0, approvalRules: "Disabled", complianceChecks: "Inactive", auditTrail: "Enabled",
    })).toContain("Policies:          0");
  });

  it("formats an executable policy rule", () => {
    expect(formatGovernancePolicy({
      id: "policy-1", description: "Large payment approval",
      effect: "require-approval", match: { capabilityId: "make-payment", riskLevel: "high" },
      scope: { type: "global", id: "global" },
    })).toContain("Applies to:      work needing make-payment, work whose risk is high");
  });

  it("prints stored policy inspection", () => {
    savePolicyRules([{
      id: "policy-1", description: "Large payment approval",
      effect: "require-approval", match: { capabilityId: "make-payment" },
    }]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    handleGovernanceCommand(["policy", "inspect", "Large payment approval"]);
    expect(log.mock.calls[0][0]).toContain("Policy: Large payment approval");
  });

  it("prints not found for an unknown policy", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    handleGovernanceCommand(["policy", "inspect", "Missing Policy"]);
    expect(log).toHaveBeenCalledWith("governance policy not found: Missing Policy");
  });
});
