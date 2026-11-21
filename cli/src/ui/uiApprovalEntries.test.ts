import {
  savePolicyRules,
} from "../storage/policyRepository";

import {
  countApprovalDecisions,
  createApprovalEntries,
  createApprovalWorkStreamEntry,
} from "./uiApprovalEntries";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiApprovalEntries",
  () => {
    it(
      "counts approval decisions",
      () => {
        expect(
          countApprovalDecisions({
            jobId: "job-1",
            requiredApprovals: 2,
            decisions: [
              {
                worker: "operator",
                decision: "approved",
              },
            ],
            status: "pending",
          } as never)
        ).toBe(
          1
        );
      }
    );

    it(
      "creates empty approval entry",
      () => {
        expect(
          createApprovalEntries(
            []
          )
        ).toEqual([
          {
            actor: "Arturo",
            label: "Approvals",
            body: "No approval chains found.",
          },
        ]);
      }
    );

    it(
      "creates approval entries",
      () => {
        const entries =
          createApprovalEntries([
            {
              jobId: "job-1",
              requiredApprovals: 2,
            decisions: [],
              status: "pending",
            },
          ] as never);

        expect(
          entries[0]
        ).toEqual({
          actor: "Approval",
          label: "job-1 · pending",
          body: [
            "What: Not found",
            // No rule is recorded, so the requirement came from the Task
            // asking for human review. Claiming a rule would be false.
            "Why it needs you: This Task asks for human review.",
            "Signed off so far: 0 of 2",
            "Who can approve: anyone on your team with the approve role (that can be you)",
            "",
            "To approve:   /approve job-1",
            'To turn down: /reject job-1 "<reason>"',
          ].join("\n"),
        });
      }
    );

    it("shows the human who made a decision", () => {
      expect(
        createApprovalWorkStreamEntry({
          jobId: "job-1",
          requiredApprovals: 1,
          status: "approved",
          decisions: [
            {
              worker: "Kevin",
              decision: "approved",
              timestamp: 1,
            },
          ],
        }).body
      ).toContain("Approved by Kevin");
    });

    it("names a recorded rule that is no longer stored, rather than implying one matched", () => {
      expect(
        createApprovalWorkStreamEntry({
          jobId: "job-1",
          requiredApprovals: 1,
          status: "pending",
          decisions: [],
          governancePolicyId: "policy-investor-review",
        }).body
      ).toContain(
        "Why it needs you: A Governance rule that is no longer stored (policy-investor-review)."
      );
    });

    it("names the rule in plain words when it is still stored", () => {
      savePolicyRules([
        {
          id: "policy-investor-review",
          description: "Investor-facing analysis needs a person to sign it off",
          match: { capabilityId: "analysis" },
          effect: "require-approval",
        },
      ]);

      expect(
        createApprovalWorkStreamEntry({
          jobId: "job-1",
          requiredApprovals: 1,
          status: "pending",
          decisions: [],
          governancePolicyId: "policy-investor-review",
        }).body
      ).toContain(
        "Why it needs you: Investor-facing analysis needs a person to sign it off"
      );

      savePolicyRules([]);
    });
  }
);
