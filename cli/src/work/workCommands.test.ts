import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearFunctionOrigins } from "../business/functionOrigin";
import { addClient, setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn } from "../identity/companySignIn";
import { createTask } from "../repl/taskRoutingCommands";
import { clearHandOffs } from "../runtime/handOff";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearPassOns } from "../runtime/passOnRules";
import { clearResultSetAsides } from "../runtime/resultSetAside";
import { clearResultSignOffs } from "../runtime/resultSignOff";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { clearPolicyRules } from "../storage/policyRepository";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearPracticeSettings, saveSignedPracticeSetting } from "./practiceSetting";
import { createWork, type CreateWorkInput } from "./workChanges";
import type { WorkRecord } from "./workRecord";
import { clearWork } from "./workStore";
import { clearWorkSends } from "./workSendLog";
import { OWNER_CHANGE_ON_PAGE } from "../identity/companySignIn";
import { getJob } from "../runtime/jobQueue";
import { getWork } from "./workStore";
import { handleWorkCommand } from "./workCommands";

const reset = () => {
  clearJobs(); clearResultSignOffs(); clearResultSetAsides(); clearClients(); clearWorkers(); clearStaffingAssignments(); clearBusinessFunctions();
  clearBusinessFunctionDefinitions(); clearPolicyRules(); clearHandOffs(); clearFunctionOrigins(); clearPassOns(); clearSignIn(); clearEnterprises();
  clearWork(); clearPracticeSettings(); clearWorkSends();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

/** Rows in every table, so a refusal can be shown to have written nothing. */
const rowCounts = (): Record<string, number> => Object.fromEntries(
  (runtimeDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map(({ name }) => [name, (runtimeDb.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number }).n]),
);

let enterpriseId: string;
let otherId: string;
let clientId: string;
let otherClientId: string;
let functionId: string;

const setUp = () => {
  reset();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
  setUpBusiness(["Elsewhere Ltd", "--owner", "Zed Other", "--about", "Something else"]);
  [enterpriseId, otherId] = listEnterprises().map((enterprise) => enterprise.id);
  expect(addPersonFromPage({ enterpriseId, name: "Sam Paralegal", role: "worker", as: "Amy Wise" }).added).toBe(true);
  expect(setUpAreaFromPage({ enterpriseId, name: "Drafting", purpose: "Drafting", helperName: "Drafting AI worker", helperKind: "auto", archetype: "creator", approver: "Amy Wise", as: "Amy Wise" }).created).toBe(true);
  functionId = listBusinessFunctionDefinitions().find((one) => one.label === "Drafting")!.id;
  clientId = addClient(["Jane Smithers", "--enterprise", enterpriseId]).clientId!;
  otherClientId = addClient(["Rawiri Takerei", "--enterprise", enterpriseId]).clientId!;
};

/** Makes a business a law practice, signed, as the owner would on the page. */
const lawPractice = (id = enterpriseId, on = true) =>
  saveSignedPracticeSetting({ enterpriseId: id, lawPractice: on, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });

const open = (input: Partial<CreateWorkInput> & { name: string; kind: string }): WorkRecord => {
  const outcome = createWork({ enterpriseId, actor: undefined, as: "Amy Wise", ...input });
  if (!("work" in outcome)) throw new Error(JSON.stringify(outcome));
  return outcome.work;
};

const task = (instruction: string, ...args: string[]) =>
  createTask([instruction, "--function", functionId, "--enterprise", enterpriseId, "--asked-by", "Amy Wise", ...args]);

describe("the /work commands", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const work = (...args: string[]) => handleWorkCommand(args);
  const openedId = (text: string) => /--work (work-[\w-]+)/.exec(text)?.[1] ?? "";

  it("opens, lists, inspects and lists work types", () => {
    const opened = work("create", "Smithers lease", "--kind", "matter", "--client", clientId, "--number", "HL-1", "--type", "property", "--as", "Amy Wise", "--enterprise", enterpriseId);
    expect(opened).toContain("Opened:");
    const id = openedId(opened);
    expect(getWork(id).state).toBe("verified");
    expect(work("list", "--enterprise", enterpriseId)).toContain("Smithers lease");
    expect(work("inspect", id)).toContain("Nothing has been sent to an AI worker");
    const types = work("types", "--enterprise", enterpriseId);
    expect(types).toMatch(/Work types at/);
    expect(types).toMatch(/will .*locked/i);
    expect(types).toContain("General work");
    expect(types).toContain("general-advice");
    expect(work("create", "--kind", "matter", "--enterprise", enterpriseId)).toContain("Usage");
  });

  it("terminal refuses no-AI off / type change / practice on-off with the brief's exact sentence", () => {
    const id = openedId(work("create", "Smithers lease", "--kind", "matter", "--type", "property", "--number", "HL-1", "--no-ai", "--as", "Amy Wise", "--enterprise", enterpriseId));
    expect(work("no-ai", id, "off")).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("type", id, "commercial", "--reason", "Wrong type.")).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("practice", "on", "--enterprise", enterpriseId)).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("practice", "off", "--reason", "Closing.", "--enterprise", enterpriseId)).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("escalation", id, "on")).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("matter-type", "add", "trusts", "--label", "Trusts", "--enterprise", enterpriseId)).toBe(OWNER_CHANGE_ON_PAGE);
    expect(work("matter-type", "unlock", "trusts", "--reason", "Simple.", "--enterprise", enterpriseId)).toBe(OWNER_CHANGE_ON_PAGE);
    expect(getWork(id)).toMatchObject({ work: { noAi: true, matterType: "property", version: 1 } });
  });

  it("on a law-practice account, refuses opening anything but a numbered, typed matter, in Amy's words", () => {
    lawPractice();
    const before = rowCounts();
    expect(work("create", "Practice notes", "--kind", "work", "--as", "Amy Wise", "--enterprise", enterpriseId)).toBe("On a law-practice account, open a matter with a number and type first. Nothing was opened.");
    expect(work("create", "Smithers lease", "--kind", "matter", "--type", "property", "--as", "Amy Wise", "--enterprise", enterpriseId)).toContain("open a matter with a number and type first");
    expect(rowCounts()).toEqual(before);
    expect(work("create", "Smithers lease", "--kind", "matter", "--type", "property", "--number", "HL-1", "--as", "Amy Wise", "--enterprise", enterpriseId)).toContain("Opened:");
  });

  it("terminal turning no-AI on needs --as naming someone at the business, not a reason", () => {
    const id = openedId(work("create", "First", "--kind", "work", "--as", "Amy Wise", "--enterprise", enterpriseId));
    expect(work("no-ai", id, "on", "--confirm")).toContain("--as");
    expect(work("no-ai", id, "on", "--confirm", "--as", "Sam Paralegal")).toContain('"No AI" is on for First.');
  });

  it("terminal may turn no-AI on, after showing what it will do", () => {
    const id = openedId(work("create", "First", "--kind", "work", "--as", "Amy Wise", "--enterprise", enterpriseId));
    const queued = task("Draft a note.", "--work", id).taskId!;
    const sheet = work("no-ai", id, "on");
    expect(sheet).toContain("Material already sent can't be recalled.");
    expect(sheet).toContain(`Not started, and cancelled: ${queued}`);
    expect(getWork(id)).toMatchObject({ work: { noAi: false } });
    expect(work("no-ai", id, "on", "--confirm", "--as", "Amy Wise")).toContain('"No AI" is on for First.');
    expect(getWork(id)).toMatchObject({ work: { noAi: true } });
    expect(getJob(queued)?.status).toBe("cancelled");
  });
});
