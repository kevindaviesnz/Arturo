import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createSignedApprovalDecision,
  signApprovalDecision,
  verifyApprovalDecisionSignature,
} from "./approvalDecisionSigning";

describe(
  "approvalDecisionSigning",
  () => {
    it(
      "creates deterministic signatures",
      () => {
        const signature1 =
          signApprovalDecision(
            {
              worker:
                "alice",
              decision:
                "approved",
              timestamp: 1000,
            },
            "job-1",
            "secret"
          );

        const signature2 =
          signApprovalDecision(
            {
              worker:
                "alice",
              decision:
                "approved",
              timestamp: 1000,
            },
            "job-1",
            "secret"
          );

        expect(
          signature1
        ).toBe(signature2);
      }
    );

    it(
      "verifies signed approval decisions",
      () => {
        const signed =
          createSignedApprovalDecision(
            {
              worker:
                "alice",
              decision:
                "approved",
              timestamp: 1000,
            },
            "job-1",
            "secret"
          );

        expect(
          verifyApprovalDecisionSignature(
            signed,
            "job-1",
            "secret"
          )
        ).toBe(true);
      }
    );

    it(
      "rejects tampered signatures",
      () => {
        const signed =
          createSignedApprovalDecision(
            {
              worker:
                "alice",
              decision:
                "approved",
              timestamp: 1000,
            },
            "job-1",
            "secret"
          );

        const tampered = {
          ...signed,
          decision:
            "rejected" as const,
        };

        expect(
          verifyApprovalDecisionSignature(
            tampered,
            "job-1",
            "secret"
          )
        ).toBe(false);
      }
    );

    it(
      "does not verify a decision signed for a different job",
      () => {
        const signed =
          createSignedApprovalDecision(
            {
              worker:
                "alice",
              decision:
                "approved",
              timestamp: 1000,
            },
            "job-1",
            "secret"
          );

        expect(
          verifyApprovalDecisionSignature(
            signed,
            "job-2",
            "secret"
          )
        ).toBe(false);
      }
    );
  }
);
it("binds authenticated User identity into the approval signature", () => {
 const signed=createSignedApprovalDecision({worker:"alice",userId:"user-1",decision:"approved",timestamp:1000},"job-1","secret");
 expect(verifyApprovalDecisionSignature(signed,"job-1","secret")).toBe(true);
 expect(verifyApprovalDecisionSignature({...signed,userId:"user-2"},"job-1","secret")).toBe(false);
 const {userId,...removed}=signed;
 expect(verifyApprovalDecisionSignature(removed,"job-1","secret")).toBe(false);
});

it("binds what the decision decided into the approval signature", () => {
  const released = createSignedApprovalDecision(
    { worker: "alice", kind: "release", decision: "approved", timestamp: 1000 },
    "job-1",
    "secret"
  );

  expect(verifyApprovalDecisionSignature(released, "job-1", "secret")).toBe(true);
  // A go-ahead cannot be rewritten into acceptance of the result, or stripped
  // back to a bare "approved" that reads as either.
  expect(verifyApprovalDecisionSignature({ ...released, kind: "review" }, "job-1", "secret")).toBe(false);
  const { kind, ...stripped } = released;
  expect(kind).toBe("release");
  expect(verifyApprovalDecisionSignature(stripped, "job-1", "secret")).toBe(false);
});

it("still verifies a decision recorded before the kind existed", () => {
  const older = createSignedApprovalDecision(
    { worker: "alice", decision: "approved", timestamp: 1000 },
    "job-1",
    "secret"
  );

  expect(older.signature).toBe(
    signApprovalDecision({ worker: "alice", decision: "approved", timestamp: 1000 }, "job-1", "secret")
  );
  expect(verifyApprovalDecisionSignature(older, "job-1", "secret")).toBe(true);
  expect(verifyApprovalDecisionSignature({ ...older, kind: "review" }, "job-1", "secret")).toBe(false);
});
