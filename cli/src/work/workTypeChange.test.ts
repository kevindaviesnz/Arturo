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
import { accountFromSession, issueInvite, OWNER_CHANGE_ON_PAGE, redeemInvite, setRole, setSuspended, turnOnSignIn, type Account } from "../identity/companySignIn";
import { resolveConfiguredProvider } from "../llm/llmClient";
import { providerLabel } from "../llm/modelCatalog";
import { cancelJob, getJob, replaceJob, startJob } from "../runtime/jobQueue";
import { getPracticeSetting } from "./practiceSetting";
import { getWork, listWorkChanges, verifyWorkChangeLog } from "./workStore";
import { refuseWorkUnderLocks } from "./workLocks";
import { handleWorkCommand } from "./workCommands";
import { addTypeChangeReason, cancelWork, changeMatterType } from "./workChanges";
import { NO_REASON_GIVEN } from "./workRecord";
import { refuseTaskWithoutWork } from "./workLocks";
import { readResultSignOffStanding, recordResultSignOff } from "../runtime/resultSignOff";

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

describe("changing a matter's type (Grace's ruling, addendum 1)", () => {
  beforeEach(() => { setUp(); lawPractice(); });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const join = (code: string): Account => {
    const outcome = redeemInvite({ code, password: "a long enough password" });
    if ("refused" in outcome) throw new Error(outcome.refused);
    return accountFromSession(outcome.token)!;
  };
  const signedInOwner = (): Account => {
    const outcome = turnOnSignIn({ enterpriseId, owner: "Amy Wise" });
    if ("refused" in outcome) throw new Error(outcome.refused);
    return join(outcome.code);
  };
  const signedInMember = (amy: Account): Account => {
    const invite = issueInvite({ enterpriseId, person: "Sam Paralegal", actor: amy });
    if ("refused" in invite) throw new Error(invite.refused);
    return join(invite.code);
  };
  let numbers = 0;
  const matter = (matterType: string, extra: Partial<CreateWorkInput> = {}) =>
    open({ name: `Matter ${++numbers}`, kind: "matter", matterType, matterNumber: `HL-${numbers}`, ...extra });
  const lastChange = (workId: string) => listWorkChanges(enterpriseId, workId).at(-1);

  it("never changes a locked type to an unlocked one, for the owner on the page or at the terminal, before any write", () => {
    const will = matter("will");
    const amy = signedInOwner();
    const before = rowCounts();
    for (const actor of [amy, undefined]) {
      expect(changeMatterType({ workId: will.id, matterType: "commercial", reason: "Opened wrongly.", actor, as: "Amy Wise" })).toMatchObject({ refusal: { code: "type_locked_to_unlocked" } });
    }
    expect(changeMatterType({ workId: will.id, matterType: "commercial", reason: "Opened wrongly.", actor: amy })).toMatchObject({
      refused: "Will work can't be changed to an unlocked type. If it was opened with the wrong type, cancel it with a reason and open a new matter.",
    });
    expect(handleWorkCommand(["type", will.id, "commercial", "--as", "Amy Wise", "--reason", "Opened wrongly."])).toBe("A locked work type can't be changed to an unlocked one. Cancel the matter with a reason and open a new one.");
    expect(rowCounts()).toEqual(before);
    expect(getWork(will.id)).toMatchObject({ work: { matterType: "will" } });
  });

  it("changes a locked type to another locked type for anyone who can sign off, with a reason", () => {
    const dispute = matter("dispute");
    const before = rowCounts();
    expect(changeMatterType({ workId: dispute.id, matterType: "court", reason: "Filed in court.", actor: undefined, as: "Sam Paralegal" })).toMatchObject({ refusal: { code: "type_change_not_signer" } });
    expect(changeMatterType({ workId: dispute.id, matterType: "court", actor: undefined, as: "Amy Wise" })).toMatchObject({ refusal: { code: "reason_missing" } });
    expect(changeMatterType({ workId: dispute.id, matterType: "court", reason: "x".repeat(501), actor: undefined, as: "Amy Wise" })).toMatchObject({ refusal: { code: "reason_too_long" } });
    expect(rowCounts()).toEqual(before);
    expect(changeMatterType({ workId: dispute.id, matterType: "court", reason: "Filed in court.", actor: undefined, as: "Amy Wise" })).toMatchObject({ rule: "signer", reasonSaved: true });
    expect(getWork(dispute.id)).toMatchObject({ work: { matterType: "court", typeChangedAt: expect.any(Number) } });
    expect(lastChange(dispute.id)).toMatchObject({ what: "work type changed from dispute to court", by: "Amy Wise", reason: "Filed in court." });
    expect(refuseWorkUnderLocks({ workId: dispute.id, when: "create" })).toContain("never goes to an AI worker");
  });

  it("tightens for anyone at the business, with a reason that never holds up the lock", () => {
    const lease = matter("property");
    // No reason: locked, and logged as "No reason given", signed with who and when.
    expect(changeMatterType({ workId: lease.id, matterType: "dispute", actor: undefined, as: "Sam Paralegal" })).toMatchObject({ rule: "anyone", reasonSaved: true });
    expect(lastChange(lease.id)).toMatchObject({ by: "Sam Paralegal", reason: NO_REASON_GIVEN, at: expect.any(Number) });
    expect(refuseWorkUnderLocks({ workId: lease.id, when: "create" })).toContain("never goes to an AI worker");

    // A reason that can't be saved doesn't stop the lock; it can be added after, in its own signed entry.
    const other = matter("commercial");
    const locked = changeMatterType({ workId: other.id, matterType: "will", reason: "x".repeat(501), actor: undefined, as: "Sam Paralegal" });
    expect(locked).toMatchObject({ rule: "anyone", reasonSaved: false, message: expect.stringContaining("Locked. The reason couldn't be saved. You can add it to the log.") });
    expect(getWork(other.id)).toMatchObject({ work: { matterType: "will" } });
    const changedAt = (getWork(other.id) as { work: WorkRecord }).work.typeChangedAt!;
    expect(lastChange(other.id)).toMatchObject({ reason: NO_REASON_GIVEN });
    expect(addTypeChangeReason({ workId: other.id, reason: "", actor: undefined, as: "Sam Paralegal" })).toMatchObject({ refusal: { code: "reason_missing" } });
    expect(addTypeChangeReason({ workId: other.id, reason: "Client said it's a will.", actor: undefined, as: "Sam Paralegal" })).not.toHaveProperty("refused");
    expect(lastChange(other.id)).toMatchObject({ what: `reason added for the work type change at ${changedAt}`, by: "Sam Paralegal", reason: "Client said it's a will." });
    expect(verifyWorkChangeLog()).toBe(-1);
    // Somebody from elsewhere can't.
    expect(changeMatterType({ workId: matter("commercial").id, matterType: "will", actor: undefined, as: "Zed Other" })).toMatchObject({ refusal: { code: "not_at_business" } });
  });

  it("changes one unlocked type to another only for the owner, signed in, with a reason", () => {
    const lease = matter("property");
    const amy = signedInOwner();
    const sam = signedInMember(amy);
    expect(changeMatterType({ workId: lease.id, matterType: "commercial", reason: "A contract.", actor: undefined, as: "Amy Wise" })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
    expect(changeMatterType({ workId: lease.id, matterType: "commercial", reason: "A contract.", actor: sam })).toMatchObject({ refusal: { code: "owner_only" } });
    expect(changeMatterType({ workId: lease.id, matterType: "commercial", reason: " ", actor: amy })).toMatchObject({ refusal: { code: "reason_missing" } });
    expect(changeMatterType({ workId: lease.id, matterType: "commercial", reason: "A contract.", actor: amy })).toMatchObject({ rule: "owner" });
  });

  it("on every change: a sign-off falls away, queued Tasks are cancelled, a running result is set aside, and nothing is re-sent", () => {
    const lease = matter("property");
    const done = task("Draft the lease summary.", "--work", lease.id).taskId!;
    const running = task("Draft the lease letter.", "--work", lease.id).taskId!;
    const queued = task("Draft the lease memo.", "--work", lease.id).taskId!;
    replaceJob({ ...getJob(done)!, status: "completed", output: "The summary." });
    replaceJob({ ...getJob(running)!, status: "queued" });
    startJob(running);
    replaceJob({ ...getJob(queued)!, status: "queued" });
    recordResultSignOff(getJob(done)!, "Amy Wise");
    expect(readResultSignOffStanding(getJob(done)!).state).toBe("signed");

    const amy = signedInOwner();
    const changed = changeMatterType({ workId: lease.id, matterType: "commercial", reason: "A contract.", actor: amy });
    expect(changed).toMatchObject({ cancelled: [queued], willBeSetAside: [running], message: expect.stringContaining("Any sign-off on this matter falls away") });
    expect(getJob(queued)?.status).toBe("cancelled");
    expect(readResultSignOffStanding(getJob(done)!)).toMatchObject({ state: "superseded", workChanged: true });
    // The running Task goes no further: its result is set aside at the finish check.
    expect(refuseWorkUnderLocks({ workId: lease.id, when: "finish", taskCreatedAt: getJob(running)!.createdAt })).toContain("work type changed after this Task was created");
    // A Task asked for after the change goes on, and the result can be signed off again under the new type.
    expect(refuseWorkUnderLocks({ workId: lease.id, when: "start", taskCreatedAt: Date.now() + 1_000 })).toBeUndefined();
    recordResultSignOff(getJob(done)!, "Amy Wise");
    expect(readResultSignOffStanding(getJob(done)!).state).toBe("signed");
    // The suggestion list is rebuilt from the signed type.
    expect(changed).toMatchObject({ precedents: expect.any(Array) });
  });

  it("reopens a cancelled locked matter's number as an unlocked type only for the owner, with a reason and a signed link", () => {
    const will = matter("will", { name: "Estate of R. Hemi, will" });
    cancelWork({ workId: will.id, reason: "Opened with the wrong type.", actor: undefined, as: "Amy Wise" });
    const amy = signedInOwner();
    const sam = signedInMember(amy);
    const input = { enterpriseId, name: "R. Hemi, general advice", kind: "matter", matterNumber: will.matterNumber, matterType: "general-advice", replacesWorkId: will.id };
    const before = rowCounts();
    expect(createWork({ ...input, actor: sam })).toMatchObject({ refusal: { code: "owner_only" } });
    expect(createWork({ ...input, actor: undefined, as: "Amy Wise" })).toMatchObject({ refusal: { code: "owner_only" } });
    const prompt = createWork({ ...input, actor: amy });
    const provider = providerLabel(resolveConfiguredProvider().provider as Parameters<typeof providerLabel>[0]);
    expect(prompt).toMatchObject({ prompt: { kind: "reopen-unlocked", lockedType: "will", lines: [`This matter was opened as Will. Material for it can be sent to ${provider}.`, "It is signed and logged with a link to Estate of R. Hemi, will."] } });
    expect(createWork({ ...input, actor: amy, reopenReason: "  " })).toMatchObject({ refusal: { code: "reason_missing" } });
    expect(rowCounts()).toEqual(before);
    const opened = createWork({ ...input, actor: amy, reopenReason: "It was general advice, not a will." });
    if (!("work" in opened)) throw new Error(JSON.stringify(opened));
    expect(opened.work).toMatchObject({ matterType: "general-advice", replacesWorkId: will.id, carryOver: { from: will.id, checked: true, lockedType: "will", reopenedAs: "general-advice" } });
    expect(lastChange(opened.work.id)).toMatchObject({ by: "Amy Wise", reason: "It was general advice, not a will.", what: expect.stringContaining("reopened as an unlocked type (it was will)") });
    expect(refuseWorkUnderLocks({ workId: opened.work.id, when: "create" })).toBeUndefined();
    // The carry-over is signed: editing it breaks the record.
    runtimeDb.prepare("UPDATE work_records SET record_json = replace(record_json, '\"reopenedAs\":\"general-advice\"', '\"reopenedAs\":\"commercial\"') WHERE id = ?").run(opened.work.id);
    expect(getWork(opened.work.id).state).toBe("unverified");
  });

  it("names the other matter in a client's No AI refusal only while one person can sign in (Amy)", () => {
    matter("commercial", { name: "Smithers NDA", clientId, noAi: true });
    const ask = () => refuseTaskWithoutWork({ enterpriseId, clientId, hasDocuments: false, instruction: "Draft a letter." });
    expect(ask()).toContain("(Smithers NDA)");
    const amy = signedInOwner();
    expect(ask()).toContain("(Smithers NDA)");
    signedInMember(amy);
    expect(ask()).toBe('Jane Smithers has a matter with "no AI" on, so nothing for or naming them goes to an AI worker.');
  });
});
