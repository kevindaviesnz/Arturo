import { beforeEach, describe, expect, it } from "vitest";
import { CORE_CAPABILITIES, isConsequentialCapability as requiresExactAuthority } from "../control/workers";
import { isConsequentialCapability, evaluateJobGovernance } from "../runtime/jobGovernance";
import { getJobCapabilityTimeoutMs } from "../runtime/workerRuntime";
import { getRequiredWorkerCapabilityForExecution } from "../integrations/capabilityDispatcher";
import { builtInCapabilityRegistry } from "../kernel/builtInCapabilities";
import { clearPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { CORE_CAPABILITIES as runtimeCoreCapabilities } from "../types/runtime";
import { resolveCapabilityDefinition } from "./capabilityCatalog";
import type { Job } from "../runtime/jobQueue";

const workerIds = [
  "llm", "writing", "research", "review", "human-review", "human-contact",
  "analysis", "conversion", "advice", "planning", "coordination", "monitoring",
  "simulation", "optimization", "negotiation", "safety", "coaching", "execution",
  "backup", "email-draft", "email-send", "file-read", "file-write", "shell-read",
  "shell-execute", "web", "web-research", "summarisation", "office-read", "office-write",
];
const exactAuthority = [
  "office-read", "office-write", "human-review", "human-contact", "safety",
  "execution", "backup", "email-send", "file-read", "file-write", "shell-read",
  "shell-execute", "web", "web-research",
];
const defaultApproval = ["office-write", "shell-execute", "file-write", "email-send", "human-contact"];
const job = (id: string): Job => ({ id: "capability-contract", task: "test", status: "queued", createdAt: 1, requiredCapabilities: [id as any] });

// Public consumer contract, characterised before consolidation and amended only
// for the explicitly tested alias risk/timeout and runtime-vocabulary fixes.
describe("capability consumer contract", () => {
  beforeEach(() => clearPolicyRules());

  it("retains the complete ordered Worker vocabulary", () => {
    expect(CORE_CAPABILITIES).toEqual(workerIds);
    expect(runtimeCoreCapabilities).toEqual(workerIds);
  });

  it.each(workerIds)("preserves authority and default approval for %s", (id) => {
    expect(requiresExactAuthority(id as any)).toBe(exactAuthority.includes(id));
    expect(isConsequentialCapability(id)).toBe(defaultApproval.includes(id));
    expect(getJobCapabilityTimeoutMs(job(id))).toBe(["research", "writing"].includes(id) ? 600000 : ["email-send", "shell-execute"].includes(id) ? 30000 : 0);
  });

  it.each([
    ["research", "low", false, 600000, false],
    ["writing", "low", false, 600000, false],
    ["human-review", "medium", true, 0, false],
    ["email.send", "high", true, 30000, true],
    ["shell.exec", "critical", true, 30000, true],
    ["file.delete", "critical", true, 30000, true],
    ["http.get", "medium", true, 5000, true],
    ["webhook.send", "medium", true, 30000, true],
  ] as const)("preserves kernel metadata for %s", (id, riskLevel, requiresApproval, timeoutMs, consequential) => {
    expect(builtInCapabilityRegistry[id]).toMatchObject({ id, riskLevel, requiresApproval, timeoutMs });
    expect(getJobCapabilityTimeoutMs(job(id))).toBe(timeoutMs);
    expect(isConsequentialCapability(id)).toBe(consequential);
  });

  it("resolves only equivalent Worker operations to kernel definitions", () => {
    expect(resolveCapabilityDefinition("email-send")).toBe(builtInCapabilityRegistry["email.send"]);
    expect(resolveCapabilityDefinition("shell-execute")).toBe(builtInCapabilityRegistry["shell.exec"]);
    for (const id of ["web", "web-research", "file-write", "shell-read", "email-draft", "http.post", "unknown", "toString", "__proto__"]) {
      expect(resolveCapabilityDefinition(id)).toBeUndefined();
    }
  });

  it("preserves dispatch authority without making broader permissions aliases", () => {
    for (const id of ["http.get", "http.post", "webhook.send"]) {
      expect(getRequiredWorkerCapabilityForExecution(id)).toBe("web");
    }
    expect(getRequiredWorkerCapabilityForExecution("email.send")).toBe("email-send");
    for (const id of ["shell.exec", "file.delete", "web", "unknown"]) {
      expect(getRequiredWorkerCapabilityForExecution(id)).toBeUndefined();
    }
    expect(isConsequentialCapability("http.post")).toBe(true);
    expect(getJobCapabilityTimeoutMs(job("http.post"))).toBe(0);
    expect(isConsequentialCapability("unknown")).toBe(false);
    expect(getJobCapabilityTimeoutMs(job("unknown"))).toBe(0);
  });

  it.each(["email-send", "shell-execute"])("matches high-risk policy for Worker alias %s", (id) => {
    savePolicyRules([{
      id: "high-risk-denied", description: "High risk requires rejection", effect: "deny",
      scope: { type: "global", id: "global" }, match: { riskLevel: "high" },
    }]);
    expect(evaluateJobGovernance(job(id))).toMatchObject({ effect: "deny", matchedRuleId: "high-risk-denied", capabilityId: id });
  });
});
