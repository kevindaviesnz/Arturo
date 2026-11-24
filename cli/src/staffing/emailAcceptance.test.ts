import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import {
  accountFromSession,
  clearSignIn,
  maySignOff,
  redeemInvite,
  turnOnSignIn,
  type Account,
} from "../identity/companySignIn";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { clearResultSignOffs, hashResult, readResultSignOffStanding } from "../runtime/resultSignOff";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearStaffingAssignments, saveStaffingAssignment } from "./staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { signOffTaskResult } from "../task/taskSignOff";
import {
  clearEmailAcceptances,
  emailAcceptanceForJob,
  formatEmailAcceptanceLine,
  formatWeeklyEmailAcceptances,
  recordEmailAcceptance,
} from "./emailAcceptance";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearEmailAcceptances();
  clearStaffingAssignments();
  clearWorkers();
  clearSignIn();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("freelancer emailed-acceptance note", () => {
  let enterpriseId: string;
  const functionId = () => `${enterpriseId}:contracts`;

  beforeEach(() => {
    reset();
    expect(setUpBusiness(["BrightPath Studio", "--owner", "John Smith", "--about", "A studio"]).created).toBe(true);
    enterpriseId = listEnterprises()[0].id;
    addWorker(createHumanWorker("John Smith", "guardian"));
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: "John Smith",
      role: "human-approver",
      rationale: "Owner.",
    });
  });
  afterEach(reset);

  const signedInOwner = (): Account => {
    const turned = turnOnSignIn({ enterpriseId, owner: "John Smith" });
    if ("refused" in turned) throw new Error(turned.refused);
    const joined = redeemInvite({ code: turned.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    const account = accountFromSession(joined.token);
    if (!account) throw new Error("owner session was not created");
    return account;
  };

  const finished = () =>
    replaceJob({
      ...enqueueJob("Review chapter 3 edits.", undefined, { businessFunctionId: functionId(), enterpriseId }),
      status: "completed",
      output: "The chapter is ready.",
    });

  it("saves the note with the owner's sign-off and never grants Dana a right", () => {
    const owner = signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Dana Editor", role: "worker" }).added).toBe(true);
    const job = finished();
    const outcome = signOffTaskResult([
      job.id,
      "--as",
      "John Smith",
      "--accepted-by",
      "Dana Editor",
      "--email-date",
      "24 Nov",
      "--email-subject",
      "Re: chapter 3 edits",
    ]);
    expect(outcome.signedOff).toBe(true);
    expect(outcome.message).toContain('Signed off by John Smith. Recorded by John Smith: Dana Editor accepted this by email, 24 Nov ("Re: chapter 3 edits").');
    const standing = readResultSignOffStanding(job);
    expect(standing.state).toBe("signed");
    if (standing.state === "signed") {
      expect(standing.signOff.worker).toBe("John Smith");
      expect(standing.signOff.worker).not.toBe("Dana Editor");
    }
    const note = emailAcceptanceForJob(job.id);
    expect(note?.freelancerName).toBe("Dana Editor");
    expect(note?.freelancerReported).toBe(true);
    expect(note?.byEmail).toBe(true);
    expect(note?.resultSha256).toBe(hashResult("The chapter is ready."));
    expect(note?.noteSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(note && "emailBody" in note).toBe(false);
    expect(maySignOff(enterpriseId, "Dana Editor")).toBe(false);
    expect(listRuntimeEventStore().some((event) => event.type === "staff.email_acceptance")).toBe(true);
    expect(formatWeeklyEmailAcceptances(enterpriseId)).toContain("Review chapter 3 edits.");
    expect(formatWeeklyEmailAcceptances(enterpriseId)).toContain("Dana Editor accepted this by email, 24 Nov");
  });

  it("is owner-only and does not write a note when the sign-off is refused", () => {
    signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Dana Editor", role: "worker" }).added).toBe(true);
    const job = finished();
    const asDana = recordEmailAcceptance({
      enterpriseId,
      jobId: job.id,
      recordedBy: "Dana Editor",
      freelancerName: "Dana Editor",
      emailDate: "24 Nov",
    }, job);
    expect("refused" in asDana && asDana.refused).toContain("Only the owner");
    expect(emailAcceptanceForJob(job.id)).toBeUndefined();
  });

  it("formats the line with an optional subject", () => {
    expect(formatEmailAcceptanceLine({
      id: "n1",
      enterpriseId: "e1",
      jobId: "j1",
      resultSha256: "abc",
      recordedBy: "John",
      freelancerName: "Dana",
      freelancerReported: true,
      byEmail: true,
      emailDate: "24 Nov",
      emailSubject: "Re: chapter 3 edits",
      noteSha256: "def",
      recordedAt: 0,
      signature: "sig",
    })).toBe('Signed off by John. Recorded by John: Dana accepted this by email, 24 Nov ("Re: chapter 3 edits").');
  });
});
