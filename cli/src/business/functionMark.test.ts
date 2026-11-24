import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { accountFromSession, clearSignIn, redeemInvite, turnOnSignIn, type Account } from "../identity/companySignIn";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "./businessFunctionDefinitionStore";
import { clearStaffingAssignments, listStaffingAssignments, removeStaffingAssignmentsForFunction, saveStaffingAssignment } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import {
  clearFunctionMarks,
  effectiveFunctionMark,
  getFunctionMark,
  refuseAiStaffingOnFunction,
  refuseFunctionMark,
  setFunctionMark,
} from "./functionMark";
import { refuseWorkUnderLocks } from "../work/workLocks";
import { createWork } from "../work/workChanges";
import { clearPracticeSettings } from "../work/practiceSetting";
import { clearWork } from "../work/workStore";
import { createTask } from "../repl/taskRoutingCommands";
import { clearJobs } from "../runtime/jobQueue";

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
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("Function marks (setup-and-staff final v3)", () => {
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

  const signedInOwner = (): Account => {
    const outcome = turnOnSignIn({ enterpriseId, owner: "Amy Wise" });
    if ("refused" in outcome) throw new Error(outcome.refused);
    const joined = redeemInvite({ code: outcome.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    return accountFromSession(joined.token)!;
  };

  it("an unmarked Function means AI allowed, and a mark is never guessed from its name", () => {
    expect(effectiveFunctionMark(functionId)).toBeUndefined();
    expect(refuseFunctionMark(functionId)).toBeUndefined();
    expect(getFunctionMark(functionId).state).toBe("none");
    expect(refuseWorkUnderLocks({ functionId, when: "create" })).toBeUndefined();
  });

  it("a person can mark a Function locked or people only, and a missing name is refused so a model cannot set a mark", () => {
    expect(setFunctionMark({ functionId, mark: "locked", actor: undefined })).toMatchObject({ code: "function_mark_person_required" });
    expect(effectiveFunctionMark(functionId)).toBeUndefined();
    expect(setFunctionMark({ functionId, mark: "locked", actor: undefined, as: "Amy Wise" })).toEqual({ message: "Drafting is marked locked." });
    expect(effectiveFunctionMark(functionId)).toBe("locked");
    expect(refuseFunctionMark(functionId)).toBe("Drafting is a locked Function, so nothing on it goes to an AI worker.");
    expect(setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" })).toEqual({ message: "Drafting is marked people only." });
    expect(refuseFunctionMark(functionId)).toContain("people-only Function");
  });

  it("removing a locked or people-only mark, or changing people-only to AI allowed, stays refused, including for the owner", () => {
    setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" });
    const amy = signedInOwner();
    expect(setFunctionMark({ functionId, mark: "ai-allowed", reason: "Please.", actor: amy })).toMatchObject({
      code: "function_mark_loosen_not_available",
      refused: expect.stringContaining("not available at the terminal yet"),
    });
    expect(effectiveFunctionMark(functionId)).toBe("people-only");
    setFunctionMark({ functionId, mark: "locked", actor: undefined, as: "Amy Wise" });
    expect(setFunctionMark({ functionId, mark: "ai-allowed", reason: "Please.", actor: amy })).toMatchObject({ code: "function_mark_locked_to_ai_allowed" });
    expect(setFunctionMark({ functionId, mark: undefined, reason: "Please.", actor: undefined, as: "Amy Wise" })).toMatchObject({
      refused: expect.stringContaining("not available at the terminal yet"),
    });
    expect(effectiveFunctionMark(functionId)).toBe("locked");
  });

  it("an unverified mark fails closed as locked", () => {
    setFunctionMark({ functionId, mark: "ai-allowed", actor: undefined, as: "Amy Wise" });
    runtimeDb.prepare("UPDATE function_marks SET record_json = replace(record_json, '\"mark\":\"ai-allowed\"', '\"mark\":\"locked\"')").run();
    expect(getFunctionMark(functionId)).toMatchObject({ state: "unverified", mark: "locked" });
    expect(refuseFunctionMark(functionId)).toContain("locked Function");
  });

  it("a locked or people-only Function cannot be given an AI worker, and marks grant no abilities", () => {
    expect(listStaffingAssignments(functionId).some((row) => row.role === "ai")).toBe(true);
    setFunctionMark({ functionId, mark: "locked", actor: undefined, as: "Amy Wise" });
    expect(() => saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Another drafter", role: "ai", rationale: "A second AI worker." })).toThrow("an AI worker cannot be assigned");
    expect(listStaffingAssignments(functionId).map((row) => row.workerName)).not.toContain("Another drafter");
    expect(refuseAiStaffingOnFunction(functionId, "human-approver")).toBeUndefined();
  });

  it("the lock gate refuses work in a people-only Function even on an unlocked work type, and 'AI allowed' never unlocks a locked type", () => {
    const lease = createWork({ enterpriseId, actor: undefined, as: "Amy Wise", name: "Lease", kind: "matter", matterType: "property", matterNumber: "HL-1" });
    if (!("work" in lease)) throw new Error(JSON.stringify(lease));
    setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" });
    expect(refuseWorkUnderLocks({ workId: lease.work.id, enterpriseId, functionId, when: "create" })).toContain("people-only Function");
    removeStaffingAssignmentsForFunction(functionId);
    saveStaffingAssignment({ businessFunctionId: functionId, workerName: "Amy Wise", role: "human-approver", rationale: "Does the work and signs off." });
    expect(createTask(["Draft the lease.", "--function", functionId, "--enterprise", enterpriseId, "--asked-by", "Amy Wise", "--work", lease.work.id])).toMatchObject({
      created: false,
      message: expect.stringContaining("people-only Function"),
    });
    setFunctionMark({ functionId, mark: "locked", actor: undefined, as: "Amy Wise" });
    const will = createWork({ enterpriseId, actor: undefined, as: "Amy Wise", name: "A will", kind: "matter", matterType: "will", matterNumber: "W-1" });
    if (!("work" in will)) throw new Error(JSON.stringify(will));
    // Even if we could mark AI allowed, the locked type still wins. This route refuses that change.
    expect(setFunctionMark({ functionId, mark: "ai-allowed", actor: undefined, as: "Amy Wise" })).toHaveProperty("refused");
    expect(refuseWorkUnderLocks({ workId: will.work.id, enterpriseId, functionId, when: "create" })).toMatch(/locked Function|never goes to an AI worker/);
  });
});
