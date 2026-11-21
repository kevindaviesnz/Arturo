import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  Job,
} from "../runtime/jobQueue";

import {
  clearPersistedJobs,
  loadJobs,
  parsePersistedJobJson,
  saveJob,
} from "./jobRepository";

beforeEach(() => {
  clearPersistedJobs();
});

describe("jobRepository", () => {
  it("round-trips execution and governance state needed after restart", () => {
    const job: Job = {
      id: "task-persistence-1",
      task: "Review the supplier contract",
      owningJobId:
        "enterprise-1:legal-operations",
      worker:
        "Legal Researcher",
      reviewToken:
        "review-token-1",
      requiredCapabilities: [
        "analysis",
        "human-review",
      ],
      selectedWorker:
        "Legal Researcher",
      routingReason:
        "Selected by legal operations",
      enterpriseId:
        "enterprise-1",
      businessFunctionId:
        "enterprise-1:legal-operations",
      sourceTaskId:
        "task-source-1",
      sourceHumanTaskId:
        "human-task-source-1",
      followUpDepth: 2,
      inputArtefactRefs: [
        "artefact-contract-1",
      ],
      artefactApprovalDependencies: [
        "artefact-approval-1",
      ],
      procedureRef:
        "proc-contract-review@3",
      reviewLoop: {
        loopId: "review-loop-1",
        draftWorkerName:
          "Legal Researcher",
        criticWorkerName:
          "Legal Reviewer",
        decisionWorkerName:
          "Partner",
        attempt: 2,
        maxAttempts: 4,
      },
      kernelCallId:
        "kernel-call-1",
      status:
        "awaiting_revision",
      rawOutput:
        "Unrevised draft",
      output:
        "Current reviewed output",
      createdAt: 100,
      assignedAt: 110,
      startedAt: 120,
      approvalRequestedAt: 130,
      requiredApprovals: 2,
      approvalPolicy: {
        type: "threshold",
        requiredApprovals: 2,
      },
      revisionRequestedAt: 140,
      revisionInstructions:
        "Re-check the limitation clause.",
      humanTaskRevision: {
        sourceHumanTaskId:
          "human-task-1",
        sourceHumanJobId:
          "task-human-1",
        revisionInstructions:
          "Confirm the photographed clause before revising.",
      },
    };

    saveJob(job);

    expect(loadJobs()).toEqual([
      job,
    ]);
  });

  it("fails closed when security-sensitive persisted JSON is malformed", () => {
    expect(() =>
      parsePersistedJobJson(
        "{not-json",
        "approvalPolicy"
      )
    ).toThrow(
      "Invalid persisted Job approvalPolicy: malformed JSON."
    );
  });
});
