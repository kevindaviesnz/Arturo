import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, setSignOffRight } from "../identity/companySignIn";
import { ENROLMENT_LINK_LIFE_MS, OFF_TERMINAL_LINK_LIFE_MS } from "../runtime/chainLimits";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { hashResult } from "../runtime/resultSignOff";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setAsideTaskResult } from "../task/taskSetAside";
import { signOffTaskResult } from "../task/taskSignOff";
import {
  LINK_ENDED_MESSAGE,
  clearOffTerminalLinks,
  issueOffTerminalLink,
  listOffTerminalLinkRecords,
  lookupOffTerminalLink,
} from "./offTerminalLinks";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import { requestOffTerminalPathOn } from "./offTerminalPath";
import { clearOffTerminalPath } from "./offTerminalPathState";
import { PUBLIC_BASE_URL_REFUSAL } from "./publicBaseUrl";
import { SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";


const FUNCTION_ID = "e-1:contracts";
const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const NOW = 1_700_000_000_000;

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearJobs();
  clearStaffingAssignments();
  clearWorkers();
  clearSignIn();
  clearEnterprises();
};

async function turnPathOn(enterpriseId: string): Promise<void> {
  setClaimOnceSenderForTests(async () => "accepted");
  const outcome = await requestOffTerminalPathOn({
    enterpriseId,
    reason: "Staff need to sign off when they are not at the computer.",
    notifyTo: "owner@example.com",
    actor: undefined,
    now: NOW - SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000,
  });
  if ("refused" in outcome) {
    throw new Error(outcome.refused);
  }
}

describe("off-terminal links", () => {
  beforeEach(reset);
  afterEach(reset);

  it("will not issue a link without https:// plus a hostname", () => {
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId: "ent-1",
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "abc",
      env: {},
    });
    expect(issued).toEqual({ refused: PUBLIC_BASE_URL_REFUSAL });
    expect(listOffTerminalLinkRecords()).toEqual([]);
  });

  it("stores only a hash, bound to one result, one person and the content hash", async () => {
    await turnPathOn("ent-1");
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId: "ent-1",
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "hash-1",
      now: NOW,
      env: ENV,
    });
    if ("refused" in issued) {
      throw new Error(issued.refused);
    }
    expect(issued.url).toBe(`https://signoff.example.com/sign-off/${issued.token}`);
    expect(issued.link.expiresAt).toBe(NOW + OFF_TERMINAL_LINK_LIFE_MS);
    expect(issued.link.person).toBe("Priya Nair");
    expect(issued.link.jobId).toBe("task-1");
    expect(issued.link.resultSha256).toBe("hash-1");

    const stored = listOffTerminalLinkRecords();
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain(issued.token);
    expect(stored[0]?.tokenSha256).toHaveLength(64);

    expect(lookupOffTerminalLink(issued.token, { now: NOW })).toMatchObject({
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "hash-1",
    });
    expect(lookupOffTerminalLink("not-a-real-token", { now: NOW })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
    expect(lookupOffTerminalLink(issued.token, { now: issued.link.expiresAt })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
    expect(
      lookupOffTerminalLink(issued.token, { now: NOW, resultSha256: "hash-changed" })
    ).toEqual({ refused: LINK_ENDED_MESSAGE });
  });

  it("lets an owner shorten the sign-off link life, but never lengthen it, and keeps enrolment to 30 minutes", async () => {
    await turnPathOn("ent-1");
    const shortened = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId: "ent-1",
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "hash-1",
      lifeMs: 60 * 60 * 1000,
      now: NOW,
      env: ENV,
    });
    if ("refused" in shortened) {
      throw new Error(shortened.refused);
    }
    expect(shortened.link.expiresAt).toBe(NOW + 60 * 60 * 1000);

    const lengthened = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId: "ent-1",
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "hash-1",
      lifeMs: OFF_TERMINAL_LINK_LIFE_MS + 1,
      now: NOW,
      env: ENV,
    });
    if ("refused" in lengthened) {
      throw new Error(lengthened.refused);
    }
    expect(lengthened.link.expiresAt).toBe(NOW + OFF_TERMINAL_LINK_LIFE_MS);

    const enrolment = issueOffTerminalLink({
      kind: "enrolment",
      enterpriseId: "ent-1",
      person: "Priya Nair",
      now: NOW,
      env: ENV,
    });
    if ("refused" in enrolment) {
      throw new Error(enrolment.refused);
    }
    expect(enrolment.url).toBe(`https://signoff.example.com/pair/${enrolment.token}`);
    expect(enrolment.link.expiresAt).toBe(NOW + ENROLMENT_LINK_LIFE_MS);
  });
});

describe("off-terminal links are revoked on sign-off, set-aside, a role change or a result change", () => {
  let enterpriseId: string;

  beforeEach(async () => {
    reset();
    expect(
      setUpBusiness(["Harbour Legal", "--owner", "Kevin Brown", "--about", "Commercial contracts."]).created
    ).toBe(true);
    enterpriseId = listEnterprises()[0]?.id ?? "";
    addEnterprisePerson({ enterpriseId, name: "Priya Nair", role: "approver" });
    const granted = setSignOffRight({
      enterpriseId,
      person: "Priya Nair",
      canSignOff: true,
      actor: undefined,
    });
    if ("refused" in granted) {
      throw new Error(granted.refused);
    }
    saveStaffingAssignment({
      businessFunctionId: FUNCTION_ID,
      workerName: "Priya Nair",
      role: "human-approver",
      rationale: "Principal.",
    });
    await turnPathOn(enterpriseId);
  });
  afterEach(reset);

  const finished = (output = "The lease is one-sided.") =>
    replaceJob({
      ...enqueueJob("Review the lease.", undefined, {
        businessFunctionId: FUNCTION_ID,
        enterpriseId,
      }),
      status: "completed",
      output,
    });

  const issueFor = (job: { id: string; output?: string }) => {
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId,
      person: "Priya Nair",
      jobId: job.id,
      resultSha256: hashResult(job.output ?? ""),
      now: NOW,
      env: ENV,
    });
    if ("refused" in issued) {
      throw new Error(issued.refused);
    }
    return issued;
  };

  it("revokes the link when the result is signed off", () => {
    const job = finished();
    const issued = issueFor(job);
    const outcome = signOffTaskResult([job.id, "--as", "Priya Nair"]);
    expect(outcome.signedOff).toBe(true);
    expect(lookupOffTerminalLink(issued.token, { now: NOW })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });

  it("revokes the link when the result is set aside", () => {
    const job = finished();
    const issued = issueFor(job);
    const outcome = setAsideTaskResult([job.id, "The facts are incomplete.", "--as", "Priya Nair"]);
    expect(outcome.setAside).toBe(true);
    expect(lookupOffTerminalLink(issued.token, { now: NOW })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });

  it("revokes the person's links when the sign-off right is taken away", () => {
    const job = finished();
    const issued = issueFor(job);
    const taken = setSignOffRight({
      enterpriseId,
      person: "Priya Nair",
      canSignOff: false,
      actor: undefined,
    });
    expect(taken).toMatchObject({ message: expect.stringContaining("can no longer sign off") });
    expect(lookupOffTerminalLink(issued.token, { now: NOW })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });

  it("revokes the link when the result changes", () => {
    const job = finished();
    const issued = issueFor(job);
    replaceJob({ ...job, output: "The lease was revised." });
    expect(lookupOffTerminalLink(issued.token, { now: NOW })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });
});
