import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearFunctionMarks, setFunctionMark } from "../business/functionMark";
import { clearWorkers, listWorkers } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise, listEnterprises } from "../enterprise/enterpriseStore";
import { listPeople, maySignOff } from "../identity/companySignIn";
import { listEnterpriseMemberships } from "../identity/organisationIdentity";
import { clearStaffingAssignments, listStaffingAssignments } from "../staffing/staffingStore";
import { refuseStaffNotReady } from "../business/staffCheck";
import { clearCommandMenu } from "../ui/uiCommandHandlers";
import { firstMissingSetupStep } from "./setupProgress";
import { clearSetupFlow } from "./setupFlow";
import { clearStaffStep, formatStaffList, replyToStaffStep, startStaffStep } from "./setupStaff";

const realIsTTY = process.stdin.isTTY;

function flat(entries: readonly { body: string }[]): string {
  return entries.map((entry) => entry.body).join(" ").replace(/\s+/g, " ");
}

const reset = () => {
  clearCommandMenu();
  clearSetupFlow();
  clearStaffStep();
  clearStaffingAssignments();
  clearFunctionMarks();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
};

describe("the /setup staff step", () => {
  let enterpriseId: string;
  let functionId: string;

  beforeEach(() => {
    reset();
    process.stdin.isTTY = true;
    const enterprise = createAndSaveEnterprise({ name: "Harbour Legal", mission: "Advise local businesses." });
    enterpriseId = enterprise.id;
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:drafting`,
      enterpriseId: enterprise.id,
      label: "Drafting",
      objective: "Draft agreements.",
    });
    functionId = definition.id;
  });
  afterEach(() => {
    process.stdin.isTTY = realIsTTY;
    reset();
  });

  it("opens by asking whether it is just you, and does not accept a bare yes", () => {
    const start = startStaffStep(enterpriseId);
    expect(start[0]!.label).toBe("Step 3 of 4");
    expect(flat(start)).toContain("Just me");
    expect(flat(start)).toContain("Me and others");
    const refused = replyToStaffStep("yes");
    if ("back" in refused) throw new Error("should not go back");
    expect(flat(refused)).toContain("bare yes is not accepted");
    expect(listPeople(enterpriseId)).toHaveLength(0);
  });

  it("Just me sets the sign-off right through the same grant, creates the account, and shows it on the staff list", () => {
    startStaffStep(enterpriseId);
    const nameAsk = replyToStaffStep("1");
    if ("back" in nameAsk) throw new Error("should not go back");
    expect(flat(nameAsk)).toContain("What should Arturo call you?");
    const confirm = replyToStaffStep("Amy Wise");
    if ("back" in confirm) throw new Error("should not go back");
    expect(flat(confirm)).toContain("no second check");
    expect(flat(confirm)).toContain("sign off work and give go-aheads");
    expect(flat(confirm)).toContain("1 Continue as Amy Wise");
    expect(listPeople(enterpriseId)).toHaveLength(0);

    const after = replyToStaffStep("1");
    if ("back" in after) throw new Error("should not go back");
    expect(maySignOff(enterpriseId, "Amy Wise")).toBe(true);
    const amy = listPeople(enterpriseId).find((person) => person.name === "Amy Wise");
    expect(amy?.canSignOff).toBe(true);
    expect(listEnterpriseMemberships(enterpriseId).length).toBeGreaterThan(0);
    expect(formatStaffList(enterpriseId)).toContain("can sign off work and give go-aheads");
    expect(flat(after)).toContain("Drafting needs an AI worker");
    expect(flat(after)).toContain('Add "Drafting drafter"');
  });

  it("will not finish staff until each AI-allowed Function has an AI worker, then shows a summary that never says Staff complete", () => {
    startStaffStep(enterpriseId);
    replyToStaffStep("1");
    replyToStaffStep("Amy Wise");
    const ai = replyToStaffStep("1");
    if ("back" in ai) throw new Error("should not go back");
    expect(refuseStaffNotReady(enterpriseId)).toContain("needs an AI worker");
    const drafts = replyToStaffStep("1");
    if ("back" in drafts) throw new Error("should not go back");
    expect(flat(drafts)).toContain("drafts for");
    const done = replyToStaffStep("2");
    if ("back" in done) throw new Error("should not go back");
    expect(listStaffingAssignments(functionId).some((row) => row.workerName === "Drafting drafter" && row.role === "ai")).toBe(true);
    expect(listWorkers().some((worker) => worker.name === "Drafting drafter" && worker.kind === "ai")).toBe(true);
    expect(refuseStaffNotReady(enterpriseId)).toBeUndefined();
    expect(firstMissingSetupStep(enterpriseId)).toBeUndefined();
    expect(flat(done)).toContain("Staff are in place");
    expect(flat(done)).not.toContain("Staff complete");
    expect(flat(done)).toContain("can sign off work and give go-aheads");
  });

  it("counts a people-only Function as staffed with a signer and no AI worker, and will not add one", () => {
    const marked = setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" });
    if ("refused" in marked) throw new Error(marked.refused);
    startStaffStep(enterpriseId, "Amy Wise");
    const confirm = replyToStaffStep("1");
    if ("back" in confirm) throw new Error("should not go back");
    const done = replyToStaffStep("1");
    if ("back" in done) throw new Error("should not go back");
    expect(refuseStaffNotReady(enterpriseId)).toBeUndefined();
    expect(listStaffingAssignments(functionId).some((row) => row.role === "ai")).toBe(false);
    expect(flat(done)).toContain("people only");
    expect(flat(done)).toContain("No AI");
    expect(flat(done)).toContain("no way to add an AI worker");
  });

  it("refuses Just me in bot mode, and names a signer who is already in place", () => {
    process.stdin.isTTY = false;
    const start = startStaffStep(enterpriseId);
    expect(flat(start)).toContain("refuses \"Just me\"");
    expect(listPeople(enterpriseId)).toHaveLength(0);

    process.stdin.isTTY = true;
    startStaffStep(enterpriseId, "Amy Wise");
    replyToStaffStep("1"); // Just me
    replyToStaffStep("1"); // Continue as Amy Wise
    process.stdin.isTTY = false;
    const named = startStaffStep(enterpriseId);
    expect(flat(named)).toContain("The signer is already Amy Wise");
  });
});
