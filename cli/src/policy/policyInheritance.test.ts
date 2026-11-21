import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveInheritedPolicies,
} from "./policyInheritance";

import type {
  PolicyRule,
} from "./policyRule";

describe(
  "policyInheritance",
  () => {
    it(
      "resolves inherited policies",
      () => {
        const rules: PolicyRule[] = [
          {
            id: "global",
            description:
              "global",
            effect: "deny",
            match: {},
            scope: {
              type: "global",
              id: "global",
            },
          },
          {
            id: "workflow",
            description:
              "workflow",
            effect: "allow",
            match: {},
            scope: {
              type: "workflow",
              id: "wf-1",
            },
          },
        ];

        const result =
          resolveInheritedPolicies(
            rules,
            [
              {
                type: "global",
                id: "global",
              },
              {
                type: "workflow",
                id: "wf-1",
              },
            ]
          );

        expect(
          result
        ).toHaveLength(2);
      }
    );
  }
);