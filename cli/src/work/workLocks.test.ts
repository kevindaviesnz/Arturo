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
import { refuseWebStepRequest } from "../runtime/webSearchSwitch";
import { createWork, type CreateWorkInput } from "./workChanges";
import type { WorkRecord } from "./workRecord";
import { clearWork } from "./workStore";
import { clearWorkSends } from "./workSendLog";
import { addEventScheduleFromArgs } from "../repl/scheduleCommands";
import { runDueEventSchedules } from "../scheduling/eventScheduleRuntime";
import { clearEventSchedules } from "../scheduling/eventScheduleStore";
import { publishOrganisationalEventToRuntimes } from "../events/organisationalEventBus";
import { startRuntimeForBusinessFunction } from "../repl/runtimeCommands";
import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { completeJob, getJob } from "../runtime/jobQueue";
import { listRuntimeEventStore } from "../runtime/runtimeEventStore";
import { refuseTaskWithoutWork, refuseTypedWorkSettingCommand, refuseWorkUnderLocks, TYPED_WORK_SETTING_REFUSALS } from "./workLocks";
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

describe("the locks on named work, when a Task is created", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  /** Refused, with the reason, and not one row written anywhere. */
  const refusedWithNothingWritten = (create: () => { created: boolean; message: string }, reason: RegExp | string) => {
    const before = rowCounts();
    const outcome = create();
    expect(outcome.created).toBe(false);
    expect(outcome.message).toMatch(reason);
    expect(rowCounts()).toEqual(before);
  };
  it("no matter number on a law practice", () => {
    const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property" });
    lawPractice();
    refusedWithNothingWritten(() => task("Summarise the lease terms.", "--work", matter.id), "no matter number");
  });

  it("will / court / dispute type", () => {
    for (const type of ["will", "court", "dispute", "enduring-power-of-attorney", "estate-administration", "relationship-property"]) {
      const matter = open({ name: `A ${type} matter`, kind: "matter", matterType: type, matterNumber: `HL-${type}` });
      refusedWithNothingWritten(() => task("Draft a first letter.", "--work", matter.id), "never goes to an AI worker");
    }
  });

  it("no AI on the matter", () => {
    const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1", noAi: true });
    refusedWithNothingWritten(() => task("Summarise the lease terms.", "--work", matter.id), '"No AI" is on for Smithers lease');
  });

  it("no AI on the book, task on the deal", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    expect(task("Draft the German rights offer.", "--work", deal.id).created).toBe(true);
    expect("refused" in setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Amy Wise" })).toBe(false);
    refusedWithNothingWritten(() => task("Draft the German rights offer.", "--work", deal.id), "which German rights belongs to");
    // The deal itself was never changed: the book is read every time.
    expect(refuseWorkUnderLocks({ workId: deal.id, when: "start" })).toContain("Mole's Big Day");
  });

  it("work from another business", () => {
    const elsewhere = createWork({ enterpriseId: otherId, name: "Their matter", kind: "work", actor: undefined });
    if (!("work" in elsewhere)) throw new Error(JSON.stringify(elsewhere));
    refusedWithNothingWritten(() => task("Draft a letter.", "--work", elsewhere.work.id), /not work of this business|no work/i);
  });

  it("client mismatch", () => {
    const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1", clientId });
    refusedWithNothingWritten(() => task("Summarise the lease terms.", "--work", matter.id, "--client", otherClientId), /client/i);
    // The work's client is the Task's client.
    const created = task("Summarise the lease terms.", "--work", matter.id);
    expect(created.created).toBe(true);
    expect(getJob(created.taskId!)).toMatchObject({ workId: matter.id, clientId });
  });

  it("--follows across work", () => {
    const first = open({ name: "First", kind: "work" });
    const second = open({ name: "Second", kind: "work" });
    const source = task("Draft the first letter.", "--work", first.id);
    expect(source.created).toBe(true);
    completeJob(source.taskId!, "The first letter.");
    refusedWithNothingWritten(() => task("Revise it.", "--follows", source.taskId!, "--work", second.id), "can't be moved");
    // Following work without --work inherits it, and can't drop it.
    const follows = task("Revise it.", "--follows", source.taskId!);
    expect(follows.created).toBe(true);
    expect(getJob(follows.taskId!)?.workId).toBe(first.id);
  });

  it("--pass-on with work", () => {
    const work = open({ name: "First", kind: "work" });
    refusedWithNothingWritten(() => task("Draft the first letter.", "--work", work.id, "--pass-on", functionId), /pass/i);
  });

  it("an unverified or missing work record is refused", () => {
    const work = open({ name: "First", kind: "work" });
    runtimeDb.prepare("UPDATE work_records SET record_json = replace(record_json, '\"noAi\":false', '\"noAi\":true') WHERE id = ?").run(work.id);
    refusedWithNothingWritten(() => task("Draft a letter.", "--work", work.id), /does not verify/);
    refusedWithNothingWritten(() => task("Draft a letter.", "--work", "work-nonesuch"), /no work/i);
  });

  it("creates the Task on open work, keeping its workId", () => {
    const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1" });
    lawPractice();
    const created = task("Summarise the lease terms.", "--work", matter.id);
    expect(created.created).toBe(true);
    expect(getJob(created.taskId!)?.workId).toBe(matter.id);
  });
});

describe("when a law practice's Task must belong to a typed piece of work (addendum 1)", () => {
  beforeEach(() => { setUp(); lawPractice(); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const refusedWithNothingWritten = (create: () => { created: boolean; message: string }, reason: RegExp | string) => {
    const before = rowCounts();
    const outcome = create();
    expect(outcome.created).toBe(false);
    expect(outcome.message).toMatch(reason);
    expect(outcome.message).toContain("Nothing was started.");
    expect(rowCounts()).toEqual(before);
  };

  it("--client is given", () => {
    refusedWithNothingWritten(() => task("Draft a letter.", "--client", clientId), "names a client with --client");
  });

  it("a document is attached", () => {
    expect(refuseTaskWithoutWork({ enterpriseId, hasDocuments: true, instruction: "Review this." })).toContain("has a document attached");
  });

  it("the task is a precedent draft or a checker", () => {
    refusedWithNothingWritten(() => createTask(["Draft an NDA.", "--function", functionId, "--enterprise", enterpriseId, "--asked-by", "Amy Wise"], { draftKind: "precedent-draft" }), "first draft from a precedent");
    refusedWithNothingWritten(() => createTask(["Check the draft.", "--function", functionId, "--enterprise", enterpriseId, "--asked-by", "Amy Wise"], { draftKind: "checker" }), "check of a draft");
  });

  it("the instruction names a listed client", () => {
    refusedWithNothingWritten(() => task("Draft a letter to Jane Smithers about her lease."), "names Jane Smithers, on your client list");
  });

  it("--follows a result with work: the new Task inherits it", () => {
    const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1", clientId });
    const source = task("Summarise the lease.", "--work", matter.id);
    expect(source.created).toBe(true);
    completeJob(source.taskId!, "The summary.");
    const follows = task("Now draft the reply.", "--follows", source.taskId!);
    expect(follows.created).toBe(true);
    expect(getJob(follows.taskId!)).toMatchObject({ workId: matter.id, clientId });
  });

  it("a Task with none of these needs no matter", () => {
    expect(task("Draft the office's leave policy.").created).toBe(true);
  });

  it("naming a client with any matter under \"no AI\" is refused outright, even with work, and at any business", () => {
    open({ name: "Smithers will", kind: "matter", matterType: "commercial", matterNumber: "HL-9", clientId, noAi: true });
    const other = open({ name: "Rawiri lease", kind: "matter", matterType: "property", matterNumber: "HL-10", clientId: otherClientId });
    refusedWithNothingWritten(() => task("Write to Jane Smithers.", "--work", other.id), '"no AI" on (Smithers will)');
    lawPractice(enterpriseId, false);
    refusedWithNothingWritten(() => task("Write to Jane Smithers."), '"no AI" on');
  });

  it("is not required at a business that is not a law practice", () => {
    lawPractice(enterpriseId, false);
    expect(task("Draft a letter.", "--client", clientId).created).toBe(true);
    expect(task("Draft a letter to Jane Smithers.").created).toBe(true);
  });
});

describe("only matters on a law practice (Amy, addendum 1)", () => {
  beforeEach(() => { setUp(); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  it("the shared work-creation function refuses anything but a numbered, typed matter, before any write", () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    lawPractice();
    const before = rowCounts();
    for (const input of [
      { name: "Practice notes", kind: "work" },
      { name: "Precedent library", kind: "book" },
      { name: "German rights", kind: "deal", parentWorkId: book.id },
      { name: "Smithers lease", kind: "matter", matterType: "property" },
      { name: "Smithers lease", kind: "matter", matterNumber: "HL-1" },
    ]) {
      expect(createWork({ enterpriseId, actor: undefined, as: "Amy Wise", ...input }), JSON.stringify(input)).toEqual({ refused: "On a law-practice account, open a matter with a number and type first.", refusal: { code: "law_practice_matter_only" } });
    }
    expect(rowCounts()).toEqual(before);
    expect(createWork({ enterpriseId, actor: undefined, as: "Amy Wise", name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1" })).toHaveProperty("work");
  });

  it("work that is not a matter, opened before the setting went on, never goes to an AI worker", () => {
    const office = open({ name: "Office admin", kind: "work" });
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    expect(task("Draft the leave policy.", "--work", office.id).created).toBe(true);
    lawPractice();
    for (const work of [office, book, deal]) {
      expect(refuseWorkUnderLocks({ workId: work.id, when: "start" }), work.name).toContain("AI work must belong to a typed piece of work");
    }
    const before = rowCounts();
    expect(task("Draft the leave policy.", "--work", office.id)).toMatchObject({ created: false, message: expect.stringContaining("Office admin is not a typed piece of work.") });
    expect(rowCounts()).toEqual(before);
  });
});

describe("the paths that skip createTask", () => {
  beforeEach(() => { setUp(); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const startDrafting = () => startRuntimeForBusinessFunction(getBusinessFunctionDefinition(functionId)!);

  it("a Function creating a Task from an Event is refused when it would need a matter, writing no Task", async () => {
    lawPractice();
    startDrafting();
    const before = listJobs().length;
    const publication = await publishOrganisationalEventToRuntimes(
      { label: "Lease received", sourceBusinessFunction: "Intake", enterpriseName: "Harbour Legal" },
      async () => ({ shouldCreateJob: true, task: "Draft a reply to Jane Smithers about the lease.", reason: "A reply is due." }),
    );
    expect(listJobs().length).toBe(before);
    expect(publication.evaluations).toHaveLength(1);
    expect(JSON.stringify(listRuntimeEventStore())).toContain("must belong to a typed piece of work");
  });

  it("an Event from a Task on named work is never read by a model", async () => {
    startDrafting();
    const work = open({ name: "First", kind: "work" });
    const source = task("Draft the first letter.", "--work", work.id);
    const reasoner = vi.fn(async () => ({ shouldCreateJob: true, task: "Carry on.", reason: "More to do." }));
    const before = listJobs().length;
    await publishOrganisationalEventToRuntimes(
      { label: "Draft finished", sourceBusinessFunction: "Drafting", enterpriseName: "Harbour Legal", payload: { sourceJobId: source.taskId! } },
      reasoner,
    );
    expect(reasoner).not.toHaveBeenCalled();
    expect(listJobs().length).toBe(before);
  });

  it("a Schedule naming a client is refused on a law practice before anything is written", () => {
    lawPractice();
    const before = rowCounts();
    expect(() => addEventScheduleFromArgs(["add", "Check in with Jane Smithers.", "--every", "daily", "--at", "06:00", "--timezone", "Pacific/Auckland", "--function", "Drafting", "--enterprise", enterpriseId]))
      .toThrow("Nothing was scheduled.");
    expect(rowCounts()).toEqual(before);
  });

  it("a Schedule's occurrence is checked again as it fires, and skipped once it would need a matter", async () => {
    clearEventSchedules();
    const schedule = addEventScheduleFromArgs(["add", "Check in with Jane Smithers.", "--every", "daily", "--at", "06:00", "--timezone", "Pacific/Auckland", "--function", "Drafting", "--enterprise", enterpriseId]);
    lawPractice();
    const results = await runDueEventSchedules(schedule.nextRunAt);
    expect(results).toEqual([expect.objectContaining({ status: "skipped", reason: expect.stringContaining("must belong to a typed piece of work") })]);
    expect(getJob(schedule.taskId)?.status).toBe("scheduled");
    clearEventSchedules();
  });
});

describe("the general setting 'AI work must belong to a typed piece of work' (setup-and-staff final v3)", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const typedWork = (id = enterpriseId, on = true, law = false) =>
    saveSignedPracticeSetting({ enterpriseId: id, lawPractice: law, typedWorkRequired: on, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });

  it("switches on for an existing law practice without the new field, and untyped work is refused", () => {
    const office = open({ name: "Office admin", kind: "work" });
    lawPractice();
    expect(refuseWorkUnderLocks({ workId: office.id, when: "create" })).toContain("AI work must belong to a typed piece of work");
    expect(refuseTypedWorkSettingCommand(enterpriseId, "workflow")).toBe(TYPED_WORK_SETTING_REFUSALS.workflow);
  });

  it("applies in a business that is not a law practice when the setting is on, and does not when it is off", () => {
    typedWork(enterpriseId, true, false);
    expect(refuseTaskWithoutWork({ enterpriseId, hasDocuments: true, instruction: "Review this." })).toContain("must belong to a typed piece of work");
    expect(task("Draft a letter.", "--client", clientId).created).toBe(false);
    typedWork(enterpriseId, false, false);
    expect(refuseTaskWithoutWork({ enterpriseId, hasDocuments: true, instruction: "Review this." })).toBeUndefined();
    expect(task("Draft a letter.", "--client", clientId).created).toBe(true);
  });

  it("a locked work type is refused in every business, whether the setting is on or off", () => {
    typedWork(enterpriseId, false, false);
    const will = open({ name: "A will", kind: "matter", matterType: "will", matterNumber: "W-1" });
    expect(refuseWorkUnderLocks({ workId: will.id, when: "create" })).toContain("never goes to an AI worker");
    typedWork(enterpriseId, true, false);
    expect(refuseWorkUnderLocks({ workId: will.id, when: "send" })).toContain("never goes to an AI worker");
  });

  it("the four named refusals fire when the setting is on, each logged, and not when it is off", () => {
    typedWork(enterpriseId, true, false);
    for (const kind of ["workflow", "run", "recurring", "send"] as const) {
      expect(refuseTypedWorkSettingCommand(enterpriseId, kind), kind).toBe(TYPED_WORK_SETTING_REFUSALS[kind]);
    }
    const before = rowCounts();
    expect(() => addEventScheduleFromArgs(["add", "Draft the monthly office notes.", "--every", "daily", "--at", "06:00", "--timezone", "Pacific/Auckland", "--function", "Drafting", "--enterprise", enterpriseId]))
      .toThrow(TYPED_WORK_SETTING_REFUSALS.recurring);
    expect(rowCounts()).toEqual(before);
    typedWork(enterpriseId, false, false);
    for (const kind of ["workflow", "run", "recurring", "send"] as const) {
      expect(refuseTypedWorkSettingCommand(enterpriseId, kind), kind).toBeUndefined();
    }
    const schedule = addEventScheduleFromArgs(["add", "Draft the monthly office notes.", "--every", "daily", "--at", "06:00", "--timezone", "Pacific/Auckland", "--function", "Drafting", "--enterprise", enterpriseId]);
    expect(schedule.taskId).toBeTruthy();
    clearEventSchedules();
  });

  it("recurring and scheduled AI work on locked work stays refused when the setting is on, drafts included", () => {
    typedWork(enterpriseId, true, false);
    const will = open({ name: "A will", kind: "matter", matterType: "will", matterNumber: "W-1" });
    expect(refuseWorkUnderLocks({ workId: will.id, when: "start" })).toContain("never goes to an AI worker");
    const before = rowCounts();
    expect(() => addEventScheduleFromArgs(["add", "Draft the will.", "--every", "daily", "--at", "06:00", "--timezone", "Pacific/Auckland", "--function", "Drafting", "--enterprise", enterpriseId]))
      .toThrow("Nothing was scheduled.");
    expect(rowCounts()).toEqual(before);
  });

  it("web search is refused on typed work when the setting is on, and on a locked type in every business when it is off", () => {
    const lease = open({ name: "Lease", kind: "matter", matterType: "property", matterNumber: "HL-2" });
    const will = open({ name: "A will", kind: "matter", matterType: "will", matterNumber: "W-2" });
    typedWork(enterpriseId, true, false);
    expect(refuseWebStepRequest({ enterpriseId, workId: lease.id, words: "search these words" })?.code).toBe("web_search_on_matter");
    typedWork(enterpriseId, false, false);
    expect(refuseWebStepRequest({ enterpriseId, workId: will.id, words: "search these words" })?.code).toBe("web_search_on_locked_work");
  });
});
