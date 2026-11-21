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
import { addMatterType, allowPaidEscalation, changeMatterType, describeNoAiEffects, noAiOffConfirmLine, setLawPractice, setWorkNoAi, unlockMatterType } from "./workChanges";

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

describe("changing named work", () => {
  beforeEach(setUp);
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

  describe("the law-practice setting", () => {
    it("turning on needs sign-in on", () => {
      expect(setLawPractice({ enterpriseId, on: true, actor: undefined })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      const amy = signedInOwner();
      const outcome = setLawPractice({ enterpriseId, on: true, actor: amy });
      expect(outcome).not.toHaveProperty("refused");
      expect(getPracticeSetting(enterpriseId)).toMatchObject({ lawPractice: true, state: "verified" });
    });

    it("turning off needs owner and a reason", () => {
      const amy = signedInOwner();
      setLawPractice({ enterpriseId, on: true, actor: amy });
      const sam = signedInMember(amy);
      expect(setLawPractice({ enterpriseId, on: false, reason: "No longer a practice.", actor: sam })).toHaveProperty("refused");
      expect(setLawPractice({ enterpriseId, on: false, reason: "No longer a practice.", actor: undefined })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      expect(setLawPractice({ enterpriseId, on: false, actor: amy })).toMatchObject({ refused: expect.stringContaining("reason") });
      expect(getPracticeSetting(enterpriseId).lawPractice).toBe(true);
      expect(setLawPractice({ enterpriseId, on: false, reason: "We closed the practice.", actor: amy })).not.toHaveProperty("refused");
      expect(getPracticeSetting(enterpriseId).lawPractice).toBe(false);
      expect(listWorkChanges(enterpriseId).map((one) => one.reason)).toContain("We closed the practice.");
    });

    it("an unverified setting reads as on, and can't be changed", () => {
      const amy = signedInOwner();
      setLawPractice({ enterpriseId, on: true, actor: amy });
      runtimeDb.prepare("UPDATE practice_settings SET record_json = replace(record_json, '\"lawPractice\":true', '\"lawPractice\":false')").run();
      expect(getPracticeSetting(enterpriseId)).toMatchObject({ lawPractice: true, state: "unverified" });
      expect(setLawPractice({ enterpriseId, on: false, reason: "Trying.", actor: amy })).toHaveProperty("refused");
    });

    it("an owner-added matter type starts locked, has no \"Other\", and is unlocked only with a reason; a fixed type never is", () => {
      const amy = signedInOwner();
      expect(addMatterType({ enterpriseId, id: "trusts", label: "Trusts", actor: undefined })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      expect(addMatterType({ enterpriseId, id: "other", label: "Other", actor: amy })).toHaveProperty("refused");
      expect(addMatterType({ enterpriseId, id: "trusts", label: "Trusts", actor: amy })).not.toHaveProperty("refused");
      expect(getPracticeSetting(enterpriseId).customMatterTypes).toEqual([{ id: "trusts", label: "Trusts", locked: true }]);
      const matter = open({ name: "Family trust", kind: "matter", matterType: "trusts" });
      expect(refuseWorkUnderLocks({ workId: matter.id, when: "create" })).toContain("never goes to an AI worker");
      expect(unlockMatterType({ enterpriseId, id: "trusts", reason: "", actor: amy })).toHaveProperty("refused");
      expect(unlockMatterType({ enterpriseId, id: "will", reason: "Please.", actor: amy })).toMatchObject({ refused: expect.stringContaining("no off switch") });
      const unlockedAt = Date.now() + 1_000;
      expect(unlockMatterType({ enterpriseId, id: "trusts", reason: "Simple trusts only.", actor: amy, now: unlockedAt })).toMatchObject({ message: expect.stringContaining("Matters already open as Trusts stay locked.") });
      expect(getPracticeSetting(enterpriseId).customMatterTypes).toEqual([{ id: "trusts", label: "Trusts", locked: false, unlockedAt }]);
      // Unlocking applies only to matters opened afterwards (Grace).
      expect(refuseWorkUnderLocks({ workId: matter.id, when: "create" })).toContain("never goes to an AI worker");
      const later = open({ name: "Second trust", kind: "matter", matterType: "trusts", now: unlockedAt + 1 });
      expect(refuseWorkUnderLocks({ workId: later.id, when: "create" })).toBeUndefined();
    });
  });

  describe('"no AI"', () => {
    it("is turned on by anyone working at the business, at the terminal too, with no reason, cancelling every not-started Task on the work and its deals", () => {
      const book = open({ name: "Mole's Big Day", kind: "book" });
      const dealA = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
      const dealB = open({ name: "French rights", kind: "deal", parentWorkId: book.id });
      const running = task("Draft the German offer.", "--work", dealA.id).taskId!;
      const queued = task("Draft the French offer.", "--work", dealB.id).taskId!;
      const elsewhere = task("Draft the office leave policy.").taskId!;
      replaceJob({ ...getJob(running)!, status: "queued" });
      startJob(running);
      expect(describeNoAiEffects(book.id)).toMatchObject({ cancellable: [queued], running: [running] });
      // Who it is must be said, and be someone at this business.
      expect(setWorkNoAi({ workId: book.id, noAi: true, actor: undefined })).toMatchObject({ refused: expect.stringContaining("--as") });
      expect(setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Zed Other" })).toMatchObject({ refused: expect.stringContaining("Nobody called Zed Other") });
      expect(describeNoAiEffects(book.id).cancellable).toEqual([queued]);
      // Sam can't sign off work, but works here: that is enough to turn it on.
      const outcome = setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Sam Paralegal" });
      expect(outcome).toMatchObject({ cancelled: [queued], willBeSetAside: [running] });
      expect(getJob(queued)).toMatchObject({ status: "cancelled", cancelledAt: expect.any(Number) });
      expect(getJob(running)?.status).toBe("running");
      expect(getJob(elsewhere)?.status).not.toBe("cancelled");
      expect(() => cancelJob(running, "no")).toThrow();
      expect(listWorkChanges(enterpriseId, book.id).at(-1)).toMatchObject({ what: 'turned "no AI" on', by: "Sam Paralegal" });
      expect(listWorkChanges(enterpriseId, book.id).at(-1)).not.toHaveProperty("reason");
    });

    it("is turned on from the page by any signed-in person at the business, not a suspended one and not another business's", () => {
      const work = open({ name: "First", kind: "work" });
      const amy = signedInOwner();
      const sam = signedInMember(amy);
      expect(setWorkNoAi({ workId: work.id, noAi: true, actor: { ...sam, roles: new Map([[otherId, "member"]]) } })).toMatchObject({ refused: "That is not part of your business." });
      expect(setWorkNoAi({ workId: work.id, noAi: true, actor: sam })).not.toHaveProperty("refused");
      expect(getWork(work.id)).toMatchObject({ work: { noAi: true, changedBy: "Sam Paralegal" } });
      const second = open({ name: "Second", kind: "work" });
      expect(setSuspended({ enterpriseId, person: "Sam Paralegal", suspended: true, actor: amy })).not.toHaveProperty("refused");
      expect(setWorkNoAi({ workId: second.id, noAi: true, actor: undefined, as: "Sam Paralegal" })).toMatchObject({ refused: expect.stringContaining("suspended") });
    });

    it("is turned off only by the owner, signed in, with a typed reason signed into the log", () => {
      const work = open({ name: "First", kind: "work", noAi: true });
      const reason = "client withdrew opt-out by email 14 Nov";
      expect(setWorkNoAi({ workId: work.id, noAi: false, actor: undefined, reason })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      const amy = signedInOwner();
      const sam = signedInMember(amy);
      expect(setWorkNoAi({ workId: work.id, noAi: false, actor: sam, reason })).toHaveProperty("refused");
      const before = rowCounts();
      for (const missing of [undefined, "", "   "]) {
        expect(setWorkNoAi({ workId: work.id, noAi: false, actor: amy, reason: missing })).toMatchObject({ refused: expect.stringContaining("Give a reason") });
      }
      expect(rowCounts()).toEqual(before);
      expect(getWork(work.id)).toMatchObject({ work: { noAi: true } });
      const outcome = setWorkNoAi({ workId: work.id, noAi: false, actor: amy, reason });
      expect(outcome).toMatchObject({ message: expect.stringContaining(noAiOffConfirmLine()) });
      expect(getWork(work.id)).toMatchObject({ work: { noAi: false, version: 2, changedBy: "Amy Wise" } });
      expect(listWorkChanges(enterpriseId, work.id).at(-1)).toMatchObject({ what: 'turned "no AI" off', by: "Amy Wise", byUserId: amy.userId, reason, at: expect.any(Number) });
      expect(verifyWorkChangeLog()).toBe(-1);
      // The reason is signed: editing it breaks the log.
      runtimeDb.prepare("UPDATE work_changes SET record_json = replace(record_json, '14 Nov', '15 Nov') WHERE seq = (SELECT max(seq) FROM work_changes)").run();
      expect(verifyWorkChangeLog()).toBeGreaterThanOrEqual(0);
    });

    it("the off confirm line names the configured provider", () => {
      expect(noAiOffConfirmLine()).toBe(`Material for this matter can be sent to ${providerLabel(resolveConfiguredProvider().provider as Parameters<typeof providerLabel>[0])} again.`);
      expect(noAiOffConfirmLine()).toMatch(/^Material for this matter can be sent to \S.* again\.$/);
    });

    it("an admin is not the owner", () => {
      const work = open({ name: "First", kind: "work", noAi: true });
      const amy = signedInOwner();
      const sam = signedInMember(amy);
      expect(setRole({ enterpriseId, person: "Sam Paralegal", role: "admin", actor: amy })).not.toHaveProperty("refused");
      const admin: Account = { ...sam, roles: new Map([[enterpriseId, "admin"]]) };
      expect(setWorkNoAi({ workId: work.id, noAi: false, actor: admin })).toHaveProperty("refused");
    });
  });

  describe("owner-only changes", () => {
    it("a matter's type is changed from one unlocked type to another only by the owner, with a reason, and is logged", () => {
      const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1" });
      expect(changeMatterType({ workId: matter.id, matterType: "commercial", reason: "It became a contract.", actor: undefined })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      const amy = signedInOwner();
      expect(changeMatterType({ workId: matter.id, matterType: "commercial", reason: "", actor: amy })).toMatchObject({ refusal: { code: "reason_missing" } });
      expect(changeMatterType({ workId: matter.id, matterType: "commercial", reason: "It became a contract.", actor: amy })).toMatchObject({ rule: "owner" });
      expect(listWorkChanges(enterpriseId, matter.id).at(-1)).toMatchObject({ by: "Amy Wise", reason: "It became a contract." });
      // Tightening is anyone's, and the lock holds at once.
      expect(changeMatterType({ workId: matter.id, matterType: "dispute", reason: "It became a dispute.", actor: amy })).toMatchObject({ rule: "anyone" });
      expect(refuseWorkUnderLocks({ workId: matter.id, when: "create" })).toContain("never goes to an AI worker");
      expect(listWorkChanges(enterpriseId, matter.id).at(-1)).toMatchObject({ by: "Amy Wise", reason: "It became a dispute." });
    });

    it("paid escalation is switched on only by the owner, with a typed reason, and is stored, off by default", () => {
      const work = open({ name: "First", kind: "work" });
      expect(getWork(work.id)).toMatchObject({ work: { paidEscalationAllowed: false } });
      expect(allowPaidEscalation({ workId: work.id, allowed: true, actor: undefined, reason: "Long contract." })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      const amy = signedInOwner();
      const before = rowCounts();
      expect(allowPaidEscalation({ workId: work.id, allowed: true, actor: amy })).toMatchObject({ refused: expect.stringContaining("Give a reason") });
      expect(allowPaidEscalation({ workId: work.id, allowed: true, actor: amy, reason: " " })).toHaveProperty("refused");
      expect(rowCounts()).toEqual(before);
      expect(allowPaidEscalation({ workId: work.id, allowed: true, actor: amy, reason: "Long contract the local model can't hold." })).not.toHaveProperty("refused");
      expect(getWork(work.id)).toMatchObject({ work: { paidEscalationAllowed: true } });
      expect(listWorkChanges(enterpriseId, work.id).at(-1)).toMatchObject({ what: "paid escalation switched on", by: "Amy Wise", reason: "Long contract the local model can't hold." });
      // Switching it off is the safe direction and needs no reason.
      expect(allowPaidEscalation({ workId: work.id, allowed: false, actor: undefined })).not.toHaveProperty("refused");
    });

    it("unlocking a matter type, the fifth owner-only change, needs a non-empty typed reason signed into its log entry", () => {
      const amy = signedInOwner();
      expect(addMatterType({ enterpriseId, id: "trusts", label: "Trusts", actor: amy })).not.toHaveProperty("refused");
      expect(unlockMatterType({ enterpriseId, id: "trusts", reason: "Simple trusts only.", actor: undefined })).toMatchObject({ refused: OWNER_CHANGE_ON_PAGE, refusal: { code: "owner_only" } });
      const before = rowCounts();
      for (const missing of ["", "   ", "\n\t"]) {
        expect(unlockMatterType({ enterpriseId, id: "trusts", reason: missing, actor: amy })).toMatchObject({ refused: expect.stringContaining("Give a reason") });
      }
      expect(rowCounts()).toEqual(before);
      expect(getPracticeSetting(enterpriseId).customMatterTypes).toEqual([{ id: "trusts", label: "Trusts", locked: true }]);
      expect(unlockMatterType({ enterpriseId, id: "trusts", reason: "Simple family trusts only.", actor: amy })).not.toHaveProperty("refused");
      expect(listWorkChanges(enterpriseId).at(-1)).toMatchObject({ what: "matter type trusts unlocked", by: "Amy Wise", byUserId: amy.userId, reason: "Simple family trusts only.", at: expect.any(Number) });
      expect(verifyWorkChangeLog()).toBe(-1);
      runtimeDb.prepare("UPDATE work_changes SET record_json = replace(record_json, 'Simple family', 'Any') WHERE seq = (SELECT max(seq) FROM work_changes)").run();
      expect(verifyWorkChangeLog()).toBeGreaterThanOrEqual(0);
    });

    it("the six built-in locked types can never be unlocked, by the owner on the page or at the terminal, before any write", () => {
      const amy = signedInOwner();
      const before = rowCounts();
      for (const id of ["will", "court", "dispute", "enduring-power-of-attorney", "estate-administration", "relationship-property"]) {
        for (const actor of [amy, undefined]) {
          expect(unlockMatterType({ enterpriseId, id, reason: "Client asked.", actor }), `${id} ${actor ? "page" : "terminal"}`).toMatchObject({ refused: expect.stringContaining("no off switch") });
        }
        expect(handleWorkCommand(["matter-type", "unlock", id, "--reason", "Client asked.", "--enterprise", enterpriseId])).toContain("no off switch");
        expect(refuseWorkUnderLocks({ workId: open({ name: `A ${id} matter`, kind: "matter", matterType: id, matterNumber: `HL-${id}` }).id, when: "create" })).toContain("never goes to an AI worker");
      }
      // Built-in unlocked types aren't the owner's to lock or unlock either.
      expect(unlockMatterType({ enterpriseId, id: "commercial", reason: "Why not.", actor: amy })).toMatchObject({ refused: expect.stringContaining("no added matter type") });
      const after = rowCounts();
      expect({ ...after, work_records: before.work_records, work_changes: before.work_changes }).toEqual(before);
      expect(getPracticeSetting(enterpriseId).customMatterTypes).toEqual([]);
    });

    it("all four owner-only changes Grace named need a typed reason, signed into their log entry", () => {
      const amy = signedInOwner();
      setLawPractice({ enterpriseId, on: true, actor: amy });
      const matter = open({ name: "Smithers lease", kind: "matter", matterType: "property", matterNumber: "HL-1", noAi: true });
      const attempts = [
        () => setWorkNoAi({ workId: matter.id, noAi: false, actor: amy, reason: "" }),
        () => changeMatterType({ workId: matter.id, matterType: "commercial", reason: "", actor: amy }),
        () => allowPaidEscalation({ workId: matter.id, allowed: true, actor: amy, reason: "" }),
        () => setLawPractice({ enterpriseId, on: false, actor: amy, reason: "" }),
      ];
      for (const attempt of attempts) expect(attempt()).toMatchObject({ refused: expect.stringContaining("Give a reason") });
      expect(setWorkNoAi({ workId: matter.id, noAi: false, actor: amy, reason: "client withdrew opt-out by email 14 Nov" })).not.toHaveProperty("refused");
      expect(changeMatterType({ workId: matter.id, matterType: "commercial", reason: "It is a supply agreement.", actor: amy })).not.toHaveProperty("refused");
      expect(allowPaidEscalation({ workId: matter.id, allowed: true, actor: amy, reason: "Long contract." })).not.toHaveProperty("refused");
      expect(setLawPractice({ enterpriseId, on: false, actor: amy, reason: "Closing the practice." })).not.toHaveProperty("refused");
      expect(listWorkChanges(enterpriseId).slice(-4).map((one) => [one.by, one.reason])).toEqual([
        ["Amy Wise", "client withdrew opt-out by email 14 Nov"],
        ["Amy Wise", "It is a supply agreement."],
        ["Amy Wise", "Long contract."],
        ["Amy Wise", "Closing the practice."],
      ]);
      expect(verifyWorkChangeLog()).toBe(-1);
    });
  });
});
