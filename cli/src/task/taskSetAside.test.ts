import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearJobs, enqueueJob, getJob, replaceJob } from "../runtime/jobQueue";
import { clearResultSignOffs, readResultSignOffStanding, refuseUnacceptedHandOver } from "../runtime/resultSignOff";
import {
  clearResultSetAsides,
  createResultSetAsidePayload,
  readResultSetAsideStanding,
  verifyResultSetAsideSignature,
} from "../runtime/resultSetAside";
import { verifyResultSignOffSignature } from "../runtime/resultSignOff";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { signOffTaskResult } from "./taskSignOff";
import { setAsideTaskResult } from "./taskSetAside";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";

const FUNCTION_ID = "e-1:client-advice";
const AI = "Evidence status: UNVERIFIED MODEL SYNTHESIS\nExternal tools used: none\n\n";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearResultSetAsides();
  clearStaffingAssignments();
  clearWorkers();
};

describe("setting a result aside: read, and not accepted", () => {
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Amy", "guardian"));
    addWorker(createHumanWorker("Sam", "guardian"));
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "Amy", role: "human-approver", rationale: "Principal." });
  });
  afterEach(reset);

  const review = (output = `${AI}Clause 4 favours the Client.`) =>
    replaceJob({ ...enqueueJob("Review the agreement.", "Contract Reviewer", { businessFunctionId: FUNCTION_ID }), status: "completed", output });

  it("records who set it aside and why, signed and tied to the exact result", () => {
    const job = review();
    const outcome = setAsideTaskResult([job.id, "Clause 4 verdict is backwards.", "--as", "Amy"]);

    expect(outcome.setAside).toBe(true);
    expect(outcome.message).toContain('Amy set this result aside on');
    expect(outcome.message).toContain("It was read and not accepted. Reason: Clause 4 verdict is backwards.");
    const standing = readResultSetAsideStanding(getJob(job.id)!);
    expect(standing).toMatchObject({ state: "set_aside", setAside: { worker: "Amy", reason: "Clause 4 verdict is backwards." } });

    // Its own purpose: it can never verify as a sign-off.
    const record = (standing as { setAside: Parameters<typeof verifyResultSetAsideSignature>[0] }).setAside;
    expect(verifyResultSetAsideSignature(record, getLocalApprovalSigningSecret())).toBe(true);
    expect(JSON.parse(createResultSetAsidePayload(record)).purpose).toBe("result-set-aside");
    expect(verifyResultSignOffSignature({ ...record } as never, getLocalApprovalSigningSecret())).toBe(false);

    // A changed result is no longer the one that was set aside.
    replaceJob({ ...getJob(job.id)!, output: `${AI}Clause 4 favours the Supplier.` });
    expect(readResultSetAsideStanding(getJob(job.id)!).state).toBe("superseded");
  });

  it("refuses before recording: no reason, someone not accountable, a result already signed off or set aside", () => {
    const job = review();
    expect(setAsideTaskResult([job.id, "--as", "Amy"]).message).toContain("Say why you are setting it aside");
    expect(setAsideTaskResult([job.id, "x".repeat(501), "--as", "Amy"]).message).toContain("under 500");
    expect(setAsideTaskResult([job.id, "Not mine to judge.", "--as", "Sam"]).message).toContain("Sam is not accountable for this Function");
    expect(setAsideTaskResult(["task-404", "Gone.", "--as", "Amy"]).setAside).toBe(false);
    expect(readResultSetAsideStanding(job).state).toBe("none");

    const signed = review();
    expect(signOffTaskResult([signed.id, "--as", "Amy"]).signedOff).toBe(true);
    expect(setAsideTaskResult([signed.id, "Changed my mind.", "--as", "Amy"]).message).toContain("was signed off by Amy, so it cannot be set aside");

    expect(setAsideTaskResult([job.id, "Wrong.", "--as", "Amy"]).setAside).toBe(true);
    expect(setAsideTaskResult([job.id, "Wrong again.", "--as", "Amy"]).message).toContain("already set aside by Amy");
  });

  it("cannot then be signed off or handed to anyone", () => {
    const job = review();
    setAsideTaskResult([job.id, "No agreement was attached.", "--as", "Amy"]);

    const signOff = signOffTaskResult([job.id, "--as", "Amy"]);
    expect(signOff.signedOff).toBe(false);
    expect(signOff.message).toContain('Amy set ' + job.id + ' aside: "No agreement was attached."');
    expect(readResultSignOffStanding(getJob(job.id)!).state).toBe("none");
    expect(refuseUnacceptedHandOver(getJob(job.id)!)).toBeDefined();
  });
});
