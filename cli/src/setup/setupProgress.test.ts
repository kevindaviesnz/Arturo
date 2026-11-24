import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAndSaveBusinessFunctionDefinition, clearBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { setSignOffRight } from "../identity/companySignIn";
import { firstMissingSetupStep, missionIsMissing } from "./setupProgress";
import { registerAiWorker } from "../control/workers";

const reset = () => {
  clearStaffingAssignments();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
};

describe("firstMissingSetupStep", () => {
  beforeEach(reset);
  afterEach(reset);

  it("resumes at step 1 when the mission is empty, and does not re-ask when it is saved", () => {
    const empty = createAndSaveEnterprise({ name: "Harbour Legal", mission: "" });
    expect(missionIsMissing(empty)).toBe(true);
    expect(firstMissingSetupStep(empty.id)).toBe(1);
    const named = createAndSaveEnterprise({ name: "Kauri Clinic", mission: "Care for local families." });
    expect(firstMissingSetupStep(named.id)).toBe(2);
  });

  it("resumes at step 2 when there is a mission but no Functions, and at step 3 once a Function exists but staff are not in place", () => {
    const enterprise = createAndSaveEnterprise({ name: "Harbour Legal", mission: "Advise local businesses." });
    expect(firstMissingSetupStep(enterprise.id)).toBe(2);
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:drafting`,
      enterpriseId: enterprise.id,
      label: "Drafting",
      objective: "Draft agreements.",
    });
    expect(firstMissingSetupStep(enterprise.id)).toBe(3);
    addWorker(createHumanWorker("Amy Wise", "guardian"));
    assignWorkerOwnership({ workerName: "Amy Wise", enterpriseId: enterprise.id });
    setSignOffRight({ enterpriseId: enterprise.id, person: "Amy Wise", canSignOff: true, actor: undefined });
    registerAiWorker("Drafting AI worker", "creator");
    saveStaffingAssignment({ businessFunctionId: definition.id, workerName: "Drafting AI worker", role: "ai", rationale: "Staffed for this test." });
    expect(firstMissingSetupStep(enterprise.id)).toBeUndefined();
  });
});
