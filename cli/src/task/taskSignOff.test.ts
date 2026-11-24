import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUpBusiness } from "../clients/clientCommands";
import { addWorker, clearWorkers, createHumanWorker, setHumanWorkerSignOff } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { accountFromSession, clearSignIn, redeemInvite, setSignOffRight, turnOnSignIn, type Account } from "../identity/companySignIn";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { clearResultSignOffs, readResultSignOffStanding } from "../runtime/resultSignOff";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
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

describe("the sign-off right (maySignOff)", () => {
  let enterpriseId: string;
  const functionId = () => `${enterpriseId}:contracts`;

  const resetRight = () => {
    reset();
    clearSignIn();
    clearEnterprises();
    runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
    runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
    runtimeDb.prepare("DELETE FROM identity_users").run();
    runtimeDb.prepare("DELETE FROM identity_sessions").run();
  };

  beforeEach(() => {
    resetRight();
    expect(setUpBusiness(["BrightPath Studio", "--owner", "Priya Nair", "--about", "A design studio"]).created).toBe(true);
    enterpriseId = listEnterprises()[0].id;
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: "Priya Nair",
      role: "human-approver",
      rationale: "Principal.",
    });
  });
  afterEach(resetRight);

  const finished = () =>
    replaceJob({
      ...enqueueJob("Review the lease.", undefined, { businessFunctionId: functionId(), enterpriseId }),
      status: "completed",
      output: "The lease is one-sided.",
    });

  const signedInOwner = (): Account => {
    const turned = turnOnSignIn({ enterpriseId, owner: "Priya Nair" });
    if ("refused" in turned) throw new Error(turned.refused);
    const joined = redeemInvite({ code: turned.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    const account = accountFromSession(joined.token);
    if (!account) throw new Error("owner session was not created");
    return account;
  };

  it("refuses a person who lacks the right, and writes nothing", () => {
    signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Sam Okonjo", role: "approver" }).added).toBe(true);
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: "Sam Okonjo",
      role: "human-approver",
      rationale: "Added after sign-in, with no grant.",
    });

    const job = finished();
    const outcome = signOffTaskResult([job.id, "--as", "Sam Okonjo"]);

    expect(outcome).toMatchObject({
      signedOff: false,
      code: "cannot_sign_off",
      message: "Sam Okonjo may not sign off work at this business, so this sign-off was not recorded.",
    });
    expect(readResultSignOffStanding(job).state).toBe("none");
  });

  it("records the sign-off when the person has the right", () => {
    signedInOwner();
    const job = finished();
    const outcome = signOffTaskResult([job.id, "--as", "Priya Nair"]);

    expect(outcome).toMatchObject({ signedOff: true });
    expect(readResultSignOffStanding(job)).toMatchObject({
      state: "signed",
      signOff: { worker: "Priya Nair" },
    });
  });

  it("refuses a later sign-off after the right is taken away, and leaves the earlier one standing", () => {
    expect(addEnterprisePerson({ enterpriseId, name: "Sam Okonjo", role: "approver" }).added).toBe(true);
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: "Sam Okonjo",
      role: "human-approver",
      rationale: "Also accountable.",
    });
    const priya = signedInOwner();
    const granted = setSignOffRight({
      enterpriseId,
      person: "Sam Okonjo",
      canSignOff: true,
      actor: priya,
    });
    if ("refused" in granted) throw new Error(granted.refused);

    const first = finished();
    expect(signOffTaskResult([first.id, "--as", "Sam Okonjo"])).toMatchObject({ signedOff: true });

    const revoked = setSignOffRight({
      enterpriseId,
      person: "Sam Okonjo",
      canSignOff: false,
      actor: priya,
    });
    if ("refused" in revoked) throw new Error(revoked.refused);
    // setSignOffRight also switches the mode to "task". Restore approval
    // mode so this tests the grant, not the earlier mode check: changing
    // a person's mode is not enough without the grant.
    setHumanWorkerSignOff("Sam Okonjo", true);

    const second = finished();
    const outcome = signOffTaskResult([second.id, "--as", "Sam Okonjo"]);

    expect(outcome).toMatchObject({
      signedOff: false,
      code: "cannot_sign_off",
    });
    expect(readResultSignOffStanding(first)).toMatchObject({
      state: "signed",
      signOff: { worker: "Sam Okonjo" },
    });
    expect(readResultSignOffStanding(second).state).toBe("none");
  });
});
