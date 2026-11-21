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
import { effectiveNoAi, getWork, listWorkChanges, resolveWorkChain, verifyWorkChangeLog } from "./workStore";
import { refuseWorkUnderLocks } from "./workLocks";
import { setWorkNoAi } from "./workChanges";

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

describe("the work store", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  it("writes nothing on any refusal", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const before = rowCounts();
    for (const input of [
      { name: "", kind: "work" },
      { name: "Deal", kind: "deal" },
      { name: "Deal", kind: "deal", parentWorkId: "work-none" },
      { name: "Matter", kind: "matter", matterType: "other" },
      { name: "Book", kind: "book", parentWorkId: book.id },
      { name: "Work", kind: "work", clientId: "client-none" },
      { name: "Work", kind: "nonsense" },
    ]) {
      expect(createWork({ enterpriseId, actor: undefined, ...input }), JSON.stringify(input)).toHaveProperty("refused");
    }
    expect(createWork({ enterpriseId, actor: undefined, as: "Nobody Here", name: "Work", kind: "work" })).toHaveProperty("refused");
    lawPractice();
    const afterSetting = rowCounts();
    expect(createWork({ enterpriseId, actor: undefined, name: "Matter", kind: "matter", matterType: "property" })).toHaveProperty("refused");
    expect(rowCounts()).toEqual(afterSetting);
    expect({ ...before, practice_settings: afterSetting.practice_settings }).toEqual(afterSetting);
  });

  it("effectiveNoAi reads the book every time: turning the book on blocks the deal with no write to the deal", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    const dealRow = runtimeDb.prepare("SELECT record_json FROM work_records WHERE id = ?").get(deal.id);
    expect(effectiveNoAi(deal.id).noAi).toBe(false);
    expect("refused" in setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Amy Wise" })).toBe(false);
    expect(effectiveNoAi(deal.id)).toMatchObject({ noAi: true, because: expect.stringContaining("Mole's Big Day") });
    expect(runtimeDb.prepare("SELECT record_json FROM work_records WHERE id = ?").get(deal.id)).toEqual(dealRow);
  });

  it("an edited (unverified) parent makes the deal fail closed", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    runtimeDb.prepare("UPDATE work_records SET record_json = replace(record_json, 'Mole''s Big Day', 'Edited') WHERE id = ?").run(book.id);
    expect(getWork(book.id).state).toBe("unverified");
    expect(effectiveNoAi(deal.id).noAi).toBe(true);
    expect(refuseWorkUnderLocks({ workId: deal.id, when: "start" })).toContain("does not verify");
  });

  it("a cycle injected straight into the table is treated as no AI on read", () => {
    // Signed records can't form a cycle; only an edit to the table can, so the
    // signature fails as well. Either way, it fails closed.
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    runtimeDb.prepare("UPDATE work_records SET record_json = json_set(record_json, '$.parentWorkId', ?) WHERE id = ?").run(deal.id, book.id);
    expect("failClosed" in resolveWorkChain(deal.id)).toBe(true);
    expect(effectiveNoAi(deal.id).noAi).toBe(true);
    expect(effectiveNoAi(book.id).noAi).toBe(true);
  });

  it("a locked type stays locked after the law-practice setting is turned off", () => {
    lawPractice();
    const will = open({ name: "Smithers will", kind: "matter", matterType: "will", matterNumber: "HL-1" });
    expect(refuseWorkUnderLocks({ workId: will.id, when: "create" })).toContain("never goes to an AI worker");
    lawPractice(enterpriseId, false);
    expect(refuseWorkUnderLocks({ workId: will.id, when: "create" })).toContain("never goes to an AI worker");
  });

  it("the work-change log is hash-chained and verifyWorkChangeLog detects an edited entry", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Amy Wise" });
    expect(listWorkChanges(enterpriseId)).toHaveLength(3);
    expect(listWorkChanges(enterpriseId, book.id).map((one) => one.what)).toEqual([expect.stringContaining("opened book"), 'turned "no AI" on']);
    expect(verifyWorkChangeLog()).toBe(-1);
    const [{ seq }] = runtimeDb.prepare("SELECT seq FROM work_changes ORDER BY seq LIMIT 1 OFFSET 1").all() as { seq: number }[];
    runtimeDb.prepare("UPDATE work_changes SET record_json = replace(record_json, 'Amy Wise', 'Someone Else') WHERE seq = ?").run(seq);
    expect(verifyWorkChangeLog()).toBe(1);
  });

  it("a deleted entry breaks the chain from there", () => {
    const work = open({ name: "First", kind: "work" });
    setWorkNoAi({ workId: work.id, noAi: true, actor: undefined, as: "Amy Wise" });
    open({ name: "Second", kind: "work" });
    const [{ seq }] = runtimeDb.prepare("SELECT seq FROM work_changes ORDER BY seq LIMIT 1 OFFSET 1").all() as { seq: number }[];
    runtimeDb.prepare("DELETE FROM work_changes WHERE seq = ?").run(seq);
    expect(verifyWorkChangeLog()).toBe(1);
  });
});
