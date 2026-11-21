import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearFunctionOrigins } from "../business/functionOrigin";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { createTask } from "../repl/taskRoutingCommands";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { clearPolicyRules } from "../storage/policyRepository";
import { runtimeDb } from "../storage/runtimeDatabase";
import { signOffTaskResult } from "../task/taskSignOff";
import { clearHandOffs } from "./handOff";
import { clearJobs, completeJob, listJobs } from "./jobQueue";
import {
  claimNextAction,
  clearNextActions,
  finishNextAction,
  getNextAction,
  recordNextAction,
  replayNextActions,
} from "./nextActions";
import { clearPassOns, passOnOf, setPassOn } from "./passOnRules";
import { clearResultSignOffs } from "./resultSignOff";
import { UNVERIFIED_MODEL_OUTPUT_PREFIX } from "./taskExecutor";
import { replayUnfinishedNextSteps } from "./workerRuntime";

const reset = () => {
  clearJobs(); clearResultSignOffs(); clearClients(); clearWorkers(); clearStaffingAssignments(); clearBusinessFunctions();
  clearBusinessFunctionDefinitions(); clearPolicyRules(); clearHandOffs(); clearFunctionOrigins(); clearPassOns(); clearEnterprises();
  clearNextActions();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

describe("the next-step record (C2)", () => {
  beforeEach(reset);
  afterEach(reset);

  it("is written once, claimed once, and marked done", () => {
    expect(recordNextAction("after-completion", "task-9", 1)).toBe(true);
    expect(recordNextAction("after-completion", "task-9", 2)).toBe(false);
    expect(claimNextAction("after-completion", "task-9")).toBe("claimed");
    expect(claimNextAction("after-completion", "task-9")).toBe("taken");
    expect(claimNextAction("after-completion", "task-10")).toBe("none");
    expect(finishNextAction("after-completion", "task-9")).toBe(true);
    expect(getNextAction("after-completion", "task-9")).toMatchObject({ state: "done", at: 1 });
  });

  it("replays only what was not done, a step left claimed by a stopped run included, and only once", async () => {
    recordNextAction("after-completion", "task-1");
    recordNextAction("after-completion", "task-2");
    recordNextAction("after-completion", "task-3");
    claimNextAction("after-completion", "task-2"); // claimed, then Arturo stopped
    claimNextAction("after-completion", "task-3");
    finishNextAction("after-completion", "task-3"); // already done
    const ran: string[] = [];
    const handlers = {
      "after-completion": (action: { sourceJobId: string }) => { ran.push(action.sourceJobId); },
      "after-sign-off": () => undefined,
      "outcome-follow-on": () => undefined,
      "event-task": () => undefined,
    };

    expect(await replayNextActions(handlers)).toBe(2);
    expect(await replayNextActions(handlers)).toBe(0);
    expect(ran).toEqual(["task-1", "task-2"]);
  });
});

describe("a restart between a Task finishing and what follows it", () => {
  let enterpriseId: string;
  const fn = (label: string) => listBusinessFunctionDefinitions().find((definition) => definition.label === label && definition.enterpriseId === enterpriseId)!.id;
  const area = (name: string, archetype: string) =>
    expect(setUpAreaFromPage({ enterpriseId, name, purpose: name, helperName: `${name} AI worker`, helperKind: "auto", archetype, approver: "Amy Wise", as: "Amy Wise" }).created).toBe(true);

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    [enterpriseId] = listEnterprises().map((enterprise) => enterprise.id);
    area("Drafting", "creator");
    area("Contract review", "reviewer");
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const ask = (instruction: string) => {
    const outcome = createTask([instruction, "--function", fn("Drafting"), "--enterprise", enterpriseId, "--asked-by", "Amy Wise"]);
    expect(outcome.created, outcome.message).toBe(true);
    return outcome.taskId!;
  };

  it("writes the next step with the completion, and after a restart makes exactly one next step", async () => {
    setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
    const draftId = ask("Draft a mutual NDA for Harbour St.");

    // The Task finishes, and Arturo stops before its completion hooks run.
    const draft = completeJob(draftId, "1. Parties.", `${UNVERIFIED_MODEL_OUTPUT_PREFIX}1. Parties.`);
    expect(getNextAction("after-completion", draft.id)).toMatchObject({ state: "pending", sourceJobId: draft.id });
    expect(passOnOf(draft.id)).toBeUndefined();
    expect(listJobs()).toHaveLength(1);

    // Start-up replays it: the result is passed on once.
    const quiet = () => undefined;
    expect(await replayUnfinishedNextSteps(quiet)).toBe(1);
    expect(listJobs()).toHaveLength(2);
    expect(passOnOf(draft.id)?.nextTaskId).toBe(listJobs()[1].id);
    expect(getNextAction("after-completion", draft.id)?.state).toBe("done");

    // A second start-up does nothing more.
    expect(await replayUnfinishedNextSteps(quiet)).toBe(0);
    expect(listJobs()).toHaveLength(2);
  });

  it("writes the step that follows a sign-off with the sign-off, and marks it done", () => {
    const draftId = ask("Draft a mutual NDA for Harbour St.");
    completeJob(draftId, "1. Parties.", `${UNVERIFIED_MODEL_OUTPUT_PREFIX}1. Parties.`);

    const signed = signOffTaskResult([draftId, "--as", "Amy Wise"]);

    expect(signed.signedOff, signed.message).toBe(true);
    expect(getNextAction("after-sign-off", draftId)).toMatchObject({ state: "done", by: "Amy Wise" });
  });
});
