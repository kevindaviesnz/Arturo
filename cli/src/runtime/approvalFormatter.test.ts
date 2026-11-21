import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createApprovalChain,
  addApprovalDecision,
} from "./approvalChainStore";

import {
  describeApprovalReason,
  describeDecisionMeaning,
  describeRecordedDecisions,
  formatApprovalChain,
} from "./approvalFormatter";

import {
  clearJobs,
  enqueueJob,
} from "./jobQueue";

import {
  FAIL_CLOSED_CONSEQUENTIAL_RULE_ID,
} from "./jobGovernance";

describe("formatApprovalChain", () => {
  it("formats empty approval chain", () => {
    const chain =
      createApprovalChain(
        "job-1",
        2
      );

    expect(
      formatApprovalChain(
        chain
      )
    ).toContain(
      "No decisions recorded"
    );
  });

  it("formats approval decisions", () => {
    const chain =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    expect(
      formatApprovalChain(
        chain
      )
    ).toContain(
      "alice: approved"
    );
  });

  it("formats rejection reasons", () => {
    const chain =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          1
        ),
        {
          worker: "bob",
          decision: "rejected",
          reason:
            "Unsafe deployment",
          timestamp: 1000,
        }
      );

    expect(
      formatApprovalChain(
        chain
      )
    ).toContain(
      "bob: rejected (Unsafe deployment)"
    );
  });

  it("shows approval counts", () => {
    const first =
      addApprovalDecision(
        createApprovalChain(
          "job-1",
          2
        ),
        {
          worker: "alice",
          decision: "approved",
          timestamp: 1000,
        }
      );

    const second =
      addApprovalDecision(
        first,
        {
          worker: "bob",
          decision: "approved",
          timestamp: 2000,
        }
      );

    const output =
      formatApprovalChain(
        second
      );

    expect(output).toContain(
      "Required approvals: 2"
    );

    expect(output).toContain(
      "Current approvals: 2"
    );

    expect(output).toContain(
      "Status: approved"
    );
  });
});

/**
 * The fail-closed marker is not a stored rule and never has been, so looking it
 * up reported "a Governance rule that is no longer stored" — telling the
 * operator a rule they wrote had been deleted when none was ever involved.
 * Since approval started tracking consequence rather than the whole Function,
 * this is the ordinary path rather than a rare one.
 */
describe("describeApprovalReason when governance failed closed", () => {
  afterEach(() => clearJobs());

  it("names what the Task can actually do", () => {
    clearJobs();
    const job = enqueueJob("Email the customer their quote.", "Worker", {
      requiredCapabilities: ["email-send"],
    });
    const chain = createApprovalChain(
      job.id,
      1,
      undefined,
      FAIL_CLOSED_CONSEQUENTIAL_RULE_ID
    );

    const reason = describeApprovalReason(chain);

    expect(reason).toContain("send email");
    expect(reason).toContain("no rule you have written covers it");
    expect(reason).not.toContain("no longer stored");
  });

  it("joins several capabilities readably", () => {
    clearJobs();
    const job = enqueueJob("Tidy up and tell the team.", "Worker", {
      requiredCapabilities: ["email-send", "file-write", "analysis"],
    });
    const chain = createApprovalChain(
      job.id,
      1,
      undefined,
      FAIL_CLOSED_CONSEQUENTIAL_RULE_ID
    );

    // analysis is not consequential, so it is not part of the reason.
    expect(describeApprovalReason(chain)).toContain(
      "send email and write files"
    );
  });

  it("still reports a genuinely deleted rule as deleted", () => {
    clearJobs();
    const job = enqueueJob("Anything", "Worker", {});
    const chain = createApprovalChain(job.id, 1, undefined, "policy-gone");

    expect(describeApprovalReason(chain)).toContain("no longer stored");
  });
});

describe("saying what a decision decided", () => {
  const decided = (kind: "release" | "review" | undefined, decision: "approved" | "rejected") =>
    addApprovalDecision(createApprovalChain("job-kind", 1), {
      worker: "Kevin",
      decision,
      timestamp: 1,
      ...(kind ? { kind } : {}),
    });

  it("keeps a go-ahead apart from a sign-off of the result", () => {
    expect(describeDecisionMeaning({ decision: "approved", kind: "release" })).toBe(
      "released the work to run; not a sign-off of the result"
    );
    expect(describeDecisionMeaning({ decision: "rejected", kind: "release" })).toBe(
      "refused to let the work run"
    );
    expect(describeDecisionMeaning({ decision: "approved", kind: "review" })).toBe(
      "accepted what was put in front of them for review"
    );
    expect(describeDecisionMeaning({ decision: "rejected", kind: "review" })).toBe(
      "rejected what was put in front of them for review"
    );
  });

  it("claims nothing about a decision recorded before the two were told apart", () => {
    expect(describeDecisionMeaning({ decision: "approved" })).toBeUndefined();
    expect(describeRecordedDecisions(decided(undefined, "approved"))).toEqual([]);
    expect(formatApprovalChain(decided(undefined, "approved"))).toMatch(/^Kevin: approved$/m);
  });

  it("names the decision in the chain and in the Task's own record", () => {
    expect(formatApprovalChain(decided("release", "approved"))).toContain(
      "Kevin: approved — released the work to run; not a sign-off of the result"
    );
    expect(describeRecordedDecisions(decided("release", "approved"))).toEqual([
      "Kevin released the work to run; not a sign-off of the result",
    ]);
  });
});
