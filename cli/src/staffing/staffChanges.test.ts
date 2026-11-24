import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearFunctionMarks, setFunctionMark } from "../business/functionMark";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn } from "../identity/companySignIn";
import { clearWorkers } from "../control/workers";
import { listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearStaffingAssignments, saveStaffingAssignment } from "./staffingStore";
import {
  recordStaffChangeEvent,
  refuseRemoveLastAiWorker,
  unassignWorkerIfAllowed,
} from "./staffChanges";

const reset = () => {
  clearWorkers();
  clearStaffingAssignments();
  clearBusinessFunctionDefinitions();
  clearFunctionMarks();
  clearSignIn();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("staffChanges", () => {
  let enterpriseId: string;
  let functionId: string;

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    enterpriseId = listEnterprises()[0]!.id;
    expect(addPersonFromPage({ enterpriseId, name: "Sam Paralegal", role: "worker", as: "Amy Wise" }).added).toBe(true);
    expect(setUpAreaFromPage({
      enterpriseId,
      name: "Research",
      purpose: "Research",
      helperName: "Draftbot",
      helperKind: "auto",
      archetype: "creator",
      approver: "Amy Wise",
      as: "Amy Wise",
    }).created).toBe(true);
    functionId = listBusinessFunctionDefinitions().find((one) => one.label === "Research")!.id;
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  it("refuses removing a Function's last AI worker unless the Function is people-only or locked", () => {
    // setUpAreaFromPage already assigned the AI worker.
    expect(refuseRemoveLastAiWorker(functionId, "Draftbot")).toContain("leave Research with no AI worker");
    expect(unassignWorkerIfAllowed("Draftbot")).toEqual(
      expect.objectContaining({ refused: expect.stringContaining("Nothing was changed.") })
    );

    expect(setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" })).toEqual(
      expect.objectContaining({ message: expect.stringContaining("people only") })
    );
    expect(refuseRemoveLastAiWorker(functionId, "Draftbot")).toBeUndefined();
    expect(unassignWorkerIfAllowed("Draftbot")).toEqual({ removed: expect.any(Number) });
  });

  it("records a staff change as an Event on the Timeline", () => {
    recordStaffChangeEvent({ what: "added Sam to the staff list", by: "Amy Wise" });
    const last = listRuntimeEventStore().at(-1);
    expect(last?.type).toBe("staff.changed");
    expect(last?.message).toBe("Amy Wise added Sam to the staff list");
  });
});
