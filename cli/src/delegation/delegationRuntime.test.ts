import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createAndSaveBusinessFunctionDefinition,
  attachRuntimeToBusinessFunctionDefinition,
  clearBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

import {
  clearJobs,
  completeJob,
  getJob,
} from "../runtime/jobQueue";

import {
  clearDelegationRequests,
  getDelegationRequest,
} from "./delegationStore";

import {
  requestDelegatedWork,
  settleDelegationForJob,
} from "./delegationRuntime";

function setupFunctions(): void {
  createAndSaveBusinessFunctionDefinition({
    id: "function-from",
    enterpriseId: "enterprise-1",
    label: "Curriculum Development",
    objective: "Design curricula",
  });
  createAndSaveBusinessFunctionDefinition({
    id: "function-to",
    enterpriseId: "enterprise-1",
    label: "Resource Development",
    objective: "Analyze accessible resource options",
  });
  attachRuntimeToBusinessFunctionDefinition("function-from", "runtime-from");
  attachRuntimeToBusinessFunctionDefinition("function-to", "runtime-to");
  saveBusinessFunction({
    ...createBusinessFunctionRuntime({
      id: "runtime-from",
      label: "Curriculum Development",
      objective: "Design curricula",
      ownerWorker: "unassigned",
    }),
    state: "running",
  });
  saveBusinessFunction({
    ...createBusinessFunctionRuntime({
      id: "runtime-to",
      label: "Resource Development",
      objective: "Analyze accessible resource options",
      ownerWorker: "unassigned",
    }),
    state: "running",
  });
}

describe("delegation runtime", () => {
  beforeEach(() => {
    clearDelegationRequests();
    clearJobs();
    clearWorkers();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    setupFunctions();
    addWorker({
      name: "Resource Analyst",
      kind: "ai",
      archetype: "analyst",
      capabilities: ["analysis"],
      availability: "available",
      run: function* (input: unknown) { return input; },
    });
  });

  afterEach(() => {
    clearDelegationRequests();
    clearJobs();
    clearWorkers();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
  });

  it("creates a real receiving-runtime Function and settles from its result", () => {
    const request = requestDelegatedWork({
      fromBusinessFunction: "Curriculum Development",
      toBusinessFunction: "Resource Development",
      work: "Prepare accessible component options",
    });

    expect(request).toMatchObject({
      status: "in_progress",
      workerName: "Resource Analyst",
      requiredCapabilities: ["analysis"],
    });
    expect(getJob(request.jobId!)).toMatchObject({
      task: "Prepare accessible component options",
      worker: "Resource Analyst",
      status: "queued",
    });

    const completed = completeJob(
      request.jobId!,
      "Raw analysis",
      "Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nAccessible options"
    );
    settleDelegationForJob(completed);

    expect(getDelegationRequest(request.id)).toMatchObject({
      status: "completed",
      jobId: request.jobId,
      result: "Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nAccessible options",
    });
  });

  it("rejects a missing receiving Function", () => {
    expect(() => requestDelegatedWork({
      fromBusinessFunction: "Curriculum Development",
      toBusinessFunction: "Missing",
      work: "Do work",
    })).toThrow("Receiving Function not found: Missing");
  });

  it("rejects delegation back to the same Function", () => {
    expect(() => requestDelegatedWork({
      fromBusinessFunction: "Curriculum Development",
      toBusinessFunction: "Curriculum Development",
      work: "Do work",
    })).toThrow("A Function cannot delegate work to itself");
  });
});
