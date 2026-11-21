import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as llmClient from "../llm/llmClient";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearBusinessFunctions,
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";

import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";

import {
  clearJobs,
  completeJob,
  enqueueJob,
  listJobs,
} from "./jobQueue";
import { UNVERIFIED_MODEL_OUTPUT_PREFIX } from "./taskExecutor";

import {
  clearRuntimeEventStore,
} from "./runtimeEventStore";
import {
  isRuntimeCoordinationTask,
  parseRuntimeSignalDecision,
  reasonAboutRuntimeSignal,
  validateRuntimeSignalDecisionForSignal,
} from "./businessFunctionRuntimeEvaluator";

import {
  evaluateNewWorkerForRunningRuntimes,
} from "./businessFunctionRuntimeWorkerSignal";
import {
  addWorker,
  clearWorkers,
} from "../control/workers";

import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { clearNextActions } from "./nextActions";

// A Function's Task from an Event is created through createTask (C1), which
// refuses work for a Function nobody is staffed on, as it does for a person.
function staffSafetyWorker(functionId: string, name = "product-safety-worker") {
  saveStaffingAssignment({ businessFunctionId: functionId, workerName: name, role: "ai", rationale: "test" });
}

beforeEach(() => {
  clearStaffingAssignments();
  clearNextActions();
  clearJobs();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
});

afterEach(() => {
  clearJobs();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
});

function startProductSafetyRuntime() {
  const enterprise = createAndSaveEnterprise({
    name: "Ethical Toys",
    mission: "Allow parents to buy ethical toys for young children.",
    now: 1000,
  });

  const definition = createAndSaveBusinessFunctionDefinition({
    id: `${enterprise.id}:product-safety`,
    enterpriseId: enterprise.id,
    label: "Product Safety",
    objective: "Ensure every toy is safe and appropriate for its intended age group.",
    now: 1000,
  });
  staffSafetyWorker(definition.id);

  return startRuntimeForBusinessFunction(definition);
}

describe("Business Function Runtime signal evaluation", () => {
  it("rejects Worker assignment as a Runtime-generated Job", () => {
    const task = "Assign Product Safety Worker to ensure every toy is safe.";

    expect(isRuntimeCoordinationTask(task)).toBe(true);
    expect(() => parseRuntimeSignalDecision(JSON.stringify({
      shouldCreateJob: true,
      task,
      reason: "A matching Worker is available.",
      requiredCapabilities: [
        "safety",
      ],
    }))).toThrow(
      "must describe domain work"
    );
  });

  it("accepts bounded domain work for a Worker", () => {
    expect(
      parseRuntimeSignalDecision(JSON.stringify({
        shouldCreateJob: true,
        task: "Review the available toy safety evidence and identify assessment gaps.",
        reason: "Safety evidence requires review.",
        requiredCapabilities: [
          "safety",
        ],
      }))
    ).toMatchObject({
      shouldCreateJob: true,
      task: "Review the available toy safety evidence and identify assessment gaps.",
    });
  });

  it("rejects a task that embeds the Worker from an availability signal", () => {
    expect(() => validateRuntimeSignalDecisionForSignal(
      {
        shouldCreateJob: true,
        task: "Use Product Safety Worker to review the available evidence.",
        reason: "The Worker is available.",
        requiredCapabilities: [
          "safety",
        ],
      },
      {
        label: "Matching Worker Available",
        enterpriseName: "Ethical Toys",
        sourceBusinessFunction: "Workforce",
        payload: {
          worker: "Product Safety Worker",
        },
      }
    )).toThrow(
      "must not name the Worker"
    );
  });

  it("does not fabricate a Job merely because a Runtime starts", () => {
    const runtime = startProductSafetyRuntime();

    expect(runtime.state).toBe("running");
    expect(runtime.jobIds).toEqual([]);
    expect(listJobs()).toEqual([]);
  });

  it("queues and attaches a Job when an observed signal warrants work", async () => {
    const runtime = startProductSafetyRuntime();
    addWorker({ name: "product-safety-worker", kind: "ai", capabilities: ["safety"], run: function* () { return undefined; } });

    const publication = await publishOrganisationalEventToRuntimes(
      {
        label: "Toy Safety Evidence Submitted",
        sourceBusinessFunction: "Product Development",
        enterpriseName: "Ethical Toys",
      },
      async () => ({
        shouldCreateJob: true,
        task: "Assess the submitted toy safety evidence.",
        reason: "The evidence is directly relevant to the Product Safety Objective.",
      })
    );

    expect(publication.evaluations).toHaveLength(1);
    expect(listJobs()).toHaveLength(1);
    // Created through createTask: queued for the staffed Worker, under the
    // Function and its business.
    expect(listJobs()[0].task.startsWith("Assess the submitted toy safety evidence.")).toBe(true);
    expect(listJobs()[0]).toMatchObject({
      status: "queued",
      worker: "product-safety-worker",
    });
    expect(listJobs()[0].businessFunctionId).toMatch(/:product-safety$/);
    expect(
      getBusinessFunction(runtime.id)?.jobIds
    ).toEqual([
      listJobs()[0].id,
    ]);
  });

  it("records a no-work decision without changing the Job queue", async () => {
    startProductSafetyRuntime();

    const publication = await publishOrganisationalEventToRuntimes(
      {
        label: "Office Plants Watered",
        sourceBusinessFunction: "Facilities",
        enterpriseName: "Ethical Toys",
      },
      async () => ({
        shouldCreateJob: false,
        reason: "This signal does not affect toy safety.",
      })
    );

    expect(publication.evaluations[0].decision).toEqual({
      shouldCreateJob: false,
      reason: "This signal does not affect toy safety.",
    });
    expect(listJobs()).toEqual([]);
  });

  it("automatically assigns Runtime work to a matching Worker", async () => {
    startProductSafetyRuntime();
    addWorker({
      name: "product-safety-worker",
      kind: "ai",
      capabilities: [
        "safety",
      ],
      run: function* () {
        return undefined;
      },
    });

    await publishOrganisationalEventToRuntimes(
      {
        label: "Laboratory Test Failed",
        sourceBusinessFunction: "Toys Inspection",
        enterpriseName: "Ethical Toys",
      },
      async () => ({
        shouldCreateJob: true,
        task: "Investigate the failed laboratory test.",
        reason: "The test directly affects toy safety.",
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    expect(listJobs()[0]).toMatchObject({
      worker: "product-safety-worker",
      selectedWorker: "product-safety-worker",
      requiredCapabilities: [
        "safety",
      ],
    });
  });

  it("keeps web-research mandatory when a model proposes only general research", async () => {
    const enterprise =
      createAndSaveEnterprise({
        name:
          "Science Tracker",
        mission:
          "Summarise current science news.",
      });
    const definition =
      createAndSaveBusinessFunctionDefinition({
        id:
          `${enterprise.id}:science-discovery`,
        enterpriseId:
          enterprise.id,
        label:
          "Science Discovery",
        objective:
          "Get the latest science news from the internet.",
      });
    startRuntimeForBusinessFunction(
      definition
    );
    staffSafetyWorker(definition.id, "science-researcher");
    addWorker({ name: "science-researcher", kind: "ai", capabilities: ["research", "web-research"], run: function* () { return undefined; } });

    const publication = await publishOrganisationalEventToRuntimes(
      {
        label:
          "Daily science retrieval due",
        sourceBusinessFunction:
          "Scheduler",
        enterpriseName:
          enterprise.name,
      },
      async () => ({
        shouldCreateJob:
          true,
        task:
          "Find the latest public science news.",
        reason:
          "The daily retrieval is due.",
        requiredCapabilities: [
          "research",
        ],
      })
    );

    expect(publication.evaluations[0].job?.id).toBe(listJobs()[0].id);
    expect(
      listJobs()[0]
        .requiredCapabilities
    ).toContain("web-research");
  });

  it("does not create work from an Event whose Task an AI model wrote and nobody signed off (C1)", async () => {
    startProductSafetyRuntime();
    addWorker({ name: "product-safety-worker", kind: "ai", capabilities: ["safety"], run: function* () { return undefined; } });
    const source = completeJob(enqueueJob("Test the toy.").id, "Passed", `${UNVERIFIED_MODEL_OUTPUT_PREFIX}Passed`);

    const publication = await publishOrganisationalEventToRuntimes(
      {
        label: "Laboratory Test Finished",
        sourceBusinessFunction: "Toys Inspection",
        enterpriseName: "Ethical Toys",
        payload: { sourceJobId: source.id },
      },
      async () => ({
        shouldCreateJob: true,
        task: "Investigate the laboratory test.",
        reason: "The test directly affects toy safety.",
      })
    );

    expect(listJobs()).toHaveLength(1);
    expect(publication.evaluations[0].error).toContain("nobody has signed it off");
  });

  it("reevaluates a running Runtime when a matching Worker becomes available", async () => {
    const runtime = startProductSafetyRuntime();
    const worker = {
      name: "product-safety-worker",
      kind: "ai" as const,
      availability: "available" as const,
      capabilities: [
        "safety" as const,
      ],
      run: function* () {
        return undefined;
      },
    };
    addWorker(worker);

    const evaluations = await evaluateNewWorkerForRunningRuntimes(
      worker,
      async (definition, signal) => ({
        shouldCreateJob: true,
        task: "Determine whether a toy is ready for safety assessment.",
        reason: `${signal.payload?.worker} can now advance ${definition.label}.`,
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    expect(evaluations).toHaveLength(1);
    expect(evaluations[0].runtimeId).toBe(runtime.id);
    expect(listJobs()).toHaveLength(1);
    expect(listJobs()[0]).toMatchObject({
      task: "Determine whether a toy is ready for safety assessment.",
      status: "queued",
      worker: "product-safety-worker",
      selectedWorker: "product-safety-worker",
      requiredCapabilities: [
        "safety",
      ],
    });
    expect(getBusinessFunction(runtime.id)?.jobIds).toEqual([
      listJobs()[0].id,
    ]);
  });
});

/**
 * A Function reacting to an Event is the one moment autonomy is visible, and
 * it turns on a local model returning valid JSON. llama3.2 does so
 * intermittently — this decision failed to parse on roughly one run in three
 * with a single repair attempt, and each failure reads as "Function could not
 * check whether work was needed". The staffing planner already allows three
 * repairs for its own structured output; this matches it.
 */
describe("reasonAboutRuntimeSignal repair attempts", () => {
  const definition = createBusinessFunctionDefinition({
    id: "kid-edu:editorial-review",
    enterpriseId: "kid-edu",
    label: "Editorial Review",
    objective: "Check drafted articles before publication.",
  });

  const signal = {
    label: "article drafted",
    enterpriseName: "Kid Edu",
    sourceBusinessFunction: "Article Writing",
  };

  const valid = JSON.stringify({
    shouldCreateJob: true,
    task: "Check the drafted article for reading level and accuracy.",
    reason: "A new draft is ready for review.",
    requiredCapabilities: ["review"],
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("recovers when the model returns junk before valid JSON", async () => {
    const responses = ["not json at all", "still not json", valid];
    const generate = vi
      .spyOn(llmClient, "generateWithConfiguredLlm")
      .mockImplementation(async () => ({ response: responses.shift() ?? "" }));

    const decision = await reasonAboutRuntimeSignal(definition, signal);

    expect(decision.shouldCreateJob).toBe(true);
    // First call plus two repairs.
    expect(generate).toHaveBeenCalledTimes(3);
  });

  it("gives up only after four failures, not two", async () => {
    const generate = vi
      .spyOn(llmClient, "generateWithConfiguredLlm")
      .mockResolvedValue({ response: "not json at all" });

    await expect(
      reasonAboutRuntimeSignal(definition, signal)
    ).rejects.toThrow();

    // One initial attempt and three repairs.
    expect(generate).toHaveBeenCalledTimes(4);
  });
});
