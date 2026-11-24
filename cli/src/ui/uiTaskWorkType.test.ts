import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { clearWorkers, registerAiWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { addWorker, createHumanWorker } from "../control/workers";
import { setSignOffRight } from "../identity/companySignIn";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { clearWork } from "../work/workStore";
import { handleCommandMenuReply, handleUiCommand, clearCommandMenu } from "./uiCommandHandlers";
import { resetTaskWorkType } from "./uiTaskWorkType";

const realIsTTY = process.stdin.isTTY;

function flat(entries: readonly { body: string }[] | undefined): string {
  return (entries ?? []).map((entry) => entry.body).join(" ").replace(/\s+/g, " ");
}

const reset = () => {
  clearCommandMenu();
  resetTaskWorkType();
  clearJobs();
  clearStaffingAssignments();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  clearWork();
  clearEnterprises();
};

describe("Start a task: work type then go-ahead", () => {
  beforeEach(() => {
    reset();
    process.stdin.isTTY = true;
    const enterprise = createAndSaveEnterprise({ name: "Harbour Legal", mission: "Advise local businesses." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:drafting`,
      enterpriseId: enterprise.id,
      label: "Drafting",
      objective: "Draft agreements.",
    });
    addWorker(createHumanWorker("Amy Wise", "guardian"));
    assignWorkerOwnership({ workerName: "Amy Wise", enterpriseId: enterprise.id });
    setSignOffRight({ enterpriseId: enterprise.id, person: "Amy Wise", canSignOff: true, actor: undefined });
    registerAiWorker("Drafting drafter", "creator");
    saveStaffingAssignment({ businessFunctionId: definition.id, workerName: "Drafting drafter", role: "ai", rationale: "Staffed." });
  });
  afterEach(() => {
    process.stdin.isTTY = realIsTTY;
    reset();
  });

  it("asks for the work type after the description, with no default, and repeats it at the go-ahead", async () => {
    await handleUiCommand("/task", []);
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Draft a supplier letter.");
    const typeAsk = await handleCommandMenuReply("1"); // no extra evidence
    expect(flat(typeAsk)).toContain("What kind of work is this?");
    expect(listJobs()).toHaveLength(0);

    const empty = await handleCommandMenuReply("");
    expect(flat(empty)).toContain("What kind of work is this?");
    expect(listJobs()).toHaveLength(0);

    const go = await handleCommandMenuReply("1"); // first visible unlocked type
    expect(flat(go)).toContain("Work type:");
    expect(flat(go)).toContain("Picked by Amy Wise.");
    expect(flat(go)).toContain("first Task");
    expect(listJobs()).toHaveLength(0);

    const done = await handleCommandMenuReply("1");
    expect(listJobs()).toHaveLength(1);
    expect(listJobs()[0]!.task).toContain("supplier letter");
  });

  it("offers to give a locked type to a person, and does not start AI work from Enter alone", async () => {
    await handleUiCommand("/task", []);
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Draft a will.");
    const menu = await handleCommandMenuReply("1"); // no extra evidence
    expect(flat(menu)).toContain('Locked because it mentions "will"');
    expect(listJobs()).toHaveLength(0);
  });
});
