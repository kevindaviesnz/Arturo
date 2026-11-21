import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearFunctionOrigins } from "../business/functionOrigin";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearHandOffs } from "../runtime/handOff";
import { MAX_CHAIN_DEPTH } from "../runtime/chainLimits";
import { clearJobs, getJob, listJobs, replaceJob } from "../runtime/jobQueue";
import { clearPassOns } from "../runtime/passOnRules";
import { clearResultSignOffs } from "../runtime/resultSignOff";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { clearPolicyRules } from "../storage/policyRepository";
import { runtimeDb } from "../storage/runtimeDatabase";
import { chainDepthRefusal, createTask } from "./taskRoutingCommands";

const reset = () => {
  clearJobs(); clearResultSignOffs(); clearClients(); clearWorkers(); clearStaffingAssignments(); clearBusinessFunctions();
  clearBusinessFunctionDefinitions(); clearPolicyRules(); clearHandOffs(); clearFunctionOrigins(); clearPassOns(); clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

// S2: one chain counter for every path. createTask stamps it on a Task that
// follows another, and refuses past MAX_CHAIN_DEPTH with a fixed code.
describe("the chain counter on createTask --follows", () => {
  let enterpriseId: string;
  const drafting = () => listBusinessFunctionDefinitions().find((definition) => definition.label === "Drafting" && definition.enterpriseId === enterpriseId)!.id;

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    [enterpriseId] = listEnterprises().map((enterprise) => enterprise.id);
    expect(setUpAreaFromPage({ enterpriseId, name: "Drafting", purpose: "Drafting", helperName: "Drafting AI worker", helperKind: "auto", archetype: "creator", approver: "Amy Wise", as: "Amy Wise" }).created).toBe(true);
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const ask = (instruction: string, extra: string[] = []) =>
    createTask([instruction, "--function", drafting(), "--enterprise", enterpriseId, "--asked-by", "Amy Wise", ...extra]);
  // A finished result nobody needs to sign off (not written by an AI model), at a given depth.
  const finishedAt = (depth: number) => {
    const outcome = ask("Draft the heads of terms.");
    expect(outcome.created, outcome.message).toBe(true);
    return replaceJob({ ...getJob(outcome.taskId!)!, status: "completed", output: "Heads of terms.", completedAt: Date.now(), followUpDepth: depth }).id;
  };

  it("starts a person's Task at the bottom of a chain", () => {
    const outcome = ask("Draft the heads of terms.");
    expect(outcome.created).toBe(true);
    expect(getJob(outcome.taskId!)?.followUpDepth ?? 0).toBe(0);
  });

  it("stamps a Task that follows another one deeper than it", () => {
    const first = finishedAt(0);
    const second = ask("Check the heads of terms.", ["--follows", first]);
    expect(second.created, second.message).toBe(true);
    expect(getJob(second.taskId!)?.followUpDepth).toBe(1);

    const deep = finishedAt(MAX_CHAIN_DEPTH - 1);
    const last = ask("Check the heads of terms.", ["--follows", deep]);
    expect(last.created, last.message).toBe(true);
    expect(getJob(last.taskId!)?.followUpDepth).toBe(MAX_CHAIN_DEPTH);
  });

  it("refuses a Task that would go deeper than the most Arturo carries on, with a fixed code and wording", () => {
    const deepest = finishedAt(MAX_CHAIN_DEPTH);
    const before = listJobs().length;

    const refused = ask("Check the heads of terms.", ["--follows", deepest]);

    expect(refused).toEqual({ created: false, code: "chain_depth_exceeded", message: chainDepthRefusal(deepest) });
    expect(refused.message).toBe(`${deepest} is already 6 steps deep in a chain of work, the most Arturo carries on from one request, so no task follows it. Nothing was started. Read it, and ask for the next step as new work if it is still needed.`);
    expect(listJobs()).toHaveLength(before);
  });
});
