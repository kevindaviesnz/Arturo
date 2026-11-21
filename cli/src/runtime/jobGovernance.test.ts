import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { clearRuntimeEventLog } from "../storage/runtimeEventRepository";
import type { Job } from "./jobQueue";
import {
  evaluateJobGovernance,
  FAIL_CLOSED_CONSEQUENTIAL_RULE_ID,
} from "./jobGovernance";
import { clearPersistedEnterprises, saveEnterprise } from "../storage/enterpriseRepository";
import { createEnterprise } from "../enterprise/enterprise";

const job: Job = {
  id: "job-governance-1",
  task: "Release toy",
  worker: "Toy Worker",
  requiredCapabilities: ["safety"],
  status: "queued",
  createdAt: 1,
};

describe("evaluateJobGovernance", () => {
  beforeEach(() => { clearPolicyRules(); clearRuntimeEventLog(); clearPersistedEnterprises(); });
  afterEach(() => { clearPolicyRules(); clearRuntimeEventLog(); clearPersistedEnterprises(); });

  it("returns no decision when no configured rule matches", () => {
    expect(evaluateJobGovernance(job)).toBeUndefined();
  });

  it("returns the persisted deterministic approval rule", () => {
    savePolicyRules([{
      id: "policy-release",
      description: "Toy release requires review",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
    }]);
    expect(evaluateJobGovernance(job)).toEqual({
      effect: "require-approval",
      matchedRuleId: "policy-release",
      capabilityId: "safety",
    });
  });

  it("fails closed when an enterprise-scoped rule cannot be attributed", () => {
    savePolicyRules([{
      id: "policy-other",
      description: "Other enterprise rule",
      effect: "deny",
      match: { capabilityId: "safety" },
      scope: { type: "organization", id: "another-enterprise" },
    }]);
    expect(evaluateJobGovernance(job)).toMatchObject({
      effect: "deny",
      matchedRuleId: "policy-other",
    });
  });

  it("fails closed to require-approval for a consequential capability with no rule", () => {
    const shellJob: Job = {
      id: "job-shell-1",
      task: "Run migration",
      worker: "Ops Worker",
      requiredCapabilities: ["shell-execute"],
      status: "queued",
      createdAt: 1,
    };
    expect(evaluateJobGovernance(shellJob)).toMatchObject({
      effect: "require-approval",
      capabilityId: "shell-execute",
    });
  });

  it("cannot be bypassed by listing a benign capability before a consequential one", () => {
    savePolicyRules([{
      id: "policy-research-allow",
      description: "Research is allowed",
      effect: "allow",
      match: { capabilityId: "research" },
      scope: { type: "global", id: "global" },
    }]);
    const mixedJob: Job = {
      id: "job-mixed-1",
      task: "Research then email",
      worker: "Ops Worker",
      requiredCapabilities: ["research", "email-send"],
      status: "queued",
      createdAt: 1,
    };
    // email-send (external side effect, unmatched) must force approval despite
    // the allowed research capability appearing first.
    expect(evaluateJobGovernance(mixedJob)).toMatchObject({
      effect: "require-approval",
      capabilityId: "email-send",
    });
  });

  it("surfaces a governance-authored approval count from the matching rule", () => {
    savePolicyRules([{
      id: "policy-two-approvers",
      description: "Safety work needs two approvers",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "global", id: "global" },
      requiredApprovals: 2,
    }]);
    expect(evaluateJobGovernance(job)).toMatchObject({
      effect: "require-approval",
      matchedRuleId: "policy-two-approvers",
      requiredApprovals: 2,
    });
  });

  it("applies the sole active enterprise scope to a manual Job", () => {
    saveEnterprise(createEnterprise({ id: "enterprise-1", name: "Koru Kids" }));
    savePolicyRules([{
      id: "policy-koru",
      description: "Koru Kids safety review",
      effect: "require-approval",
      match: { capabilityId: "safety" },
      scope: { type: "organization", id: "enterprise-1" },
    }]);
    expect(evaluateJobGovernance(job)).toMatchObject({
      effect: "require-approval",
      matchedRuleId: "policy-koru",
    });
  });
});

describe("evaluateJobGovernance with a Function-scoped rule", () => {
  const enterpriseId = "enterprise-1";

  const invoicingRule = {
    id: "staffing-approval:enterprise-1:invoicing",
    description: "Human approval required for invoicing",
    effect: "require-approval" as const,
    // The shape /staff actually writes: this Function, and only its work that
    // reaches outside Arturo.
    match: {
      businessFunctionId: "enterprise-1:invoicing",
      consequentialOnly: true,
    },
    scope: { type: "organization" as const, id: enterpriseId },
    requiredApprovals: 1,
  };

  const invoicingJob: Job = {
    id: "job-invoicing-1",
    task: "Email the customer their quote.",
    requiredCapabilities: ["email-send"],
    businessFunctionId: "enterprise-1:invoicing",
    status: "queued",
    createdAt: 1,
  };

  beforeEach(() => {
    clearPolicyRules();
    clearRuntimeEventLog();
    clearPersistedEnterprises();
    saveEnterprise(
      createEnterprise({ id: enterpriseId, name: "t & s heating ltd", now: 1 })
    );
  });

  afterEach(() => { clearPolicyRules(); clearRuntimeEventLog(); clearPersistedEnterprises(); });

  it("requires approval for work that reaches outside Arturo", () => {
    savePolicyRules([invoicingRule]);

    expect(evaluateJobGovernance(invoicingJob)).toMatchObject({
      effect: "require-approval",
      matchedRuleId: invoicingRule.id,
      requiredApprovals: 1,
    });
  });

  // Inverted deliberately. A Task declaring no capability declares no effect
  // outside Arturo, so a consequentialOnly rule does not reach it. When the
  // rule gated the whole Function this had to be the other way round, or "this
  // Function needs a Human" was escapable by asking for nothing.
  it("lets a Task that requests no capability at all run", () => {
    savePolicyRules([invoicingRule]);

    expect(
      evaluateJobGovernance({ ...invoicingJob, requiredCapabilities: [] })
    ).toBeUndefined();
  });

  it("lets benign work in the same Function run without asking anyone", () => {
    savePolicyRules([invoicingRule]);

    expect(
      evaluateJobGovernance({
        ...invoicingJob,
        task: "Compose a quote for the requested boiler repairs.",
        requiredCapabilities: ["analysis"],
      })
    ).toBeUndefined();
  });

  // These two assert on the matched rule, not merely on the effect. The Job
  // sends email, so the fail-closed consequential default gates it either way;
  // only the rule id shows whether invoicing's rule wrongly reached across.
  it("leaves another Function's work alone", () => {
    savePolicyRules([invoicingRule]);

    expect(
      evaluateJobGovernance({
        ...invoicingJob,
        businessFunctionId: "enterprise-1:scheduling",
      })
    ).toMatchObject({ matchedRuleId: FAIL_CLOSED_CONSEQUENTIAL_RULE_ID });
  });

  it("does not apply a Function rule to work that names no Function", () => {
    savePolicyRules([invoicingRule]);

    expect(
      evaluateJobGovernance({ ...invoicingJob, businessFunctionId: undefined })
    ).toMatchObject({ matchedRuleId: FAIL_CLOSED_CONSEQUENTIAL_RULE_ID });
  });

  it("leaves another Function's benign work alone entirely", () => {
    savePolicyRules([invoicingRule]);

    expect(
      evaluateJobGovernance({
        ...invoicingJob,
        task: "Compose a quote.",
        requiredCapabilities: ["analysis"],
        businessFunctionId: "enterprise-1:scheduling",
      })
    ).toBeUndefined();
  });
});
