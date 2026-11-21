import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { createEnterpriseFunction } from "../business/businessFunctionCreation";
import { clearFunctionOrigins } from "../business/functionOrigin";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { addEnterprisePerson as addPersonFromPage, setUpEnterpriseArea as setUpAreaFromPage } from "../testing/cliTestSetup";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, getEnterprise, listEnterprises } from "../enterprise/enterpriseStore";
import { createTask } from "../repl/taskRoutingCommands";
import { clearStaffingAssignments, removeStaffingAssignmentsForFunction } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearPolicyRules } from "../storage/policyRepository";
import { signOffTaskResult } from "../task/taskSignOff";
import { handleUiFunctionUpdateSubcommand } from "../ui/uiCommandHandlers";
import { clearHandOffs } from "./handOff";
import { clearJobs, getJob, listJobs, replaceJob } from "./jobQueue";
import { clearPassOns, describePassOn, getPassOnChoice, getPassOnRule, passOnChecking, passOnOf, readPassOnView, setPassOn } from "./passOnRules";
import { WEB_STEP_STOPS, checkInstruction, deliverPassOn, otherClientsNamed, stopRoute } from "./resultPassOn";
import { clearResultSignOffs, readResultSignOffStanding } from "./resultSignOff";
import { loadPassOnRule, savePassOnRule } from "../storage/passOnRepository";
import { loadResultSignOff, saveResultSignOff } from "../storage/resultSignOffRepository";
import { addClientRecord } from "../clients/clientStore";
import { UNVERIFIED_MODEL_OUTPUT_PREFIX } from "./taskExecutor";

const reset = () => {
  clearJobs(); clearResultSignOffs(); clearClients(); clearWorkers(); clearStaffingAssignments(); clearBusinessFunctions();
  clearBusinessFunctionDefinitions(); clearPolicyRules(); clearHandOffs(); clearFunctionOrigins(); clearPassOns(); clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

describe("passing a result on to be checked before a person signs it off", () => {
  let enterpriseId: string;
  let otherId: string;
  const fn = (label: string) => listBusinessFunctionDefinitions().find((definition) => definition.label === label && definition.enterpriseId === enterpriseId)!.id;
  const area = (name: string, archetype: string, forEnterprise = () => enterpriseId, as = "Amy Wise") =>
    expect(setUpAreaFromPage({ enterpriseId: forEnterprise(), name, purpose: name, helperName: `${name} AI worker`, helperKind: "auto", archetype, approver: as, as }).created).toBe(true);

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    setUpBusiness(["Elsewhere Ltd", "--owner", "Zed Other", "--about", "Something else"]);
    [enterpriseId, otherId] = listEnterprises().map((enterprise) => enterprise.id);
    area("Drafting", "creator");
    area("Contract review", "reviewer");
    area("Market research", "researcher");
    area("Wills", "creator");
    area("Elsewhere checks", "reviewer", () => otherId, "Zed Other");
    expect(addPersonFromPage({ enterpriseId, name: "Dana Clerk", role: "worker", as: "Amy Wise" }).added).toBe(true);
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const ask = (instruction: string, extra: string[] = []) => {
    const outcome = createTask([instruction, "--function", fn("Drafting"), "--enterprise", enterpriseId, "--asked-by", "Amy Wise", ...extra]);
    expect(outcome.created, outcome.message).toBe(true);
    return outcome.taskId!;
  };
  const finish = (id: string, text = "1. Parties. 2. Term: two years.") =>
    replaceJob({ ...getJob(id)!, status: "completed", output: `${UNVERIFIED_MODEL_OUTPUT_PREFIX}${text}`, completedAt: Date.now() });

  describe("the rule on a business function", () => {
    it("is set only by someone who can sign off, only to an AI worker of this business that cannot reach outside Arturo without asking", () => {
      const set = (over: Partial<Parameters<typeof setPassOn>[0]>) => setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise", ...over });
      expect(set({ as: "Dana Clerk" })).toEqual({ refused: "Only someone at this business who can sign off work may change where results go. Dana Clerk cannot." });
      expect(set({ to: "Drafting" })).toEqual({ refused: "Drafting cannot check its own results. Choose another business function." });
      expect(set({ to: "Elsewhere checks" })).toEqual({ refused: "Choose one of this business's business functions to send results to." });
      expect(set({ to: "Market research" })).toMatchObject({ refused: expect.stringContaining("Market research's AI worker can search the web without asking first, and a result nobody has signed off must not leave Arturo") });
      const created = createEnterpriseFunction({ enterprise: getEnterprise(enterpriseId)!, label: "Bare", objective: "Nothing yet." });
      expect(created.created).toBe(true);
      expect(set({ to: "Bare" })).toEqual({ refused: "Bare has no AI worker to check results yet." });
      expect(getPassOnRule(fn("Drafting"))).toBeUndefined();

      const outcome = set({ now: 1_700_000_000_000 });
      expect(outcome).toMatchObject({ rule: { mode: "send", toFunctionId: fn("Contract review"), setBy: "Amy Wise", setAt: 1_700_000_000_000 } });
      expect(describePassOn(getPassOnRule(fn("Drafting")))).toBe("Results go to Contract review first, to be checked, then to a person to sign off.");
      expect(set({ mode: "never" })).toMatchObject({ rule: { mode: "never" } });
      expect(describePassOn(getPassOnRule(fn("Drafting")))).toBe("Results always come to a person to sign off, and no task can send them on.");
    });

    it("is set at the terminal through the same function, refused whole when it cannot be", () => {
      const refused = handleUiFunctionUpdateSubcommand(["Drafting", "--pass-on-to", "Market research", "--objective", "Changed.", "--as", "Amy Wise", "--enterprise", "Harbour Legal"]);
      expect(refused[0]).toMatchObject({ label: "Where results go was not changed" });
      expect(listBusinessFunctionDefinitions().find((definition) => definition.id === fn("Drafting"))?.objective).toBe("Drafting");
      const set = handleUiFunctionUpdateSubcommand(["Drafting", "--pass-on-to", "Contract review", "--as", "Amy Wise", "--enterprise", "Harbour Legal"]);
      expect(set[0].body).toContain("Results go to Contract review first, to be checked, then to a person to sign off.");
      expect(getPassOnRule(fn("Drafting"))).toMatchObject({ mode: "send", setBy: "Amy Wise" });
      expect(handleUiFunctionUpdateSubcommand(["Drafting", "--pass-on", "sometimes", "--as", "Amy Wise"])[0]).toMatchObject({ label: "Usage" });
    });
  });

  describe("when a task finishes", () => {
    it("sends a result to be checked by the rule, through createTask, once, as the person who asked, and never checks the check", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const draft = finish(ask("Draft a mutual NDA for Harbour St."));
      const outcome = deliverPassOn(draft, 1_700_000_000_000);
      expect(outcome).toEqual({ sent: expect.any(String) });
      const checkId = (outcome as { sent: string }).sent;
      const check = getJob(checkId)!;
      expect(check).toMatchObject({ businessFunctionId: fn("Contract review"), sourceTaskId: draft.id, requestedBy: "Amy Wise", task: checkInstruction("Amy Wise", draft.id) });
      expect(passOnOf(draft.id)).toMatchObject({ via: "rule", setBy: "Amy Wise", nextTaskId: checkId, toFunctionId: fn("Contract review") });
      expect(passOnChecking(checkId)?.sourceTaskId).toBe(draft.id);
      // Once only, and a check is never passed on again.
      expect(deliverPassOn(draft)).toBeUndefined();
      expect(deliverPassOn(finish(checkId, "Points to check: 1"))).toBeUndefined();
      expect(listJobs()).toHaveLength(2);
    });

    it("follows the choice made for the task over the rule, and never a lock", () => {
      const straightBack = finish(ask("Draft an NDA.", ["--pass-on", "off"]));
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      expect(deliverPassOn(straightBack)).toBeUndefined();

      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "me", as: "Amy Wise" });
      const chosen = finish(ask("Draft an NDA on their paper.", ["--pass-on", "Contract review"]));
      expect(getPassOnChoice(chosen.id)).toMatchObject({ choice: fn("Contract review"), by: "Amy Wise" });
      expect(deliverPassOn(chosen)).toEqual({ sent: expect.any(String) });
      expect(passOnOf(chosen.id)).toMatchObject({ via: "task", setBy: "Amy Wise" });

      // A choice made before the business function was locked is not followed after.
      const before = ask("Draft another NDA.", ["--pass-on", "Contract review"]);
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "never", as: "Amy Wise" });
      expect(deliverPassOn(finish(before))).toBeUndefined();
      // And no task can ask for it now.
      const refused = createTask(["Draft a will.", "--function", fn("Drafting"), "--enterprise", enterpriseId, "--pass-on", "Contract review"]);
      expect(refused).toMatchObject({ created: false, message: "Drafting never passes its results on: they always come to a person to sign off. Nothing was started." });
      expect(createTask(["Draft a will.", "--function", fn("Drafting"), "--enterprise", enterpriseId, "--pass-on", "off"]).created).toBe(true);
      expect(createTask(["Draft an NDA.", "--function", fn("Wills"), "--enterprise", enterpriseId, "--pass-on", "Market research"])).toMatchObject({ created: false, message: expect.stringContaining("can search the web") });
    });

    it("never passes on a web step's result: it stops, for a person to sign off (Story G)", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const webStep = replaceJob({ ...finish(ask("Draft an NDA.")), webSearchQuery: "standard NDA terms" });
      expect(deliverPassOn(webStep)).toEqual({ stopped: WEB_STEP_STOPS });
      expect(passOnOf(webStep.id)).toMatchObject({ stopped: WEB_STEP_STOPS });
      expect(listJobs()).toHaveLength(1);
    });

    it("passes on only a plain AI-written result, and stops (leaving it for a person) when the check cannot be made", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const receipt = replaceJob({ ...getJob(ask("Draft an NDA."))!, status: "completed", output: "Evidence status: DETERMINISTIC TRANSFORMATION\n\nDone.", completedAt: 1 });
      expect(deliverPassOn(receipt)).toBeUndefined();

      removeStaffingAssignmentsForFunction(fn("Contract review"));
      const draft = finish(ask("Draft an NDA for Harbour St."));
      expect(deliverPassOn(draft)).toEqual({ stopped: "Contract review has no AI worker to check results yet." });
      expect(passOnOf(draft.id)).toMatchObject({ stopped: "Contract review has no AI worker to check results yet." });
      expect(deliverPassOn(draft)).toBeUndefined();
      expect(listJobs()).toHaveLength(2);
    });
  });

  describe("sign-off order on checked results", () => {
    it("still refuses to sign off a checked result built on an unsigned AI result (B10, send mode), before anything is written", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const earlier = finish(ask("Draft the heads of terms for Harbour St."));
      const draft = replaceJob({ ...finish(ask("Draft a mutual NDA for Harbour St.")), sourceTaskId: earlier.id });
      const checkId = (deliverPassOn(draft) as { sent: string }).sent;
      finish(checkId, "Points to check: 1\n1. Clause 4: the term is two years.");

      const refused = signOffTaskResult([draft.id, "--as", "Amy Wise"]);
      expect(refused).toEqual({
        signedOff: false,
        code: "built_on_unsigned",
        message: `${draft.id} can't be signed off yet. It was built on ${earlier.id}, written by AI and not signed off yet. Read and sign off that one first, in order. Nothing was recorded.`,
      });
      expect(readResultSignOffStanding(getJob(draft.id)!).state).not.toBe("signed");
      expect(signOffTaskResult([checkId, "--as", "Amy Wise"])).toMatchObject({ signedOff: false, message: expect.stringContaining(`Sign off ${draft.id} instead.`) });

      expect(signOffTaskResult([earlier.id, "--as", "Amy Wise"]).signedOff).toBe(true);
      expect(signOffTaskResult([draft.id, "--as", "Amy Wise"]).signedOff).toBe(true);
    });
  });

  describe("a route", () => {
    beforeEach(() => area("Client letters", "creator"));
    const route = (over: Partial<Parameters<typeof setPassOn>[0]> = {}) => setPassOn({
      enterpriseId, functionId: fn("Drafting"), mode: "route", as: "Amy Wise",
      steps: [{ to: "Contract review", instruction: "List the points to check in the draft." }, { to: "Client letters", instruction: "Write a covering letter explaining the key terms." }],
      ...over,
    });

    it("is set only by someone who can sign off, signed, up to two steps, each once, never a locked or outside-reaching one", () => {
      const step = (to: string, instruction = "Do it.") => ({ to, instruction });
      const refusals: [Partial<Parameters<typeof setPassOn>[0]>, string][] = [
        [{ as: "Dana Clerk" }, "Only someone at this business who can sign off work"],
        [{ steps: [] }, "Add at least one step"],
        [{ steps: [step("Contract review"), step("Client letters"), step("Wills")] }, "at most 2 steps"],
        [{ steps: [step("Drafting")] }, "the route starts from Drafting"],
        [{ steps: [step("Contract review"), step("Contract review")] }, "already a step"],
        [{ steps: [step("Market research")] }, "can search the web without asking first"],
        [{ steps: [step("Contract review", " ")] }, "say what Contract review's AI worker should do"],
        [{ steps: [step("Contract review", "--write-only")] }, "start the instruction with a word"],
        [{ steps: [step("Elsewhere checks")] }, "Choose one of this business's business functions"],
      ];
      for (const [over, said] of refusals) expect(route(over)).toMatchObject({ refused: expect.stringContaining(said) });
      setPassOn({ enterpriseId, functionId: fn("Wills"), mode: "never", as: "Amy Wise" });
      expect(route({ steps: [step("Wills")] })).toMatchObject({ refused: expect.stringContaining("Wills never passes its results on, so it cannot be a step") });
      expect(getPassOnRule(fn("Drafting"))).toBeUndefined();

      const set = route();
      expect(set).toMatchObject({ rule: { mode: "route", pauseFirst: true, steps: [{ functionId: fn("Contract review") }, { functionId: fn("Client letters") }], signature: expect.any(String) } });
      expect(describePassOn(getPassOnRule(fn("Drafting")))).toBe("Results go along a route: Contract review, then Client letters, each step working from the one before. A person signs off each document, and this business function's own result is signed off before the route goes on.");
      // An edited rule is not followed.
      const stored = loadPassOnRule(fn("Drafting"))!;
      savePassOnRule({ ...stored, steps: [{ functionId: fn("Market research"), instruction: "Search for it." }] });
      expect(getPassOnRule(fn("Drafting"))).toBeUndefined();
      expect(readPassOnView(fn("Drafting"))).toEqual({ mode: "me", unverified: true });
    });

    it("waits for the first result's sign-off, then goes on one step at a time, each through createTask, once, from the one before, and no further", () => {
      route();
      const draft = finish(ask("Draft a mutual NDA for Harbour St."));
      expect(deliverPassOn(draft)).toEqual({ paused: draft.id });
      expect(listJobs()).toHaveLength(1);

      const signed = signOffTaskResult([draft.id, "--as", "Amy Wise"]);
      expect(signed.signedOff).toBe(true);
      expect(signed.message).toContain("It goes on along its route:");
      const first = listJobs().find((job) => job.id !== draft.id)!;
      expect(first).toMatchObject({ businessFunctionId: fn("Contract review"), sourceTaskId: draft.id, requestedBy: "Amy Wise", task: "List the points to check in the draft." });

      // A step's own business function's rule is never followed: only the route.
      setPassOn({ enterpriseId, functionId: fn("Contract review"), mode: "send", to: "Wills", as: "Amy Wise" });
      const second = (deliverPassOn(finish(first.id, "Points to check: 1\n1. Clause 4.")) as { sent: string }).sent;
      expect(getJob(second)).toMatchObject({ businessFunctionId: fn("Client letters"), sourceTaskId: first.id, task: "Write a covering letter explaining the key terms." });
      expect(deliverPassOn(getJob(first.id)!)).toBeUndefined();
      expect(deliverPassOn(finish(second, "Dear client, the NDA lasts two years."))).toBeUndefined();
      expect(listJobs()).toHaveLength(3);

      // Each document is signed off on its own, in order (B10), bound to what it was built on.
      expect(signOffTaskResult([second, "--as", "Amy Wise"])).toMatchObject({ signedOff: false, code: "built_on_unsigned", message: expect.stringContaining(`It was built on ${first.id}`) });
      expect(loadResultSignOff(second)).toBeUndefined();
      expect(signOffTaskResult([first.id, "--as", "Amy Wise"]).signedOff).toBe(true);
      expect(signOffTaskResult([second, "--as", "Amy Wise"]).signedOff).toBe(true);
      const record = loadResultSignOff(second)!;
      expect(record.alongside).toEqual([
        { taskId: first.id, role: "built-on", sha256: crypto.createHash("sha256").update(getJob(first.id)!.output!).digest("hex") },
        { taskId: draft.id, role: "built-on", sha256: crypto.createHash("sha256").update(draft.output!).digest("hex") },
      ]);
      saveResultSignOff({ ...record, alongside: [{ ...record.alongside![0], sha256: "0".repeat(64) }, record.alongside![1]] });
      expect(readResultSignOffStanding(getJob(second)!).state).toBe("unverified");
    });

    it("always waits after a web step, which counts as leaving the business, even when told to go straight through (Story G)", () => {
      route({ pauseFirst: false });
      const webStep = replaceJob({ ...finish(ask("Draft an NDA.")), webSearchQuery: "standard NDA terms" });
      expect(deliverPassOn(webStep)).toEqual({ paused: webStep.id });
      expect(listJobs()).toHaveLength(1);
    });

    it("goes straight through when told, can be stopped by someone who can sign off, and stops itself for another client named", () => {
      route({ pauseFirst: false });
      const draft = finish(ask("Draft an NDA."));
      const first = (deliverPassOn(draft) as { sent: string }).sent;
      expect(stopRoute({ taskId: first, as: "Dana Clerk" })).toMatchObject({ stopped: false, message: expect.stringContaining("Only someone at this business who can sign off work") });
      expect(stopRoute({ taskId: first, as: "Amy Wise" })).toMatchObject({ stopped: true });
      expect(stopRoute({ taskId: draft.id, as: "Amy Wise" })).toMatchObject({ stopped: false, message: expect.stringContaining("already stopped") });
      expect(deliverPassOn(finish(first, "Points to check: 0"))).toBeUndefined();
      expect(listJobs()).toHaveLength(2);

      addClientRecord({ enterpriseId, name: "Brightwell Ltd", addedBy: "Amy Wise", createdAt: 1 });
      const conflicted = finish(ask("Draft an NDA between Harbour St and Brightwell Ltd."));
      expect(deliverPassOn(conflicted)).toEqual({ stopped: "Brightwell Ltd is also on your list of clients. Arturo stopped the route before it went on, so you can check for a conflict first." });
      expect(listJobs()).toHaveLength(3);
      // A word inside another word is not a name.
      addClientRecord({ enterpriseId, name: "Bright", addedBy: "Amy Wise", createdAt: 1 });
      expect(otherClientsNamed(getJob(conflicted.id)!, enterpriseId)).toEqual(["Brightwell Ltd"]);
    });

    it("is set and stopped at the terminal through the same functions", () => {
      const refused = handleUiFunctionUpdateSubcommand(["Drafting", "--route-step", "Market research: Search for it.", "--as", "Amy Wise", "--enterprise", "Harbour Legal"]);
      expect(refused[0]).toMatchObject({ label: "Where results go was not changed" });
      const set = handleUiFunctionUpdateSubcommand(["Drafting", "--route-step", "Contract review: List the points to check.", "--route-step", "Client letters: Write a covering letter.", "--route-stop-first", "off", "--as", "Amy Wise", "--enterprise", "Harbour Legal"]);
      expect(set[0].body).toContain("Results go along a route: Contract review, then Client letters");
      expect(getPassOnRule(fn("Drafting"))).toMatchObject({ mode: "route", pauseFirst: false });
      expect(handleUiFunctionUpdateSubcommand(["Drafting", "--route-step", "Contract review: x", "--pass-on", "never", "--as", "Amy Wise"])[0]).toMatchObject({ label: "Usage" });
    });
  });

  describe("a standing permission, checked live before each step (B9)", () => {
    const route = () => setPassOn({
      enterpriseId, functionId: fn("Drafting"), mode: "route", as: "Amy Wise", pauseFirst: false,
      steps: [{ to: "Contract review", instruction: "List the points to check in the draft." }, { to: "Client letters", instruction: "Write a covering letter explaining the key terms." }],
    });
    beforeEach(() => area("Client letters", "creator"));

    it("stops a route at its next step once the rule is withdrawn, saying who withdrew it and when", () => {
      route();
      const draft = finish(ask("Draft an NDA."));
      const first = (deliverPassOn(draft) as { sent: string }).sent;
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "me", as: "Amy Wise", now: 1_700_000_000_000 });
      // The step already working finishes; nothing more is started under the withdrawn rule.
      const outcome = deliverPassOn(finish(first, "Points to check: 0")) as { stopped: string };
      expect(outcome.stopped).toMatch(/^The route set on Drafting was withdrawn by Amy Wise at .+, so nothing more goes on under it\.$/);
      expect(listJobs()).toHaveLength(2);
    });

    it("stops a route whose rule was changed after it started", () => {
      route();
      const draft = finish(ask("Draft an NDA."));
      const first = (deliverPassOn(draft) as { sent: string }).sent;
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "route", as: "Amy Wise", pauseFirst: false, steps: [{ to: "Client letters", instruction: "Write it." }] });
      expect(deliverPassOn(finish(first, "Points to check: 0"))).toEqual({ stopped: expect.stringMatching(/^The route set on Drafting was changed by Amy Wise at .+ after this run started, so the run stopped\./) });
      expect(listJobs()).toHaveLength(2);
    });

    it("treats a rule as withdrawn once the person who set it can no longer sign off", () => {
      route();
      const draft = finish(ask("Draft an NDA."));
      const first = (deliverPassOn(draft) as { sent: string }).sent;
      runtimeDb.prepare("DELETE FROM enterprise_worker_memberships WHERE worker_name = ?").run("Amy Wise");
      expect(deliverPassOn(finish(first, "Points to check: 0"))).toEqual({
        stopped: "The route set on Drafting was set by Amy Wise, who can no longer sign off work here, so it lapsed and counts as withdrawn. Someone who can sign off work can set it again.",
      });
      expect(listJobs()).toHaveLength(2);
    });

    it("stops when the model or provider changes from the one the rule was set under, for a route and a check alike", () => {
      const before = process.env.ARTURO_LLM_MODEL;
      try {
        route();
        const draft = finish(ask("Draft an NDA."));
        const first = (deliverPassOn(draft) as { sent: string }).sent;
        process.env.ARTURO_LLM_MODEL = "some-other-model:latest";
        expect(deliverPassOn(finish(first, "Points to check: 0"))).toEqual({ stopped: expect.stringContaining("It now uses some-other-model:latest") });
        expect(listJobs()).toHaveLength(2);

        setPassOn({ enterpriseId, functionId: fn("Wills"), mode: "send", to: "Contract review", as: "Amy Wise" });
        process.env.ARTURO_LLM_MODEL = "a-third-model:latest";
        const will = createTask(["Draft a will.", "--function", fn("Wills"), "--enterprise", enterpriseId, "--asked-by", "Amy Wise"]).taskId!;
        expect(deliverPassOn(finish(will))).toEqual({ stopped: expect.stringContaining("It now uses a-third-model:latest") });
        expect(listJobs()).toHaveLength(3);
      } finally {
        if (before === undefined) delete process.env.ARTURO_LLM_MODEL; else process.env.ARTURO_LLM_MODEL = before;
      }
    });

    it("counts a rule signed under the old signature version as off until it is set again, and the page says so", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const stored = loadPassOnRule(fn("Drafting"))!;
      const { version: _version, provider: _provider, ...older } = stored as typeof stored & { version?: number; provider?: unknown };
      savePassOnRule(older as typeof stored);
      expect(getPassOnRule(fn("Drafting"))).toBeUndefined();
      expect(readPassOnView(fn("Drafting"))).toEqual({ mode: "me", unverified: true });
      expect(deliverPassOn(finish(ask("Draft an NDA.")))).toBeUndefined();
      expect(listJobs()).toHaveLength(1);
    });
  });

  describe("signing off", () => {
    it("signs off the result, never the check, and keeps what the check said with the sign-off", () => {
      setPassOn({ enterpriseId, functionId: fn("Drafting"), mode: "send", to: "Contract review", as: "Amy Wise" });
      const draft = finish(ask("Draft a mutual NDA for Harbour St."));
      const checkId = (deliverPassOn(draft) as { sent: string }).sent;
      const check = finish(checkId, "Points to check: 1\n1. Clause 4: term is two years; you asked for three.");
      expect(signOffTaskResult([checkId, "--as", "Amy Wise"])).toMatchObject({ signedOff: false, message: `${checkId} is a check of ${draft.id}, kept with it. Sign off ${draft.id} instead. Nothing was recorded.` });
      expect(signOffTaskResult([draft.id, "--as", "Amy Wise"]).signedOff).toBe(true);
      expect(passOnOf(draft.id)?.seenAtSignOff).toMatchObject({
        by: "Amy Wise", checkTaskId: checkId, checkState: "finished",
        checkSha256: crypto.createHash("sha256").update(check.output!).digest("hex"),
      });
    });
  });
});
