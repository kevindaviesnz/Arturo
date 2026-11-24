import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { queueWorkflowExecution } from "../agents/queueWorkflowExecution";
import { clearWorkers, registerAiWorker } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn } from "../identity/companySignIn";
import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
  listBusinessFunctionDefinitions,
} from "./businessFunctionDefinitionStore";
import { clearFunctionMarks, setFunctionMark } from "./functionMark";
import { refuseStaffNotReady } from "./staffCheck";
import { clearStaffingAssignments, listStaffingAssignments, removeStaffingAssignmentsForFunction, saveStaffingAssignment } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { createTask } from "../repl/taskRoutingCommands";
import { addEventScheduleFromArgs } from "../repl/scheduleCommands";
import { clearEventSchedules } from "../scheduling/eventScheduleStore";
import { clearJobs, enqueueScheduledJob, listJobs } from "../runtime/jobQueue";
import { clearWorkflowRuns, listWorkflowRuns } from "../runtime/workflowRunStore";
import { clearPracticeSettings } from "../work/practiceSetting";
import { clearWork } from "../work/workStore";

const reset = () => {
  clearJobs();
  clearWorkers();
  clearStaffingAssignments();
  clearBusinessFunctionDefinitions();
  clearFunctionMarks();
  clearSignIn();
  clearEnterprises();
  clearClients();
  clearWork();
  clearPracticeSettings();
  clearEventSchedules();
  clearWorkflowRuns();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("the staff check inside createTask", () => {
  let enterpriseId: string;
  let functionId: string;

  const setUp = () => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    enterpriseId = listEnterprises()[0]!.id;
    expect(addPersonFromPage({ enterpriseId, name: "Sam Paralegal", role: "worker", as: "Amy Wise" }).added).toBe(true);
    expect(setUpAreaFromPage({ enterpriseId, name: "Drafting", purpose: "Drafting", helperName: "Drafting AI worker", helperKind: "auto", archetype: "creator", approver: "Amy Wise", as: "Amy Wise" }).created).toBe(true);
    functionId = listBusinessFunctionDefinitions().find((one) => one.label === "Drafting")!.id;
  };

  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const task = () => createTask(["Draft a letter.", "--function", functionId, "--enterprise", enterpriseId, "--asked-by", "Amy Wise"]);

  it("lets a Task start when every Function is staffed, including a business made with the old /setup", () => {
    expect(refuseStaffNotReady(enterpriseId)).toBeUndefined();
    expect(task()).toMatchObject({ created: true });
  });

  it("refuses before any write when an unmarked Function has no AI worker, and names the missing step", () => {
    removeStaffingAssignmentsForFunction(functionId);
    saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Amy Wise", role: "human-approver", rationale: "Signs off." });
    const before = listJobs().length;
    const outcome = task();
    expect(outcome.created).toBe(false);
    expect(outcome.message).toContain("Drafting needs an AI worker.");
    expect(outcome.message).toContain("Nothing was created and no AI was asked.");
    expect(listJobs().length).toBe(before);
  });

  it("refuses at the business, not just the Function named, when another Function is unstaffed", () => {
    const extra = createAndSaveBusinessFunctionDefinition({
      id: `${enterpriseId}:accounts`,
      enterpriseId,
      label: "Accounts",
      objective: "Accounts",
    });
    expect(refuseStaffNotReady(enterpriseId)).toContain("Accounts needs an AI worker.");
    expect(task()).toMatchObject({
      created: false,
      message: expect.stringContaining("Nothing was created and no AI was asked."),
    });
    expect(extra.label).toBe("Accounts");
  });

  it("a locked Function is staffed only with a signer and no AI worker", () => {
    setFunctionMark({ functionId, mark: "locked", actor: undefined, as: "Amy Wise" });
    expect(listStaffingAssignments(functionId).some((row) => row.role === "ai")).toBe(true);
    expect(refuseStaffNotReady(enterpriseId)).toContain("Drafting is locked, so it cannot have an AI worker.");
    expect(task().created).toBe(false);
    removeStaffingAssignmentsForFunction(functionId);
    saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Amy Wise", role: "human-approver", rationale: "Does the work and signs off." });
    expect(refuseStaffNotReady(enterpriseId)).toBeUndefined();
    // Staff are in place, but the lock gate still refuses an AI Task on a locked Function.
    expect(task()).toMatchObject({ created: false, message: expect.stringContaining("locked Function") });
  });
});

describe("named start paths use the same staff and lock gates before any write", () => {
  let enterpriseId: string;
  let functionId: string;

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    enterpriseId = listEnterprises()[0]!.id;
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterpriseId}:loose`,
      enterpriseId,
      label: "Loose",
      objective: "Unstaffed",
    });
    functionId = definition.id;
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const scheduleArgs = () => [
    "add", "Draft the office notes.", "--every", "daily", "--at", "06:00",
    "--timezone", "Pacific/Auckland", "--function", "Loose", "--enterprise", enterpriseId,
  ] as const;

  const plan = () => ({
    objective: "Draft the office notes.",
    steps: [{ archetype: "creator" as const, workerName: "Drafting AI worker", instruction: "Draft the office notes." }],
  });

  it("/schedule add refuses before any write when staff are not in place", () => {
    expect(refuseStaffNotReady(enterpriseId)).toBeTruthy();
    const before = listJobs().length;
    expect(() => addEventScheduleFromArgs(scheduleArgs())).toThrow(
      "Loose needs an AI worker. Nothing was created and no AI was asked."
    );
    expect(listJobs().length).toBe(before);
  });

  it("/schedule add writes a schedule once staff are in place", () => {
    registerAiWorker("Loose AI worker", "creator");
    saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Loose AI worker", role: "ai", rationale: "For this test." });
    expect(refuseStaffNotReady(enterpriseId)).toBeUndefined();
    const schedule = addEventScheduleFromArgs(scheduleArgs());
    expect(schedule.taskId).toBeTruthy();
    expect(listJobs()).toHaveLength(1);
  });

  it("queueWorkflowExecution refuses before any write when staff are not in place", () => {
    expect(refuseStaffNotReady(enterpriseId)).toBeTruthy();
    const before = listJobs().length;
    expect(() => queueWorkflowExecution(plan(), [], enterpriseId)).toThrow(
      "Loose needs an AI worker. Nothing was created and no AI was asked."
    );
    expect(listJobs().length).toBe(before);
    expect(listWorkflowRuns()).toHaveLength(0);
  });

  it("queueWorkflowExecution queues the first step once staff are in place", () => {
    registerAiWorker("Loose AI worker", "creator");
    saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Loose AI worker", role: "ai", rationale: "For this test." });
    const result = queueWorkflowExecution(plan(), [], enterpriseId);
    expect(result.jobIds).toHaveLength(1);
    expect(listJobs()).toHaveLength(1);
  });

  it("enqueueScheduledJob, the write primitive, still writes even when staff are not in place (listed for a later step)", () => {
    expect(refuseStaffNotReady(enterpriseId)).toBeTruthy();
    const before = listJobs().length;
    const job = enqueueScheduledJob("Draft the office notes.", { enterpriseId });
    expect(job.status).toBe("scheduled");
    expect(listJobs().length).toBe(before + 1);
  });
});
