import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearFunctionOrigins } from "../business/functionOrigin";
import { addClient, setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { accountFromSession, clearSignIn, redeemInvite, turnOnSignIn } from "../identity/companySignIn";
import * as llmClient from "../llm/llmClient";
import { createTask } from "../repl/taskRoutingCommands";
import { clearHandOffs } from "../runtime/handOff";
import { clearJobs, getJob, listJobs, startJob } from "../runtime/jobQueue";
import { clearPassOns } from "../runtime/passOnRules";
import { clearResultSetAsides, readResultSetAsideStanding } from "../runtime/resultSetAside";
import { clearResultSignOffs } from "../runtime/resultSignOff";
import { processNextQueuedJob } from "../runtime/workerRuntime";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { clearPolicyRules } from "../storage/policyRepository";
import { runtimeDb } from "../storage/runtimeDatabase";
import { insertWorkRecord } from "../storage/workRepository";
import { signOffTaskResult } from "../task/taskSignOff";
import { clearPracticeSettings, saveSignedPracticeSetting } from "./practiceSetting";
import { cancelWork, changeMatterType, createWork, describeCancelEffects, type CreateWorkInput } from "./workChanges";
import { handleWorkCommand } from "./workCommands";
import { refuseWorkUnderLocks } from "./workLocks";
import { WORK_REFUSAL_CODES, WORK_REFUSAL_WORDING, workRefusalText, type WorkRecord } from "./workRecord";
import { formatNzDay } from "../core/nzTime";
import { clearWork, getWork, listWorkChanges, verifyWorkChangeLog } from "./workStore";
import { clearWorkSends } from "./workSendLog";

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

const refusedWith = (code: string) => expect.objectContaining({ refusal: expect.objectContaining({ code }) });
const work = (id: string) => {
  const standing = getWork(id);
  if (standing.state !== "verified") throw new Error(`${id} does not verify`);
  return standing.work;
};

describe("fixed refusal codes (Mia's Q6)", () => {
  it("every code has terminal and page wording from one table, and the page never names a terminal flag", () => {
    expect(Object.keys(WORK_REFUSAL_WORDING).sort()).toEqual([...WORK_REFUSAL_CODES].sort());
    const values = { id: "work-x", name: "Mole's Big Day", number: "2026-014", types: "commercial", kind: "book", newKind: "deal", newer: "Acme NDA (2)" };
    for (const code of WORK_REFUSAL_CODES) {
      const terminal = workRefusalText({ code, values }, "terminal");
      const page = workRefusalText({ code, values }, "page");
      expect(terminal, code).toMatch(/\S/);
      expect(page, code).toMatch(/\S/);
      expect(page, code).not.toMatch(/--[a-z]/);
    }
  });

  it("maps codes to Mia's \u00a71 page wording and the terminal's own", () => {
    const say = (code: (typeof WORK_REFUSAL_CODES)[number], values = {}) => [workRefusalText({ code, values }, "terminal"), workRefusalText({ code, values }, "page")];
    expect(say("parent_required")).toEqual(["A deal belongs to a book. Name its book.", "A deal belongs to a book. Choose the book."]);
    expect(say("parent_cancelled", { name: "Mole's Big Day" })).toEqual(["A new deal can't be opened under a cancelled book.", "Mole's Big Day was cancelled, so no new deal can be opened in it."]);
    expect(say("owner_only")).toEqual(["Make this change on the company page, signed in as the owner.", "Only the owner can change this, signed in, with a reason."]);
    expect(say("type_locked_to_unlocked", { type: "Will" })).toEqual([
      "A locked work type can't be changed to an unlocked one. Cancel the matter with a reason and open a new one.",
      "Will work can't be changed to an unlocked type. If it was opened with the wrong type, cancel it with a reason and open a new matter.",
    ]);
    expect(say("name_required")[1]).toBe("Give it a name.");
    expect(say("kind_unknown")[1]).toBe("Choose what kind of work it is.");
    expect(say("law_practice_matter_only")).toEqual(["On a law-practice account, open a matter with a number and type first.", "On a law-practice account, open a matter with a number and type first."]);
    expect(say("matter_number_in_use", { number: "2026-014", name: "Acme NDA" })[1]).toBe("Matter number 2026-014 is already used by Acme NDA, which is still open. Use another number.");
    expect(say("matter_number_cancelled", { number: "2026-014", name: "Acme NDA", id: "work-1", date: "10 Nov 2026" })).toEqual([
      "Matter number 2026-014 was used by Acme NDA, cancelled 10 Nov 2026. Name the cancelled matter it replaces, or use another number.",
      '2026-014 is already used by cancelled Acme NDA. Choose "This replaces Acme NDA" to reuse it, or use another number.',
    ]);
    expect(say("client_not_found", { id: "client-9" })[1]).toBe("No client client-9 is recorded for this business.");
  });

  it("has every code Mia's section 9 names, and no terminal wording names --replaces", () => {
    for (const code of ["name_required", "parent_required", "parent_not_allowed", "parent_cancelled", "client_not_found", "matter_number_pattern", "matter_number_in_use", "matter_number_cancelled", "matter_type_unknown",
      "type_locked_to_unlocked", "carry_over_unverified", "owner_only", "not_at_business", "cancel_not_signer", "reason_missing", "reason_too_long", "sign_in_off", "unverified_work"]) {
      expect(WORK_REFUSAL_CODES, code).toContain(code);
    }
    const values = { id: "work-x", name: "Acme NDA", number: "2026-014", date: "10 Nov 2026", type: "Will" };
    for (const code of WORK_REFUSAL_CODES) expect(workRefusalText({ code, values }, "terminal"), code).not.toContain("--replaces");
  });
});

describe("cancelling named work, and replacing it", () => {
  beforeEach(() => { setUp(); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const tokenOf = (code: string) => {
    const outcome = redeemInvite({ code, password: "a long enough password" });
    if ("refused" in outcome) throw new Error(outcome.refused);
    return outcome.token;
  };
  const signInOwner = () => {
    const turned = turnOnSignIn({ enterpriseId, owner: "Amy Wise" });
    if ("refused" in turned) throw new Error(turned.refused);
    return tokenOf(turned.code);
  };

  describe("who may cancel, and the reason, refused before any write", () => {
    it("at the terminal: only a person named with --as who can sign off, with a typed reason", () => {
      const matter = open({ name: "Acme NDA", kind: "work" });
      const before = rowCounts();
      expect(cancelWork({ workId: matter.id, reason: "Client went elsewhere.", actor: undefined })).toMatchObject({ refused: expect.stringContaining("--as"), refusal: { code: "as_required" } });
      expect(cancelWork({ workId: matter.id, reason: "Client went elsewhere.", actor: undefined, as: "Nobody Here" })).toMatchObject({ refused: expect.stringContaining("Nobody called Nobody Here") });
      expect(cancelWork({ workId: matter.id, reason: "Client went elsewhere.", actor: undefined, as: "Sam Paralegal" })).toMatchObject({ refused: "Only someone who may sign off work can cancel it.", refusal: { code: "cancel_not_signer" } });
      expect(cancelWork({ workId: matter.id, reason: "Client went elsewhere.", actor: undefined, as: "Zed Other" })).toMatchObject({ refused: expect.stringContaining("Nobody called Zed Other") });
      for (const reason of ["", "   ", "x".repeat(501)]) {
        expect(cancelWork({ workId: matter.id, reason, actor: undefined, as: "Amy Wise" })).toMatchObject({ refused: expect.stringMatching(/Give a reason|under 500/) });
      }
      expect(handleWorkCommand(["cancel", matter.id, "--as", "Sam Paralegal", "--reason", "Gone.", "--confirm"])).toContain("Only someone who may sign off work can cancel it.");
      // Without --confirm the terminal only says what it would do.
      expect(handleWorkCommand(["cancel", matter.id, "--as", "Amy Wise", "--reason", "Gone."])).toContain("Nothing was changed yet.");
      expect(rowCounts()).toEqual(before);
      expect(work(matter.id).cancelledAt).toBeUndefined();
      expect(handleWorkCommand(["cancel", matter.id, "--as", "Amy Wise", "--reason", "Client went elsewhere.", "--confirm"])).toContain("Cancelled Acme NDA.");
      expect(work(matter.id)).toMatchObject({ cancelledBy: "Amy Wise", cancelReason: "Client went elsewhere.", cancelledAt: expect.any(Number) });
      expect(listWorkChanges(enterpriseId, matter.id).at(-1)).toMatchObject({ what: 'cancelled work "Acme NDA"', by: "Amy Wise", reason: "Client went elsewhere." });
      expect(verifyWorkChangeLog()).toBe(-1);
      // It can't be reopened or changed, and cancelling again changes nothing.
      expect(cancelWork({ workId: matter.id, reason: "Again.", actor: undefined, as: "Amy Wise" })).toMatchObject({ refused: expect.stringContaining("already cancelled") });
    });
  });

  describe("what cancelling does to Tasks", () => {
    it("cancels queued Tasks, and a running one's result is set aside by Arturo and can't be signed off", async () => {
      const matter = open({ name: "Acme NDA", kind: "work" });
      const running = task("Draft the NDA.", "--work", matter.id).taskId!;
      const queued = task("Draft the cover letter.", "--work", matter.id).taskId!;
      let during: ReturnType<typeof cancelWork> | undefined;
      vi.spyOn(llmClient, "generateWithConfiguredLlm").mockImplementation(async () => {
        during = cancelWork({ workId: matter.id, reason: "Client withdrew.", actor: undefined, as: "Amy Wise" });
        return { response: "A draft.", model: "test" } as never;
      });
      const finished = await processNextQueuedJob(() => undefined);
      expect(finished?.id).toBe(running);
      expect(during).toMatchObject({ cancelled: [queued], willBeSetAside: [running] });
      expect(getJob(queued)?.status).toBe("cancelled");
      const standing = readResultSetAsideStanding(getJob(running)!);
      expect(standing).toMatchObject({ state: "set_aside", setAside: { worker: "Arturo", bySystem: true } });
      expect(signOffTaskResult([running, "--as", "Amy Wise"])).toMatchObject({ signedOff: false });
      // Nothing new can start, at create or as a follow-on.
      const before = rowCounts();
      expect(task("Draft another letter.", "--work", matter.id)).toMatchObject({ created: false, message: expect.stringContaining("was cancelled") });
      expect(rowCounts()).toEqual(before);
      for (const when of ["create", "start", "send", "finish", "signoff"] as const) {
        expect(refuseWorkUnderLocks({ workId: matter.id, when })).toContain("was cancelled");
      }
      // Nothing is deleted: the record, its log and its Tasks are all still there.
      expect(listJobs().filter((job) => job.workId === matter.id)).toHaveLength(2);
      expect(listWorkChanges(enterpriseId, matter.id).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("books and deals", () => {
    it("cancelling a book cancels its deals, one signed entry each under the same reason; the sheet lists them first", () => {
      const book = open({ name: "Mole's Big Day", kind: "book" });
      const german = open({ name: "German rights", kind: "deal", parentWorkId: book.id, noAi: true });
      const french = open({ name: "French rights", kind: "deal", parentWorkId: book.id });
      const korean = open({ name: "Korean rights", kind: "deal", parentWorkId: book.id });
      expect(cancelWork({ workId: korean.id, reason: "Fell through.", actor: undefined, as: "Amy Wise" })).not.toHaveProperty("refused");
      // Cancelling one deal leaves its book open.
      expect(work(book.id).cancelledAt).toBeUndefined();
      const frenchTask = task("Draft the French offer.", "--work", french.id).taskId!;
      startJob(frenchTask);
      const sheet = describeCancelEffects(book.id);
      if ("refused" in sheet) throw new Error(sheet.refused);
      expect([...sheet.deals].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
        { id: french.id, name: "French rights", state: "allowed", running: true },
        { id: german.id, name: "German rights", state: "no-ai", running: false },
        { id: korean.id, name: "Korean rights", state: "cancelled", running: false },
      ]);
      expect(sheet.runningDeals).toBe(1);
      expect(sheet.running).toEqual([frenchTask]);
      const outcome = cancelWork({ workId: book.id, reason: "Rights reverted to the author.", actor: undefined, as: "Amy Wise" });
      if ("refused" in outcome) throw new Error(outcome.refused);
      expect(outcome.cancelledWork[0]).toBe(book.id);
      expect([...outcome.cancelledWork].sort()).toEqual([book.id, german.id, french.id].sort());
      expect(outcome.willBeSetAside).toEqual([frenchTask]);
      for (const id of [book.id, german.id, french.id]) expect(work(id)).toMatchObject({ cancelReason: "Rights reverted to the author.", cancelledBy: "Amy Wise" });
      const entries = listWorkChanges(enterpriseId).filter((one) => one.reason === "Rights reverted to the author.");
      expect(entries[0]).toMatchObject({ workId: book.id, what: 'cancelled book "Mole\'s Big Day"' });
      expect(entries.slice(1).map((one) => [one.workId, one.what]).sort()).toEqual([
        [german.id, 'cancelled deal "German rights", with its book "Mole\'s Big Day"'],
        [french.id, 'cancelled deal "French rights", with its book "Mole\'s Big Day"'],
      ].sort());
      expect(verifyWorkChangeLog()).toBe(-1);
    });

    it("no new deal opens under a cancelled book", () => {
      const book = open({ name: "Mole's Big Day", kind: "book" });
      cancelWork({ workId: book.id, reason: "Rights reverted.", actor: undefined, as: "Amy Wise" });
      const before = rowCounts();
      expect(createWork({ enterpriseId, name: "Spanish rights", kind: "deal", parentWorkId: book.id, actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("parent_cancelled"));
      expect(handleWorkCommand(["create", "Spanish rights", "--kind", "deal", "--parent", book.id, "--as", "Amy Wise", "--enterprise", enterpriseId])).toBe("A new deal can't be opened under a cancelled book. Nothing was opened.");
      expect(rowCounts()).toEqual(before);
    });
  });

  describe("matter numbers", () => {
    const amyOwnerPractice = () => lawPractice();

    it("are unique among open work, in code and in the database; a cancelled number is reused only by naming what it replaces", () => {
      amyOwnerPractice();
      const first = open({ name: "Acme NDA", kind: "matter", matterNumber: "2026-014", matterType: "commercial", noAi: true });
      const before = rowCounts();
      expect(createWork({ enterpriseId, name: "Another", kind: "matter", matterNumber: "2026-014", matterType: "commercial", actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("matter_number_in_use"));
      // The database refuses it too, even past the code.
      const raw = { ...first, id: "work-raw", name: "Raw" };
      expect(() => insertWorkRecord(raw)).toThrow(/UNIQUE/);
      expect(() => insertWorkRecord({ ...raw, matterNumber: "2026-014".toUpperCase() })).toThrow(/UNIQUE/);
      expect(rowCounts()).toEqual(before);

      cancelWork({ workId: first.id, reason: "Client went elsewhere.", actor: undefined, as: "Amy Wise" });
      const afterCancel = rowCounts();
      expect(createWork({ enterpriseId, name: "Acme NDA again", kind: "matter", matterNumber: "2026-014", matterType: "commercial", actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("matter_number_cancelled"));
      expect(handleWorkCommand(["create", "Acme NDA again", "--kind", "matter", "--number", "2026-014", "--type", "commercial", "--as", "Amy Wise", "--enterprise", enterpriseId]))
        .toBe(`Matter number 2026-014 was used by Acme NDA, cancelled ${formatNzDay(Date.now())}. Name the cancelled matter it replaces, or use another number. Nothing was opened.`);
      expect(rowCounts()).toEqual(afterCancel);

      const second = open({ name: "Acme NDA again", kind: "matter", matterNumber: "2026-014", matterType: "commercial", replacesWorkId: first.id });
      // "No AI" carried over because the cancelled matter had it; the type wasn't locked, so it wasn't.
      expect(second).toMatchObject({ noAi: true, matterType: "commercial", replacesWorkId: first.id, carryOver: { from: first.id, checked: true, noAi: true } });
      expect(second.carryOver?.lockedType).toBeUndefined();
      expect(second.typeHeld).toBeUndefined();
      // Never two open with the same number.
      expect(createWork({ enterpriseId, name: "Third", kind: "matter", matterNumber: "2026-014", matterType: "commercial", replacesWorkId: first.id, actor: undefined, as: "Amy Wise" }))
        .toEqual(refusedWith("replaces_already_replaced"));
    });

    it("carries a locked type only if the cancelled matter had one, and nothing it didn't have", () => {
      amyOwnerPractice();
      const estate = open({ name: "Smith estate", kind: "matter", matterNumber: "2026-031", matterType: "estate-administration" });
      const plain = open({ name: "Lease", kind: "matter", matterNumber: "2026-032", matterType: "property" });
      for (const one of [estate, plain]) cancelWork({ workId: one.id, reason: "Opened in error.", actor: undefined, as: "Amy Wise" });
      // Asking for an unlocked type on a locked number is the owner's reopen, on the page only.
      expect(createWork({ enterpriseId, name: "Smith estate", kind: "matter", matterNumber: "2026-031", matterType: "commercial", replacesWorkId: estate.id, actor: undefined, as: "Amy Wise" })).toMatchObject({ refusal: { code: "owner_only" } });
      const again = open({ name: "Smith estate", kind: "matter", matterNumber: "2026-031", matterType: "estate-administration", replacesWorkId: estate.id });
      expect(again).toMatchObject({ matterType: "estate-administration", noAi: false, carryOver: { checked: true, noAi: false, lockedType: "estate-administration" } });
      expect(refuseWorkUnderLocks({ workId: again.id, when: "create" })).toContain("never goes to an AI worker");
      const lease = open({ name: "Lease", kind: "matter", matterNumber: "2026-032", matterType: "commercial", replacesWorkId: plain.id });
      expect(lease).toMatchObject({ matterType: "commercial", noAi: false, carryOver: { checked: true, noAi: false } });
      expect(lease.carryOver?.lockedType).toBeUndefined();
      expect(refuseWorkUnderLocks({ workId: lease.id, when: "create" })).toBeUndefined();
    });

    it("follows the chain to the newest record, and fails closed when its HMAC doesn't verify or the record is missing", () => {
      amyOwnerPractice();
      const a = open({ name: "Acme NDA", kind: "matter", matterNumber: "2026-014", matterType: "commercial" });
      cancelWork({ workId: a.id, reason: "One.", actor: undefined, as: "Amy Wise" });
      const b = open({ name: "Acme NDA (2)", kind: "matter", matterNumber: "2026-014", matterType: "commercial", replacesWorkId: a.id, noAi: true });
      cancelWork({ workId: b.id, reason: "Two.", actor: undefined, as: "Amy Wise" });
      // Naming the first record links to the newest in its chain.
      const c = open({ name: "Acme NDA (3)", kind: "matter", matterNumber: "2026-014", matterType: "commercial", replacesWorkId: a.id });
      expect(c).toMatchObject({ replacesWorkId: b.id, noAi: true, carryOver: { from: b.id, checked: true, noAi: true } });
      cancelWork({ workId: c.id, reason: "Three.", actor: undefined, as: "Amy Wise" });

      // The newest record is edited: its HMAC fails, so the new matter opens with "no AI" on and its type held locked.
      runtimeDb.prepare("UPDATE work_records SET record_json = json_set(record_json, '$.noAi', json('false')) WHERE id = ?").run(c.id);
      const d = open({ name: "Acme NDA (4)", kind: "matter", matterNumber: "2026-015", matterType: "commercial", replacesWorkId: a.id });
      expect(d).toMatchObject({ noAi: true, typeHeld: true, carryOver: { checked: false, noAi: true } });
      expect(refuseWorkUnderLocks({ workId: d.id, when: "create" })).toContain("couldn't confirm the record it replaces");
      expect(handleWorkCommand(["inspect", d.id])).toContain("type held locked");

      // A record that is missing fails closed the same way.
      const e = open({ name: "Unknown", kind: "matter", matterNumber: "2026-016", matterType: "commercial", replacesWorkId: "work-does-not-exist" });
      expect(e).toMatchObject({ noAi: true, typeHeld: true, carryOver: { from: "work-does-not-exist", checked: false } });
    });

    it("only the owner releases a held type, by choosing a type with a reason", () => {
      amyOwnerPractice();
      const d = open({ name: "Held", kind: "matter", matterNumber: "2026-020", matterType: "commercial", replacesWorkId: "work-missing" });
      expect(changeMatterType({ workId: d.id, matterType: "commercial", reason: "Checked the old file.", actor: undefined })).toHaveProperty("refused");
      expect(work(d.id).typeHeld).toBe(true);
      const amy = accountFromSession(signInOwner())!;
      expect(changeMatterType({ workId: d.id, matterType: "commercial", reason: "", actor: amy })).toMatchObject({ refused: expect.stringContaining("Give a reason") });
      expect(changeMatterType({ workId: d.id, matterType: "commercial", reason: "Checked the old paper file.", actor: amy })).not.toHaveProperty("refused");
      expect(work(d.id).typeHeld).toBeUndefined();
      expect(listWorkChanges(enterpriseId, d.id).at(-1)).toMatchObject({ reason: "Checked the old paper file.", what: expect.stringContaining("releasing the held type") });
      // "No AI" stays on until the owner turns it off, with a reason.
      expect(refuseWorkUnderLocks({ workId: d.id, when: "create" })).toContain('"No AI" is on');
    });
  });

  describe("a cancelled book or deal with the same title", () => {
    it("offers the link, never requires it, and declining asks straight away whether to turn No AI on", async () => {
      const old = open({ name: "Mole's Big Day", kind: "book", noAi: true });
      cancelWork({ workId: old.id, reason: "Rights reverted.", actor: undefined, as: "Amy Wise" });
      const before = rowCounts();
      const offer = createWork({ enterpriseId, name: "moles big day", kind: "book", actor: undefined, as: "Amy Wise" });
      expect(offer).toEqual({ prompt: { kind: "title-match", matches: [{ id: old.id, name: "Mole's Big Day", cancelledAt: expect.any(Number), noAi: true }] } });
      expect(createWork({ enterpriseId, name: "MOLE\u2019S BIG DAY", kind: "book", actor: undefined, as: "Amy Wise" })).toHaveProperty("prompt");
      // A title written differently isn't caught.
      expect(createWork({ enterpriseId, name: "Mole's Big Days", kind: "book", actor: undefined, as: "Sam Paralegal", noAi: false })).toHaveProperty("work");
      const counted = rowCounts();
      const ask = createWork({ enterpriseId, name: "Moles Big Day", kind: "book", separate: true, actor: undefined, as: "Amy Wise" });
      expect(ask).toEqual({ prompt: { kind: "ask-no-ai", matched: { id: old.id, name: "Mole's Big Day" } } });
      expect(handleWorkCommand(["create", "Moles Big Day", "--kind", "book", "--as", "Amy Wise", "--enterprise", enterpriseId])).toContain("had 'no AI' switched on. Link this one to it and keep 'no AI'?");
      expect(handleWorkCommand(["create", "Moles Big Day", "--kind", "book", "--separate", "--as", "Amy Wise", "--enterprise", enterpriseId])).toContain("Add --no-ai to turn it on, or --leave-ai-off");
      expect(rowCounts()).toEqual(counted);
      expect(before.work_records + 1).toBe(counted.work_records);

      const turnedOn = createWork({ enterpriseId, name: "Moles Big Day", kind: "book", separate: true, noAiAfterDeclining: true, actor: undefined, as: "Amy Wise" });
      if (!("work" in turnedOn)) throw new Error("not opened");
      expect(turnedOn.work).toMatchObject({ noAi: true });
      expect(turnedOn.work.replacesWorkId).toBeUndefined();
      const leftOff = createWork({ enterpriseId, name: "Moles Big Day", kind: "book", separate: true, noAiAfterDeclining: false, actor: undefined, as: "Amy Wise" });
      if (!("work" in leftOff)) throw new Error("not opened");
      expect(leftOff.work.noAi).toBe(false);
      // Taking the link keeps "no AI".
      const linked = createWork({ enterpriseId, name: "Moles Big Day", kind: "book", replacesWorkId: old.id, actor: undefined, as: "Amy Wise" });
      if (!("work" in linked)) throw new Error(JSON.stringify(linked));
      expect(linked.work).toMatchObject({ noAi: true, replacesWorkId: old.id, carryOver: { checked: true, noAi: true } });
    });

    it("a cancelled deal is matched, and replaced, only within the same book", () => {
      const book = open({ name: "Mole's Big Day", kind: "book" });
      const other = open({ name: "Wind in the Willows", kind: "book" });
      const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
      cancelWork({ workId: deal.id, reason: "Fell through.", actor: undefined, as: "Amy Wise" });
      expect(createWork({ enterpriseId, name: "German rights", kind: "deal", parentWorkId: other.id, actor: undefined, as: "Amy Wise" })).toHaveProperty("work");
      expect(createWork({ enterpriseId, name: "german rights", kind: "deal", parentWorkId: book.id, actor: undefined, as: "Amy Wise" })).toHaveProperty("prompt");
      expect(createWork({ enterpriseId, name: "German rights again", kind: "deal", parentWorkId: other.id, replacesWorkId: deal.id, actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("replaces_other_book"));
      expect(createWork({ enterpriseId, name: "German rights", kind: "book", replacesWorkId: deal.id, actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("replaces_other_kind"));
      const replaced = createWork({ enterpriseId, name: "German rights", kind: "deal", parentWorkId: book.id, replacesWorkId: deal.id, actor: undefined, as: "Amy Wise" });
      expect(replaced).toMatchObject({ work: { replacesWorkId: deal.id, carryOver: { checked: true, noAi: false } } });
    });

    it("open work is never replaced", () => {
      const book = open({ name: "Mole's Big Day", kind: "book" });
      expect(createWork({ enterpriseId, name: "Mole's Big Day 2", kind: "book", replacesWorkId: book.id, actor: undefined, as: "Amy Wise" })).toEqual(refusedWith("replaces_still_open"));
    });
  });
});
