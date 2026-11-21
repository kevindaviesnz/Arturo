import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearRuntimeEventStore, listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { clearPolicyRules } from "../storage/policyRepository";
import { handleUiGovernanceCommand, readGovernanceEntry } from "./uiGovernanceEntries";

describe("uiGovernanceEntries", () => {
  beforeEach(() => { clearRuntimeEventStore(); clearPolicyRules(); });
  afterEach(() => { clearRuntimeEventStore(); clearPolicyRules(); });

  it("reports the truthful empty governance state", () => {
    const entry = readGovernanceEntry();
    expect(entry.body).toContain("Policies:          0");
    expect(entry.body).toContain("Approval Rules:    Disabled");
    expect(entry.body).toContain("Compliance Checks: Inactive");
    expect(listRuntimeEventStore().map((event) => event.type)).toContain("governance.inspected");
  });

  it("adds, lists, inspects, and removes a persisted policy", () => {
    const added = handleUiGovernanceCommand([
      "policy", "add", "Toy release requires review",
      "--effect", "require-approval", "--capability", "safety", "--scope", "global",
    ]);
    expect(added.label).toBe("Governance policy added");

    const summary = readGovernanceEntry();
    expect(summary.body).toContain("Policies:          1");
    expect(summary.body).toContain("Approval Rules:    Enabled");
    expect(handleUiGovernanceCommand(["policy", "list"]).body).toContain("Toy release requires review");
    expect(handleUiGovernanceCommand(["policy", "inspect", "Toy release requires review"]).body)
      .toContain("work needing safety");

    const removed = handleUiGovernanceCommand(["policy", "remove", "Toy release requires review"]);
    expect(removed.label).toBe("Governance policy removed");
    expect(readGovernanceEntry().body).toContain("Policies:          0");
  });

  it("rejects a rule with no deterministic match", () => {
    const entry = handleUiGovernanceCommand([
      "policy", "add", "Vague safety rule", "--effect", "deny", "--scope", "global",
    ]);
    expect(entry.label).toBe("Governance policy not added");
    expect(entry.body).toContain("at least one match is required");
  });
});
