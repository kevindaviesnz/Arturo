import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { clearArtefacts, createArtefact } from "../artefacts/artefactStore";
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  measureRuntimeJobOutcome,
  parseRuntimeOutcomeAssessment,
} from "./businessFunctionRuntimeOutcome";
import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import {
  attachBusinessFunctionJob,
  clearBusinessFunctions,
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import {
  clearEnterprises,
  createAndSaveEnterprise as persistEnterprise,
} from "../enterprise/enterpriseStore";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";
import {
  clearJobs,
  completeJob,
  enqueueJob,
  failJob,
  listJobs,
} from "./jobQueue";
import {
  clearRuntimeEventStore,
  listRuntimeEventStore,
} from "./runtimeEventStore";
import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";
import {
  clearOperationalMemory,
  listOperationalMemory,
} from "../memory/operationalMemoryStore";
import { UNVERIFIED_MODEL_OUTPUT_PREFIX } from "./taskExecutor";
import { MAX_CHAIN_DEPTH } from "./followUpChain";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { clearNextActions } from "./nextActions";
import { createOutcomeFollowOn } from "./businessFunctionRuntimeOutcome";
import { addClientRecord, clearClients } from "../clients/clientStore";

import { ensureTestSigner } from "../testing/cliTestSetup";

function createAndSaveEnterprise(
  input: Parameters<typeof persistEnterprise>[0]
): ReturnType<typeof persistEnterprise> {
  const enterprise = persistEnterprise(input);
  ensureTestSigner({ enterpriseId: enterprise.id });
  return enterprise;
}



const staffCreator = (functionId: string) => {
  saveStaffingAssignment({ businessFunctionId: functionId, workerName: "creator", role: "ai", rationale: "test" });
  addWorker({ name: "creator", kind: "ai", capabilities: ["writing", "research"], run: function* () { return undefined; } });
};

beforeEach(() => {
  clearJobs();
  clearWorkers();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearOperationalMemory();
  clearStaffingAssignments();
  clearNextActions();
  clearClients();
});

afterEach(() => {
  clearJobs();
  clearWorkers();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearOperationalMemory();
});

describe("Business Function Runtime outcomes", () => {
  // Unverified output used to block learning AND continuing in one early
  // return, which meant an ordinary AI Task — every one of which carries this
  // prefix — taught nothing and led nowhere. Continuing is what the operator
  // asked for; treating the same unchecked text as a durable lesson is a
  // different claim and still refused.
  // C1: no model reading a result's text creates work, and an unsigned
  // result goes on to nothing. Follow-on work is created through createTask
  // --follows, which refuses a result an AI model wrote until it is signed off.
  it("does not learn from unverified model synthesis, and does not continue it before it is signed off", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Koru Kids", mission: "Create safe learning toys." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:curriculum`, enterpriseId: enterprise.id,
      label: "Curriculum", objective: "Create grounded learning experiences.", executionMode: "continuous",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    const queued = enqueueJob("Research a toy.", "researcher");
    attachBusinessFunctionJob(runtime.id, queued.id);
    const completed = completeJob(queued.id, "Invented answer", `${UNVERIFIED_MODEL_OUTPUT_PREFIX}Invented answer`);

    await measureRuntimeJobOutcome(completed, async () => ({
      health: "healthy" as const,
      objectiveProgress: "Advanced.",
      lesson: "A lesson that must not be retained.",
      shouldCreateFollowUpJob: true,
      followUpTask: "Confirm the supplier details the research asked for.",
      requiredCapabilities: [],
    }));

    // Nothing learned from unchecked work.
    expect(getBusinessFunction(runtime.id)?.refinements).toEqual([]);
    expect(listOperationalMemory(runtime.id)).toEqual([]);
    expect(
      listRuntimeEventStore().some(
        (event) => event.type === "runtime.outcome.measurement_skipped"
      )
    ).toBe(true);

    // Nor does it go on: nobody has signed it off.
    expect(listJobs()).toHaveLength(1);
    expect(
      listRuntimeEventStore().find((event) => event.type === "runtime.followup.refused")?.message
    ).toContain("nobody has signed it off");
  });

  it("stops a chain that has run its length, and says so", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Koru Kids", mission: "Create safe learning toys." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:curriculum`, enterpriseId: enterprise.id,
      label: "Curriculum", objective: "Create grounded learning experiences.", executionMode: "continuous",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    // Already the third generation of automatic follow-on work.
    const queued = enqueueJob("Third-generation work.", "researcher", {
      followUpDepth: MAX_CHAIN_DEPTH,
    });
    attachBusinessFunctionJob(runtime.id, queued.id);
    const completed = completeJob(queued.id, "Done", "Done");

    await measureRuntimeJobOutcome(completed, async () => ({
      health: "healthy" as const,
      objectiveProgress: "Advanced.",
      lesson: "A lesson.",
      shouldCreateFollowUpJob: true,
      followUpTask: "And another thing.",
      requiredCapabilities: [],
    }));

    expect(listJobs()).toHaveLength(1);
    // Silence would be indistinguishable from the model deciding it was done.
    expect(
      listRuntimeEventStore().some(
        (event) => event.type === "runtime.followup.limit_reached"
      )
    ).toBe(true);
  });

  it("validates a learned outcome and follow-up decision", () => {
    expect(
      parseRuntimeOutcomeAssessment(
        JSON.stringify({
          health: "degraded",
          objectiveProgress: "The failed test identified a release risk.",
          lesson: "Failed small-parts tests must block release.",
          shouldCreateFollowUpJob: true,
          followUpTask: "Block the affected toy release.",
          requiredCapabilities: [
            "safety",
          ],
        })
      )
    ).toEqual({
      health: "degraded",
      objectiveProgress: "The failed test identified a release risk.",
      lesson: "Failed small-parts tests must block release.",
      shouldCreateFollowUpJob: true,
      followUpTask: "Block the affected toy release.",
      requiredCapabilities: [
        "safety",
      ],
    });
  });

  it("learns from an outcome and routes concrete follow-up work", async () => {
    const enterprise = createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Make toys safe.",
    });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:product-safety`,
      enterpriseId: enterprise.id,
      label: "Product Safety",
      objective: "Ensure every toy is safe.",
      executionMode: "continuous",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    saveStaffingAssignment({ businessFunctionId: definition.id, workerName: "safety-specialist", role: "ai", rationale: "test" });
    addWorker({
      name: "safety-specialist",
      kind: "ai",
      capabilities: [
        "safety",
      ],
      run: function* () {
        return undefined;
      },
    });
    const queued = enqueueJob(
      "Assess the failed test.",
      "safety-specialist"
    );
    attachBusinessFunctionJob(runtime.id, queued.id);
    const completed = completeJob(
      queued.id,
      "Small-parts test failed.",
      "Small-parts test failed."
    );

    await measureRuntimeJobOutcome(
      completed,
      async () => ({
        health: "degraded",
        objectiveProgress: "A release risk was identified.",
        lesson: "Failed small-parts tests must block release.",
        shouldCreateFollowUpJob: true,
        followUpTask: "Block the affected release.",
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    expect(
      getBusinessFunction(runtime.id)?.refinements
    ).toContain(
      "Failed small-parts tests must block release."
    );
    expect(
      listOperationalMemory(runtime.id).map((entry) => entry.content)
    ).toContain(
      "Failed small-parts tests must block release."
    );
    expect(listJobs()).toHaveLength(2);
    // Created through createTask --follows: it follows the result, carries
    // the chain counter, and createTask chose the staffed Worker.
    expect(listJobs()[1].task.startsWith("Block the affected release.")).toBe(true);
    expect(listJobs()[1]).toMatchObject({
      worker: "safety-specialist",
      sourceTaskId: completed.id,
      businessFunctionId: definition.id,
      followUpDepth: 1,
    });
    expect(
      listRuntimeEventStore().some(
        (event) => event.type === "runtime.outcome.measured"
      )
    ).toBe(true);
  });

  const unverified = (text: string) => `${UNVERIFIED_MODEL_OUTPUT_PREFIX}${text}`;

  const wantsMore = async () => ({
    health: "healthy" as const,
    objectiveProgress: "Advanced.",
    lesson: "A lesson.",
    shouldCreateFollowUpJob: true,
    followUpTask: "Gather live data from platform APIs.",
    requiredCapabilities: [],
  });

  it("creates no follow-on work unless it was turned on for the Function, and does not ask a model whether to", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id,
      label: "Design Briefs", objective: "Write briefs.",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    const queued = enqueueJob("Write three briefs.", "creator");
    attachBusinessFunctionJob(runtime.id, queued.id);
    const completed = completeJob(queued.id, "Briefs", unverified("Briefs"));
    let asked = 0;

    const assessment = await measureRuntimeJobOutcome(completed, async () => {
      asked += 1;
      return wantsMore();
    });

    expect(assessment).toBeUndefined();
    expect(asked).toBe(0);
    expect(listJobs()).toHaveLength(1);
  });

  it("never grows follow-on work from a Task that failed, even where it is turned on", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id,
      label: "Design Briefs", objective: "Write briefs.", executionMode: "continuous",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    const queued = enqueueJob("Write three briefs.", "creator");
    attachBusinessFunctionJob(runtime.id, queued.id);
    const failed = failJob(queued.id, "Capability writing timed out after 30000ms");

    await measureRuntimeJobOutcome(failed, wantsMore);

    expect(listJobs()).toHaveLength(1);
    expect(
      listRuntimeEventStore().find((event) => event.type === "runtime.followup.not_enabled")?.message
    ).toContain("the Task did not finish");
  });

  it("hands follow-on work the documents the finished Task was given", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id,
      label: "Design Briefs", objective: "Write briefs.", executionMode: "continuous",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-followon-")), "trends.txt");
    fs.writeFileSync(file, "Ballet flats are trending.");
    const reference = `${createArtefact({ enterpriseId: enterprise.id, name: "Trends", kind: "other", file, createdBy: "Kevin" }).id}@1`;
    staffCreator(definition.id);
    const queued = enqueueJob("Write three briefs.", "creator", { inputArtefactRefs: [reference], enterpriseId: enterprise.id, businessFunctionId: definition.id });
    attachBusinessFunctionJob(runtime.id, queued.id);
    const completed = completeJob(queued.id, "Briefs", "Briefs");

    await measureRuntimeJobOutcome(completed, async () => ({
      ...(await wantsMore()),
      followUpTask: "Refine the briefs.",
    }));

    const followUp = listJobs().find((candidate) => candidate.id !== completed.id)!;
    expect(followUp.inputArtefactRefs).toEqual([reference]);
    expect(followUp.task.startsWith("Refine the briefs.")).toBe(true);
    expect(followUp.task).toContain("Ballet flats are trending.");
    clearArtefacts();
  });
});

describe("follow-on work a model proposes", () => {
  it("is refused by the same checks createTask makes: what no AI worker can do, and the business function's own checks", async () => {
    const { refuseFollowUpWork } = await import("./businessFunctionRuntimeOutcome");
    const definition = { id: "e:drafting", enterpriseId: "e", label: "Drafting", objective: "Draft agreements.", inputs: [], outputs: [], successCriteria: [] } as never;
    expect(refuseFollowUpWork(definition, "Send the signed NDA to the client", [])).toContain("no worker can send email yet");
    expect(refuseFollowUpWork(definition, "Check the drafted NDA for missing carve-outs", [])).toBeUndefined();
  });
  it("carries the client, and starts follow-on work from a result once however often it is seen", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id,
      label: "Design Briefs", objective: "Write briefs.", executionMode: "continuous",
    });
    staffCreator(definition.id);
    const client = addClientRecord({ enterpriseId: enterprise.id, name: "Brightwell Ltd", addedBy: "Amy Wise", createdAt: 1 });
    const queued = enqueueJob("Write three briefs.", "creator", { enterpriseId: enterprise.id, businessFunctionId: definition.id, clientId: client.id });
    const completed = completeJob(queued.id, "Briefs", "Briefs");

    const first = await createOutcomeFollowOn(definition, completed, "Refine the briefs.");
    const second = await createOutcomeFollowOn(definition, completed, "Refine the briefs again.");

    expect("taskId" in first).toBe(true);
    expect(second).toEqual({ refused: "follow-on work from this result was already started once." });
    const followUp = listJobs().find((candidate) => candidate.id !== completed.id)!;
    expect(followUp).toMatchObject({ clientId: client.id, sourceTaskId: completed.id, followUpDepth: 1 });
    expect(listJobs()).toHaveLength(2);
  });

  it("is refused when the result is already as deep as a chain goes", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id,
      label: "Design Briefs", objective: "Write briefs.", executionMode: "continuous",
    });
    staffCreator(definition.id);
    const deep = completeJob(
      enqueueJob("Write three briefs.", "creator", { enterpriseId: enterprise.id, businessFunctionId: definition.id, followUpDepth: MAX_CHAIN_DEPTH }).id,
      "Briefs",
      "Briefs"
    );

    const refused = await createOutcomeFollowOn(definition, deep, "Refine the briefs.");

    expect(refused).toMatchObject({ code: "chain_depth_exceeded" });
    expect(listJobs()).toHaveLength(1);
  });
});

