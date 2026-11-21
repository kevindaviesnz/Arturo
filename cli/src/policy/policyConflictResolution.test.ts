import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolvePolicyConflicts,
} from "./policyConflictResolution";

describe("policyConflictResolution", () => {
  it("preserves order for first-match-wins", () => {
    const rules = [
      {
        id: "allow-rule",
        description:
          "Allow rule",
        effect: "allow" as const,
        match: {},
      },
      {
        id: "deny-rule",
        description:
          "Deny rule",
        effect: "deny" as const,
        match: {},
      },
    ];

    expect(
      resolvePolicyConflicts(
        rules,
        "first-match-wins"
      ).map((rule) => rule.id)
    ).toEqual([
      "allow-rule",
      "deny-rule",
    ]);
  });

  it("moves deny rules first for deny-wins", () => {
    const rules = [
      {
        id: "allow-rule",
        description:
          "Allow rule",
        effect: "allow" as const,
        match: {},
      },
      {
        id: "approval-rule",
        description:
          "Approval rule",
        effect:
          "require-approval" as const,
        match: {},
      },
      {
        id: "deny-rule",
        description:
          "Deny rule",
        effect: "deny" as const,
        match: {},
      },
    ];

    expect(
      resolvePolicyConflicts(
        rules,
        "deny-wins"
      ).map((rule) => rule.id)
    ).toEqual([
      "deny-rule",
      "allow-rule",
      "approval-rule",
    ]);
  });

  it("does not mutate original rules", () => {
    const rules = [
      {
        id: "allow-rule",
        description:
          "Allow rule",
        effect: "allow" as const,
        match: {},
      },
      {
        id: "deny-rule",
        description:
          "Deny rule",
        effect: "deny" as const,
        match: {},
      },
    ];

    resolvePolicyConflicts(
      rules,
      "deny-wins"
    );

    expect(
      rules.map((rule) => rule.id)
    ).toEqual([
      "allow-rule",
      "deny-rule",
    ]);
  });
});