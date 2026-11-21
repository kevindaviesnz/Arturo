import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
} from "../control/workers";

import {
  clearJobs,
  enqueueJob,
  replaceJob,
} from "../runtime/jobQueue";

import {
  clearApprovalChains,
  createApprovalChain,
  storeApprovalChain,
} from "../runtime/approvalChainStore";

import {
  describeApprovalTarget,
  describeMissingApprovalTask,
  describeTaskNotAwaitingDecision,
  extractApprovalTaskId,
  resolveApprovalCommandIdentity,
} from "./approvalCommands";

describe("resolveApprovalCommandIdentity", () => {
  beforeEach(clearWorkers);
  afterEach(clearWorkers);

  it("automatically selects the sole eligible human approver", () => {
    addWorker(createHumanWorker("Kevin", "guardian"));

    expect(resolveApprovalCommandIdentity(["job-1"])).toEqual({
      workerName: "Kevin",
      remainingArgs: ["job-1"],
    });
  });

  it("requires --as when multiple human approvers are eligible", () => {
    addWorker(createHumanWorker("Kevin", "guardian"));
    addWorker(createHumanWorker("Morgan", "reviewer"));

    expect(() => resolveApprovalCommandIdentity(["job-1"])).toThrow(
      'Use --as "<name>".'
    );

    expect(
      resolveApprovalCommandIdentity(["job-1", "--as", "Morgan"])
    ).toEqual({
      workerName: "Morgan",
      remainingArgs: ["job-1"],
    });
  });

  it("tells an operator whose only Human cannot approve to register an approving one, not to add another Human", () => {
    // The exact walkthrough dead end: `/add-human-worker "Sal"` with no
    // archetype lands in "task" mode, so the bare `/approve <task>` auto-select
    // finds no eligible approver. The message must point at an approving role,
    // not send the operator back to add a Human they already have.
    addWorker(createHumanWorker("Sal"));

    expect(() => resolveApprovalCommandIdentity(["task-1"])).toThrow(
      "not approval-capable"
    );
    // Switch-free guidance: points at the guided /add-human-worker flow.
    expect(() => resolveApprovalCommandIdentity(["task-1"])).toThrow(
      "/add-human-worker"
    );
    expect(() => resolveApprovalCommandIdentity(["task-1"])).not.toThrow(
      "--archetype guardian"
    );
  });

  it("still asks for a first Human when none is registered at all", () => {
    expect(() => resolveApprovalCommandIdentity(["task-1"])).toThrow(
      "No one is on record who can approve this yet"
    );
    // Answers the solo operator's "why can't I just approve?" — even if it's you.
    expect(() => resolveApprovalCommandIdentity(["task-1"])).toThrow(
      "even if it's you"
    );
  });

  it("distinguishes a registered-but-unauthorised human from an unknown one", () => {
    addWorker(createHumanWorker("Taylor", "creator"));

    // Known identity, but their role does not include approving.
    expect(() =>
      resolveApprovalCommandIdentity(["job-1", "--as", "Taylor"])
    ).toThrow("not an approval-capable Worker");

    // No such identity at all — a different security outcome, different message.
    expect(() =>
      resolveApprovalCommandIdentity(["job-1", "--as", "Mallory"])
    ).toThrow("No registered Worker named Mallory");
  });

});

describe("describeMissingApprovalTask", () => {
  beforeEach(clearWorkers);
  afterEach(clearWorkers);

  it("diagnoses a nonexistent Task before blaming the approver roster", () => {
    // /approve task-99 with no approvers used to report "No available
    // registered human approver" — the wrong problem. The Task's absence is
    // independent of who is asking, so it is checked first.
    expect(describeMissingApprovalTask(["task-99"])).toContain(
      "No Task found with id task-99"
    );
  });

  it("extracts the Task id around an --as pair in either position", () => {
    expect(extractApprovalTaskId(["task-1", "--as", "Mallory"])).toBe("task-1");
    expect(extractApprovalTaskId(["--as", "Mallory", "task-1"])).toBe("task-1");
    expect(extractApprovalTaskId(["--as", "Mallory"])).toBeUndefined();
  });
});

/**
 * Approving a finished Task surfaced the internal "Approval chain not found",
 * which reads like a broken installation. A chain exists only while a Task is
 * held before execution, so a completed Task never has one — that is the design,
 * not a fault, and the answer has to say so and point somewhere useful.
 */
describe("describeTaskNotAwaitingDecision", () => {
  beforeEach(() => {
    clearWorkers();
    clearJobs();
  });
  afterEach(() => {
    clearWorkers();
    clearJobs();
  });

  function seedJob(status: "completed" | "queued"): string {
    const job = enqueueJob("Review the supplied evidence.");
    replaceJob({ ...job, status });
    return job.id;
  }

  it("explains that a completed Task cannot be approved, and where review lives", () => {
    const id = seedJob("completed");

    const message =
      describeTaskNotAwaitingDecision([id], "approve");

    expect(message).toContain("has already finished");
    expect(message).toContain("nothing to approve");
    // The operator wanting to judge the result is asking for something real.
    expect(message).toContain("/artefact submit");
    expect(message).not.toContain("Approval chain not found");
  });

  it("uses the operator's own verb when rejecting", () => {
    const id = seedJob("completed");

    expect(
      describeTaskNotAwaitingDecision([id], "reject")
    ).toContain("nothing to reject");
  });

  it("refuses a Task whose approval was already given, at every later status", () => {
    for (const status of ["queued", "running", "completed", "failed"] as const) {
      const job = enqueueJob("Send the approved advice.");
      replaceJob({ ...job, status });
      storeApprovalChain({ ...createApprovalChain(job.id, 1), status: "approved" });

      expect(describeTaskNotAwaitingDecision([job.id], "approve"), status).toContain("nothing to approve");
      expect(describeTaskNotAwaitingDecision([job.id], "reject"), status).toContain("nothing to reject");
    }
    clearApprovalChains();
  });

  it("lets a decision through while the Task is still held", () => {
    const job = enqueueJob("Send the advice.");
    replaceJob({ ...job, status: "awaiting_approval" });
    storeApprovalChain(createApprovalChain(job.id, 1));

    expect(describeTaskNotAwaitingDecision([job.id], "approve")).toBeUndefined();
    clearApprovalChains();
  });

  it("names the status when a Task is simply not waiting on anyone", () => {
    const id = seedJob("queued");

    const message =
      describeTaskNotAwaitingDecision([id], "approve");

    expect(message).toContain("not waiting for a decision");
    expect(message).toContain("queued");
  });

  it("stays out of the way when the Task really is awaiting approval", () => {
    // No chain and no Task at all: that is the missing-Task diagnosis's job,
    // not this one, and returning a message here would pre-empt it.
    expect(
      describeTaskNotAwaitingDecision(["task-99"], "approve")
    ).toBeUndefined();
  });
});

describe("describeApprovalTarget", () => {
  it("names the Task and requested approver for the audit record", () => {
    expect(
      describeApprovalTarget(["task-1", "--as", "Mallory"])
    ).toBe("Task task-1 by Mallory");
  });

  it("does not mistake the --as value for the Task id", () => {
    expect(
      describeApprovalTarget(["--as", "Mallory", "task-1"])
    ).toBe("Task task-1 by Mallory");
  });

  it("describes a bare Task with no requested approver", () => {
    expect(describeApprovalTarget(["task-1"])).toBe("Task task-1");
  });
});
