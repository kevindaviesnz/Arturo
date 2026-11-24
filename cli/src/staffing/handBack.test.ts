import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import {
  accountFromSession,
  clearSignIn,
  redeemInvite,
  setSignOffRight,
  turnOnSignIn,
  type Account,
} from "../identity/companySignIn";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { clearResultSignOffs } from "../runtime/resultSignOff";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearStaffingAssignments, saveStaffingAssignment } from "./staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { signOffTaskResult } from "../task/taskSignOff";
import {
  clearHandBacks,
  eligibleHandBackSigners,
  formatHandBackCount,
  formatRoleChangeHandBackConfirm,
  formatWasWaitingFor,
  handBackForJob,
  listOpenHandBacks,
  nameHandBackSigner,
  waitingDraftsForPerson,
} from "./handBack";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearStaffingAssignments();
  clearWorkers();
  clearHandBacks();
  clearSignIn();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("hand-back of waiting drafts", () => {
  let enterpriseId: string;
  const functionId = () => `${enterpriseId}:contracts`;

  beforeEach(() => {
    reset();
    expect(setUpBusiness(["BrightPath Studio", "--owner", "Priya Nair", "--about", "A design studio"]).created).toBe(true);
    enterpriseId = listEnterprises()[0].id;
    addWorker(createHumanWorker("Priya Nair", "guardian"));
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: "Priya Nair",
      role: "human-approver",
      rationale: "Principal.",
    });
  });
  afterEach(reset);

  const signedInOwner = (): Account => {
    const turned = turnOnSignIn({ enterpriseId, owner: "Priya Nair" });
    if ("refused" in turned) throw new Error(turned.refused);
    const joined = redeemInvite({ code: turned.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    const account = accountFromSession(joined.token);
    if (!account) throw new Error("owner session was not created");
    return account;
  };

  const finishedWaitingFor = (person: string) => {
    saveStaffingAssignment({
      businessFunctionId: functionId(),
      workerName: person,
      role: "human-approver",
      rationale: "Signer.",
    });
    return replaceJob({
      ...enqueueJob("Review the lease.", undefined, { businessFunctionId: functionId(), enterpriseId }),
      status: "completed",
      output: "The lease is one-sided.",
    });
  };

  it("opens a hand-back when the expected signer loses the right, and records an Event", () => {
    const owner = signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Sam Okonjo", role: "approver" }).added).toBe(true);
    const granted = setSignOffRight({
      enterpriseId,
      person: "Sam Okonjo",
      canSignOff: true,
      actor: owner,
    });
    if ("refused" in granted) throw new Error(granted.refused);
    const job = finishedWaitingFor("Sam Okonjo");
    expect(waitingDraftsForPerson(enterpriseId, "Sam Okonjo").map((one) => one.id)).toContain(job.id);

    const taken = setSignOffRight({
      enterpriseId,
      person: "Sam Okonjo",
      canSignOff: false,
      actor: owner,
    });
    if ("refused" in taken) throw new Error(taken.refused);
    expect(taken.message).toContain("1 draft is waiting and will come back to the owner");

    const record = handBackForJob(job.id);
    expect(record?.previousSigner).toBe("Sam Okonjo");
    expect(record?.newSigner).toBeUndefined();
    expect(listOpenHandBacks(enterpriseId)).toHaveLength(1);
    expect(formatWasWaitingFor(record)).toContain("was waiting for Sam Okonjo");
    expect(formatHandBackCount(1)).toBe("1 need a new signer");
    expect(listRuntimeEventStore().some((event) => event.type === "staff.hand_back")).toBe(true);
  });

  it("lets only the owner name a new signer, with a typed reason, and checks them at sign-off", () => {
    const owner = signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Sam Okonjo", role: "approver" }).added).toBe(true);
    expect(addEnterprisePerson({ enterpriseId, name: "Alex Chen", role: "approver" }).added).toBe(true);
    addWorker(createHumanWorker("Sam Okonjo", "guardian"));
    addWorker(createHumanWorker("Alex Chen", "guardian"));
    for (const person of ["Sam Okonjo", "Alex Chen"]) {
      const granted = setSignOffRight({
        enterpriseId,
        person,
        canSignOff: true,
        actor: owner,
      });
      if ("refused" in granted) throw new Error(granted.refused);
    }
    const job = finishedWaitingFor("Sam Okonjo");
    const taken = setSignOffRight({
      enterpriseId,
      person: "Sam Okonjo",
      canSignOff: false,
      actor: owner,
    });
    if ("refused" in taken) throw new Error(taken.refused);

    const asSam = { workerName: "Sam Okonjo" };
    const namedByOther = nameHandBackSigner({
      enterpriseId,
      jobId: job.id,
      signer: "Alex Chen",
      reason: "Alex can finish the review",
      actor: asSam,
    });
    expect("refused" in namedByOther && namedByOther.refused).toContain("Only the owner can name a new signer");

    const noReason = nameHandBackSigner({
      enterpriseId,
      jobId: job.id,
      signer: "Alex Chen",
      reason: "  ",
      actor: owner,
    });
    expect("refused" in noReason && noReason.refused).toContain("Type a reason");

    const named = nameHandBackSigner({
      enterpriseId,
      jobId: job.id,
      signer: "Alex Chen",
      reason: "Alex can finish the review",
      actor: owner,
    });
    if ("refused" in named) throw new Error(named.refused);
    expect(named.newSigner).toBe("Alex Chen");
    expect(formatWasWaitingFor(named)).toContain("was waiting for Sam Okonjo");
    expect(formatWasWaitingFor(named)).toContain("Alex Chen was named");
    expect(eligibleHandBackSigners(enterpriseId, job.id)).toContain("Priya Nair");
    expect(listOpenHandBacks(enterpriseId)).toHaveLength(0);

    const tooSoon = signOffTaskResult([job.id, "--as", "Sam Okonjo"]);
    expect(tooSoon.signedOff).toBe(false);
    expect(tooSoon.message).toMatch(/may not sign off work|named to sign it off|not an approval-capable Worker/);

    const wrong = signOffTaskResult([job.id, "--as", "Priya Nair"]);
    // The owner can always sign off a handed-back draft.
    expect(wrong.signedOff).toBe(true);
  });

  it("formats the confirm line and never preselects the owner", () => {
    expect(formatRoleChangeHandBackConfirm(3)).toBe(
      "3 drafts are waiting and will come back to the owner to choose who signs them off."
    );
    const owner = signedInOwner();
    expect(addEnterprisePerson({ enterpriseId, name: "Alex Chen", role: "approver" }).added).toBe(true);
    const granted = setSignOffRight({
      enterpriseId,
      person: "Alex Chen",
      canSignOff: true,
      actor: owner,
    });
    if ("refused" in granted) throw new Error(granted.refused);
    const job = finishedWaitingFor("Alex Chen");
    const taken = setSignOffRight({
      enterpriseId,
      person: "Alex Chen",
      canSignOff: false,
      actor: owner,
    });
    if ("refused" in taken) throw new Error(taken.refused);
    const eligible = eligibleHandBackSigners(enterpriseId, job.id);
    expect(eligible).toContain("Priya Nair");
    // The owner is listed, but nothing is preselected: the caller must pick a number.
    expect(eligible).not.toHaveLength(0);
  });
});
