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
import * as sendLog from "./workSendLog";
import { executeWorkerJob } from "../runtime/taskExecutor";
import { getJob, startJob } from "../runtime/jobQueue";
import { listWorkSends, verifyWorkSend } from "./workSendLog";
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

describe("the send log", () => {
  beforeEach(setUp);
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const runningTaskOn = (workId: string) => {
    const created = task("Draft a short note.", "--work", workId);
    expect(created.created).toBe(true);
    return startJob(created.taskId!);
  };
  const sendRows = () => (runtimeDb.prepare("SELECT count(*) AS n FROM work_sends").get() as { n: number }).n;

  it("a send is logged before the model is called, with provider and item SHA-256", async () => {
    const work = open({ name: "First", kind: "work" });
    const running = runningTaskOn(work.id);
    const seenAtCall: number[] = [];
    const model = vi.spyOn(llmClient, "generateWithConfiguredLlm").mockImplementation(async () => {
      seenAtCall.push(sendRows());
      return { response: "A note.", model: "test" } as never;
    });
    const done = await executeWorkerJob(running, "test-model");
    expect(done.status).toBe("completed");
    expect(model).toHaveBeenCalledTimes(1);
    expect(seenAtCall).toEqual([1]);
    const { sends, unverified } = listWorkSends([work.id]);
    expect(unverified).toBe(0);
    expect(sends).toEqual([expect.objectContaining({ jobId: running.id, workId: work.id, call: 1, provider: expect.any(String), routingMode: expect.any(String), items: [] })]);
    expect(verifyWorkSend(sends[0])).toBe(true);
  });

  it("names each item it carries by its SHA-256, and refuses one it can't name", () => {
    expect(() => sendLog.itemsSentFor({ inputArtefactRefs: ["artefact-nonesuch@1"] })).toThrow("cannot be identified for the send log");
  });

  it("a log write failure fails the task with no model call", async () => {
    const work = open({ name: "First", kind: "work" });
    const running = runningTaskOn(work.id);
    vi.spyOn(sendLog, "recordWorkSend").mockImplementation(() => { throw new Error("disk full"); });
    const model = vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({ response: "A note.", model: "test" } as never);
    const done = await executeWorkerJob(running, "test-model");
    expect(done.status).toBe("failed");
    expect(model).not.toHaveBeenCalled();
  });

  it("no-AI flipped between start and send → no call", async () => {
    const work = open({ name: "First", kind: "work" });
    const running = runningTaskOn(work.id);
    setWorkNoAi({ workId: work.id, noAi: true, actor: undefined, as: "Amy Wise" });
    const model = vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({ response: "A note.", model: "test" } as never);
    const done = await executeWorkerJob(running, "test-model");
    expect(done.status).toBe("failed");
    expect(done.error).toContain('"No AI" is on');
    expect(model).not.toHaveBeenCalled();
    expect(sendRows()).toBe(0);
  });

  it("an edited send no longer verifies and is counted as such", async () => {
    const work = open({ name: "First", kind: "work" });
    const running = runningTaskOn(work.id);
    vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({ response: "A note.", model: "test" } as never);
    await executeWorkerJob(running, "test-model");
    runtimeDb.prepare("UPDATE work_sends SET record_json = json_set(record_json, '$.provider', 'somewhere-else')").run();
    expect(listWorkSends([work.id])).toMatchObject({ sends: [], unverified: 1 });
  });

  it("a Task on no named work is not logged", async () => {
    const created = task("Draft the office leave policy.");
    const running = startJob(created.taskId!);
    vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({ response: "A policy.", model: "test" } as never);
    expect((await executeWorkerJob(running, "test-model")).status).toBe("completed");
    expect(sendRows()).toBe(0);
  });
});
