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
import * as llmClient from "../llm/llmClient";
import { processNextQueuedJob } from "../runtime/workerRuntime";
import { getJob, replaceJob, startJob } from "../runtime/jobQueue";
import { readResultSetAsideStanding, verifyResultSetAsideSignature, createResultSetAsidePayload } from "../runtime/resultSetAside";
import { readResultSignOffStanding } from "../runtime/resultSignOff";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { signOffTaskResult } from "../task/taskSignOff";
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

describe("named work checked again as a Task starts, finishes and is signed off", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const quiet = () => undefined;

  it("start check cancels a queued deal after its book turns no AI", async () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const deal = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    const queued = task("Draft the German offer.", "--work", deal.id).taskId!;
    // Locked by an edit nobody signed, so nothing cancelled it when it happened.
    runtimeDb.prepare("UPDATE work_records SET record_json = json_set(record_json, '$.noAi', json('true')) WHERE id = ?").run(book.id);
    const model = vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({ response: "An offer.", model: "test" } as never);
    const outcome = await processNextQueuedJob(quiet);
    expect(outcome?.id).toBe(queued);
    expect(getJob(queued)).toMatchObject({ status: "cancelled", error: expect.stringContaining("Cancelled before it started") });
    expect(model).not.toHaveBeenCalled();
  });

  it("startJob backstop throws for a locked work-bound job", () => {
    const work = open({ name: "First", kind: "work" });
    const queued = task("Draft a note.", "--work", work.id).taskId!;
    runtimeDb.prepare("UPDATE work_records SET record_json = json_set(record_json, '$.noAi', json('true')) WHERE id = ?").run(work.id);
    expect(() => startJob(queued)).toThrow("was not started");
    expect(getJob(queued)?.status).toBe("queued");
  });

  it("toggle while children run: the queued deal is cancelled at once, the running one is set aside by the system and can't be signed off", async () => {
    const book = open({ name: "Mole's Big Day", kind: "book" });
    const dealA = open({ name: "German rights", kind: "deal", parentWorkId: book.id });
    const dealB = open({ name: "French rights", kind: "deal", parentWorkId: book.id });
    const a = task("Draft the German offer.", "--work", dealA.id).taskId!;
    const b = task("Draft the French offer.", "--work", dealB.id).taskId!;
    let cancelledWhileRunning: string[] = [];
    vi.spyOn(llmClient, "generateWithConfiguredLlm").mockImplementation(async () => {
      // "No AI" goes on for the book while deal A's Task is with the model.
      const outcome = setWorkNoAi({ workId: book.id, noAi: true, actor: undefined, as: "Amy Wise" });
      if ("refused" in outcome) throw new Error(outcome.refused);
      cancelledWhileRunning = outcome.cancelled;
      expect(outcome.willBeSetAside).toEqual([a]);
      return { response: "An offer.", model: "test" } as never;
    });
    const finished = await processNextQueuedJob(quiet);
    expect(finished?.id).toBe(a);
    expect(cancelledWhileRunning).toEqual([b]);
    expect(getJob(b)?.status).toBe("cancelled");

    const standing = readResultSetAsideStanding(getJob(a)!);
    expect(standing.state).toBe("set_aside");
    if (standing.state !== "set_aside") return;
    expect(standing.setAside).toMatchObject({ worker: "Arturo", bySystem: true });
    expect(standing.setAside.userId).toBeUndefined();
    expect(createResultSetAsidePayload(standing.setAside)).toContain("result-set-aside-system");
    // Never verifies as a person's set-aside.
    const { bySystem: _system, ...asPerson } = standing.setAside;
    expect(verifyResultSetAsideSignature(asPerson, getLocalApprovalSigningSecret())).toBe(false);

    expect(signOffTaskResult([a, "--as", "Amy Wise"])).toMatchObject({ signedOff: false, message: expect.stringContaining("Arturo set") });
    expect(readResultSignOffStanding(getJob(a)!).state).not.toBe("signed");
  });

  it("sign-off refused after no AI turned on post go-ahead, nothing recorded", () => {
    const work = open({ name: "First", kind: "work" });
    const id = task("Draft a note.", "--work", work.id).taskId!;
    replaceJob({ ...getJob(id)!, status: "completed", output: "A note.", rawOutput: "A note.", completedAt: Date.now() });
    // Locked without the set-aside a finish check would make, so only the sign-off check stands in the way.
    runtimeDb.prepare("UPDATE work_records SET record_json = json_set(record_json, '$.noAi', json('true')) WHERE id = ?").run(work.id);
    const before = rowCounts();
    const terminal = signOffTaskResult([id, "--as", "Amy Wise"]);
    expect(terminal).toMatchObject({ signedOff: false, message: expect.stringContaining("Nothing was recorded.") });
    expect(terminal.message).toContain("does not verify");
    expect(rowCounts()).toEqual(before);
  });
});
