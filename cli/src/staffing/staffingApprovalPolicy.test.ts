import { describe, expect, it } from "vitest";

import type { PolicyRule } from "../policy/policyRule";

import {
  buildStaffingApprovalRules,
  mergeStaffingApprovalRules,
  staffingApprovalRuleId,
} from "./staffingApprovalPolicy";

const labelFor = (id: string) => (id === "e-1:invoicing" ? "invoicing" : id);

describe("buildStaffingApprovalRules", () => {
  it("turns an approval requirement into a Function-scoped require-approval rule", () => {
    const [rule] = buildStaffingApprovalRules(
      [{ functionId: "e-1:invoicing", rationale: "Money leaves the business." }],
      "e-1",
      labelFor
    );

    expect(rule).toMatchObject({
      id: "staffing-approval:e-1:invoicing",
      effect: "require-approval",
      match: {
        businessFunctionId: "e-1:invoicing",
        consequentialOnly: true,
      },
      scope: { type: "organization", id: "e-1" },
      requiredApprovals: 1,
    });
    expect(rule.description).toContain("invoicing");
  });

  it("narrows the rule by consequence, never by a named capability", () => {
    const [rule] = buildStaffingApprovalRules(
      [{ functionId: "e-1:invoicing", rationale: "Money." }],
      "e-1",
      labelFor
    );

    // A requirement on the Function must not be escapable by requesting a
    // capability the rule happens not to name. That still holds: naming a
    // capability is an enumeration whose complement grows silently every time
    // one is added, and nobody re-audits the rule.
    expect(rule.match.capabilityId).toBeUndefined();
    expect(rule.match.riskLevel).toBeUndefined();

    // Narrowing by consequence is a different thing, and safe, because
    // isConsequentialCapability is the same predicate jobGovernance already
    // uses to fail closed when NO rule matches. The work this rule declines to
    // gate is exactly the work governance had already decided may run
    // ungoverned, so "consequential implies gated" still holds everywhere —
    // by this rule where it exists, by the fail-closed default where it does
    // not. Gating drafting and analysis instead taught operators to approve
    // without reading, which costs more than it protects.
    expect(rule.match.consequentialOnly).toBe(true);
  });

  it("emits one rule per Function even if the plan repeats it", () => {
    expect(
      buildStaffingApprovalRules(
        [
          { functionId: "e-1:invoicing", rationale: "One." },
          { functionId: "e-1:invoicing", rationale: "Two." },
        ],
        "e-1",
        labelFor
      )
    ).toHaveLength(1);
  });
});

describe("mergeStaffingApprovalRules", () => {
  const existing: PolicyRule[] = [
    { id: "allow-all", description: "Allow", match: {}, effect: "allow" },
  ];

  it("puts the approval requirement ahead of a broader allow rule", () => {
    const merged = mergeStaffingApprovalRules(
      existing,
      buildStaffingApprovalRules(
        [{ functionId: "e-1:invoicing", rationale: "Money." }],
        "e-1",
        labelFor
      )
    );

    expect(merged.map((rule) => rule.id)).toEqual([
      "staffing-approval:e-1:invoicing",
      "allow-all",
    ]);
  });

  it("replaces a Function's rule when staffing is re-run rather than duplicating it", () => {
    const first = mergeStaffingApprovalRules(
      existing,
      buildStaffingApprovalRules(
        [{ functionId: "e-1:invoicing", rationale: "Money." }],
        "e-1",
        labelFor
      )
    );
    const second = mergeStaffingApprovalRules(
      first,
      buildStaffingApprovalRules(
        [{ functionId: "e-1:invoicing", rationale: "Money, restated." }],
        "e-1",
        labelFor
      )
    );

    expect(
      second.filter(
        (rule) => rule.id === staffingApprovalRuleId("e-1:invoicing")
      )
    ).toHaveLength(1);
  });
});
