import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  approverNamesForJob,
  clearCommandMenu,
  handleCommandMenuReply,
  isCommandMenuActive,
  startDecisionMenu,
} from "./uiCommandHandlers";

import { clearJobs, enqueueJob, replaceJob, type Job } from "../runtime/jobQueue";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import {
  createApprovalChain,
  clearApprovalChains,
  storeApprovalChain,
} from "../runtime/approvalChainStore";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";

/**
 * Deciding, without switches.
 *
 * `/approve` was the last command in the product that could only be driven with
 * flags: the operator had to know the Task id, and had to know to add
 * `--as "<name>"` the moment a second person could approve — a thing they only
 * discovered when the command refused them. It is also the command the product's
 * central claim rests on, which makes it the worst one to leave uncomfortable.
 *
 * The menu offers only what the command would accept, because a list that
 * includes a name `refuseUndesignatedApprover` then rejects is worse than no
 * list at all.
 */

function waitingJob(instruction: string): Job {
  const queued = enqueueJob(instruction, "Analyst", {
    requiredCapabilities: ["analysis"],
  });
  const job = replaceJob({ ...queued, status: "awaiting_approval" });
  storeApprovalChain(createApprovalChain(job.id, 1));
  return job;
}

describe("deciding through the guided flow", () => {
  beforeEach(() => {
    clearJobs();
    clearWorkers();
    clearApprovalChains();
    clearStaffingAssignments();
    clearCommandMenu();
  });
  afterEach(() => {
    clearJobs();
    clearWorkers();
    clearApprovalChains();
    clearStaffingAssignments();
    clearCommandMenu();
  });

  it("refuses up front when nothing is waiting", () => {
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));

    const entries = startDecisionMenu("approve");

    expect(entries[0].label).toBe("Nothing is waiting for a decision");
    // Nothing was asked, so nothing is left half-open.
    expect(isCommandMenuActive()).toBe(false);
  });

  it("refuses up front when nobody registered may decide", () => {
    // Choosing a Task and only then being told nobody can decide it wastes the
    // operator's time on a dead end.
    waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Technical Lead", "creator", undefined, "available"));

    const entries = startDecisionMenu("approve");

    expect(entries[0].label).toBe("No one on record can decide this");
    expect(entries[0].body).toContain("/add-human-worker");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("approves the only waiting Task as the only approver, asking nothing", () => {
    const job = waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));

    const entries = startDecisionMenu("approve");

    expect(entries[0].body).toContain("Priya Raman");
    expect(entries[0].body).toContain(job.id);
    expect(isCommandMenuActive()).toBe(false);
  });

  it("lists the waiting Tasks with what they would do", async () => {
    waitingJob("Analyse the client brief and list what is missing");
    waitingJob("Analyse the returned structural review comments");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));

    const entries = startDecisionMenu("approve");

    expect(entries[0].label).toBe("Which one are you approving?");
    // The id alone is not enough to decide on: the instruction is the decision.
    expect(entries[0].body).toContain("Analyse the client brief");
    expect(entries[0].body).toContain("task-");
    expect(entries[0].body).not.toContain("--");

    const decided = await handleCommandMenuReply("1");
    expect(decided?.[0].body).toContain("Priya Raman");
  });

  it("asks who is deciding only when more than one person could", async () => {
    waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));
    addWorker(createHumanWorker("Sam Okonjo", "reviewer", undefined, "available"));

    const entries = startDecisionMenu("approve");

    expect(entries[0].label).toBe("Who is deciding?");
    expect(entries[0].body).toContain("Priya Raman");
    expect(entries[0].body).toContain("Sam Okonjo");

    const decided = await handleCommandMenuReply("2");
    expect(decided?.[0].body).toContain("Sam Okonjo");
  });

  it("offers only the person the staffing plan made accountable", () => {
    // refuseUndesignatedApprover would turn the other one away, so offering
    // them would be offering a refusal.
    const job = waitingJob("Analyse the brief");
    replaceJob({ ...job, businessFunctionId: "fn-1" });
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));
    addWorker(createHumanWorker("Sam Okonjo", "guardian", undefined, "available"));
    saveStaffingAssignment({
      businessFunctionId: "fn-1",
      workerName: "Priya Raman",
      role: "human-approver",
      rationale: "Accountable for this Function.",
    });

    expect(approverNamesForJob(job.id)).toEqual(["Priya Raman"]);

    const entries = startDecisionMenu("approve");
    // One candidate, so it decides without asking who.
    expect(entries[0].label).not.toBe("Who is deciding?");
  });

  it("takes every approval-capable person when no designation is recorded", () => {
    // mayDecideForFunction is open before a plan is applied, so the menu is too.
    const job = waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));
    addWorker(createHumanWorker("Sam Okonjo", "reviewer", undefined, "available"));
    addWorker(createHumanWorker("Technical Lead", "creator", undefined, "available"));

    expect(approverNamesForJob(job.id)).toEqual(["Priya Raman", "Sam Okonjo"]);
  });

  it("insists on a reason before turning something down", async () => {
    waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));

    const entries = startDecisionMenu("reject");
    expect(entries[0].label).toBe("Why are you turning it down?");

    // Blank re-asks rather than recording an empty reason.
    const blank = await handleCommandMenuReply("   ");
    expect(blank?.[0].label).toBe("Why are you turning it down?");
    expect(isCommandMenuActive()).toBe(true);

    const rejected = await handleCommandMenuReply("The span is still unstated.");
    expect(rejected?.[0].label).toContain("Rejection");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("never shows a switch to the operator", () => {
    waitingJob("Analyse the brief");
    addWorker(createHumanWorker("Priya Raman", "guardian", undefined, "available"));
    addWorker(createHumanWorker("Sam Okonjo", "guardian", undefined, "available"));

    for (const entry of startDecisionMenu("approve")) {
      expect(entry.body).not.toContain("--");
    }
  });
});
