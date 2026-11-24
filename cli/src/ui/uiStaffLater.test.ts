import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { setFunctionMark, clearFunctionMarks } from "../business/functionMark";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn } from "../identity/companySignIn";
import { clearWorkers, listWorkers } from "../control/workers";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearLaterStaff, formatSignerPick, isLaterStaffActive, replyToLaterStaff, startLaterStaffMenu } from "./uiStaffLater";

const flat = (entries: readonly { body?: string }[]) =>
  entries.map((entry) => entry.body ?? "").join("\n").replace(/\s+/g, " ");

const reset = () => {
  clearLaterStaff();
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

describe("later staff menu", () => {
  let enterpriseId: string;
  let functionId: string;

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
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

  it("shows a staff menu the owner can add, change, remove or show staff from", async () => {
    const opened = startLaterStaffMenu({ enterpriseId, as: "Amy Wise" });
    expect(isLaterStaffActive()).toBe(true);
    expect(flat(opened)).toContain("Show staff");
    expect(flat(opened)).toContain("Add a person");
    expect(flat(opened)).toContain("Add an AI worker");
    expect(flat(opened)).toContain("Have AI workers suggested");
    expect(flat(opened)).toContain("Name a new signer");

    const shown = await replyToLaterStaff("1");
    expect(flat(shown)).toContain("Amy Wise");
    expect(flat(shown)).toContain("sign off work and give go-aheads");
  });

  it("refuses an AI worker for a locked or people-only Function and says why", async () => {
    expect(setFunctionMark({ functionId, mark: "people-only", actor: undefined, as: "Amy Wise" })).toEqual(
      expect.objectContaining({ message: expect.stringContaining("people only") })
    );
    startLaterStaffMenu({ enterpriseId, as: "Amy Wise" });
    await replyToLaterStaff("3");
    const refused = await replyToLaterStaff("1");
    expect(flat(refused)).toContain("people only");
    expect(flat(refused)).toContain("cannot have an AI worker");
  });

  it("lists eligible signers and never preselects the owner", () => {
    const body = formatSignerPick(["Alex Chen", "Priya Nair"], "task-1", "Sam Okonjo");
    expect(body).toContain("Nothing is preselected");
    expect(body).toContain("was waiting for Sam Okonjo");
    expect(body.indexOf("1  Alex Chen")).toBeGreaterThan(-1);
    expect(body).toContain("Priya Nair");
    expect(body).not.toMatch(/Priya Nair.*preselected|preselected.*Priya Nair/);
  });
});
