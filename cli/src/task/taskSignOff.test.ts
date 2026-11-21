import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { clearResultSignOffs, readResultSignOffStanding } from "../runtime/resultSignOff";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { signOffTaskResult } from "./taskSignOff";

const FUNCTION_ID = "e-1:contracts";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearStaffingAssignments();
  clearWorkers();
};

describe("signing a Task's result off from the command", () => {
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Priya Nair", "guardian"));
    addWorker(createHumanWorker("Sam Okonjo", "guardian"));
    saveStaffingAssignment({
      businessFunctionId: FUNCTION_ID,
      workerName: "Priya Nair",
      role: "human-approver",
      rationale: "Principal.",
    });
  });
  afterEach(reset);

  const finished = () =>
    replaceJob({
      ...enqueueJob("Review the lease.", undefined, { businessFunctionId: FUNCTION_ID }),
      status: "completed",
      output: "The lease is one-sided.",
    });

  it("will not guess who is signing when more than one person could", () => {
    const job = finished();
    const outcome = signOffTaskResult([job.id]);

    expect(outcome.signedOff).toBe(false);
    expect(outcome.message).toContain('Use --as "<name>"');
    expect(readResultSignOffStanding(job).state).toBe("none");
  });

  it("refuses a registered approver the plan did not make accountable", () => {
    const job = finished();
    const outcome = signOffTaskResult([job.id, "--as", "Sam Okonjo"]);

    expect(outcome.signedOff).toBe(false);
    expect(outcome.message).toContain("Sam Okonjo is not accountable for this Function, so this sign-off was not recorded.");
    expect(outcome.message).toContain(`/task signoff ${job.id} --as "Priya Nair"`);
    expect(readResultSignOffStanding(job).state).toBe("none");
  });

  it("records the accountable person's sign-off", () => {
    const job = finished();
    const outcome = signOffTaskResult([job.id, "--as", "Priya Nair"]);

    expect(outcome).toMatchObject({ signedOff: true });
    expect(readResultSignOffStanding(job)).toMatchObject({
      state: "signed",
      signOff: { worker: "Priya Nair" },
    });
  });

  it("asks for a Task when none is named", () => {
    expect(signOffTaskResult(["--as", "Priya Nair"]).message).toContain("Usage: /task signoff");
    expect(signOffTaskResult(["task-404", "--as", "Priya Nair"]).message).toContain("There is no Task called task-404");
  });
});
