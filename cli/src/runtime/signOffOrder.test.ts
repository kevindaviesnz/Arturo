import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearBusinessFunctionDefinitions, saveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { signOffTaskResult } from "../task/taskSignOff";
import { clearJobs, enqueueJob, replaceJob, type Job } from "./jobQueue";
import { clearResultSignOffs, readResultSignOffStanding } from "./resultSignOff";
import { setAsideTaskResult } from "../task/taskSetAside";
import { BUILT_ON_UNSIGNED_NOTE, SIGN_OFF_ORDER_CODES, earlierResultsHoldingSignOff, refuseSignOffOrder } from "./signOffOrder";

const FUNCTION_ID = "e-1:drafting";
const AI = "Evidence status: UNVERIFIED MODEL SYNTHESIS\nExternal tools used: none\n\n";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearStaffingAssignments();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

describe("sign-off order (B10, G-A4)", () => {
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Kevin", "guardian"));
    runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run("Kevin", "e-1");
    saveBusinessFunctionDefinition(createBusinessFunctionDefinition({ id: FUNCTION_ID, enterpriseId: "e-1", label: "Drafting" }));
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "Kevin", role: "human-approver", rationale: "Owner." });
  });
  afterEach(reset);

  /** A finished result, built on `from` when given. */
  const step = (text: string, from?: Job, over: Partial<Job> = {}): Job =>
    replaceJob({
      ...enqueueJob(`Write: ${text}`, "Drafting AI worker", { businessFunctionId: FUNCTION_ID, enterpriseId: "e-1", ...(from ? { sourceTaskId: from.id } : {}) }),
      status: "completed",
      output: `${AI}${text}`,
      completedAt: Date.now(),
      ...over,
    });
  const signOff = (job: Job) => signOffTaskResult([job.id, "--as", "Kevin"]);

  it("refuses a result built on unsigned AI results, oldest first, before anything is written, then allows it in order", () => {
    const first = step("triage");
    const second = step("draft", first);
    const third = step("letter", second);

    expect(earlierResultsHoldingSignOff(third).map((one) => [one.taskId, one.state])).toEqual([[second.id, "not_signed_off"], [first.id, "not_signed_off"]]);
    const refused = signOff(third);
    expect(refused).toEqual({
      signedOff: false,
      code: "built_on_unsigned",
      message: `${third.id} can't be signed off yet. It was built on ${first.id} and ${second.id}, written by AI and not signed off yet. Read and sign off those first, in order. Nothing was recorded.`,
    });
    expect(readResultSignOffStanding(third).state).not.toBe("signed");

    expect(signOff(first).signedOff).toBe(true);
    expect(signOff(third)).toMatchObject({ signedOff: false, code: "built_on_unsigned", message: expect.stringContaining(`It was built on ${second.id}, written by AI`) });
    expect(signOff(second).signedOff).toBe(true);
    expect(refuseSignOffOrder(third)).toBeUndefined();
    expect(signOff(third).signedOff).toBe(true);
  });

  it("is not held up by a result that needs no sign-off", () => {
    const record = step("a person's notes", undefined, { output: "Notes typed by Kevin." });
    expect(refuseSignOffOrder(step("draft", record))).toBeUndefined();
  });

  it("refuses for good when an earlier result was set aside, failed or is still being written", () => {
    const first = step("triage");
    const second = step("draft", first);
    expect(setAsideTaskResult([first.id, "Wrong client.", "--as", "Kevin"]).setAside).toBe(true);
    expect(signOff(second)).toMatchObject({ signedOff: false, code: "built_on_set_aside", message: `${second.id} was built on ${first.id}, which was set aside, so it can't be signed off. Ask for the work again from a result you accept. Nothing was recorded.` });

    const failed = step("triage", undefined, { status: "failed", output: undefined });
    expect(signOff(step("draft", failed))).toMatchObject({ code: "built_on_unfinished" });
    const open = step("triage", undefined, { status: "running", output: undefined });
    expect(signOff(step("draft", open))).toMatchObject({ code: "built_on_unfinished" });
    expect(SIGN_OFF_ORDER_CODES).toEqual(["built_on_unsigned", "built_on_set_aside", "built_on_unfinished"]);
  });

  it("walks a looped chain once, and stops", () => {
    const first = step("one");
    const second = step("two", first);
    replaceJob({ ...first, sourceTaskId: second.id });
    expect(earlierResultsHoldingSignOff(second).map((one) => one.taskId)).toEqual([first.id]);
  });

  it("reports each earlier unsigned result until it is signed", () => {
    const first = step("triage");
    const second = step("draft", first);
    expect(earlierResultsHoldingSignOff(second)).toEqual([
      expect.objectContaining({ taskId: first.id, state: "not_signed_off" }),
    ]);
    expect(BUILT_ON_UNSIGNED_NOTE).toBe("This was built on an AI result you haven't signed off yet. Read that one first.");
    expect(earlierResultsHoldingSignOff(first)).toEqual([]);
    signOff(first);
    expect(earlierResultsHoldingSignOff(second)).toEqual([]);
  });
});
