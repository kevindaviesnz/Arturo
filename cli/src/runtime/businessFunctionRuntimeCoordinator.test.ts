import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";
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
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";
import {
  clearJobs,
  completeJob,
  enqueueJob,
} from "./jobQueue";
import {
  clearRuntimeEventStore,
} from "./runtimeEventStore";
import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";
import {
  runBusinessFunctionRuntimeCycle,
} from "./businessFunctionRuntimeCoordinator";

beforeEach(() => {
  clearJobs();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
});

afterEach(() => {
  clearJobs();
  clearRuntimeEventStore();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
});

describe("Business Function Runtime coordinator", () => {
  it("measures completed Runtime Jobs during its repeating cycle", async () => {
    const enterprise = createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Make safe toys.",
    });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:product-safety`,
      enterpriseId: enterprise.id,
      label: "Product Safety",
      objective: "Ensure every toy is safe.",
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    const job = enqueueJob("Assess toy safety.");
    attachBusinessFunctionJob(runtime.id, job.id);
    completeJob(job.id, "Safe", "Safe");

    await runBusinessFunctionRuntimeCycle(
      async () => ({
        health: "healthy",
        objectiveProgress: "The toy passed assessment.",
        lesson: "Retain the passing evidence.",
        shouldCreateFollowUpJob: false,
        requiredCapabilities: [],
      })
    );

    expect(
      getBusinessFunction(runtime.id)?.refinements
    ).toContain("Retain the passing evidence.");
  });
});
