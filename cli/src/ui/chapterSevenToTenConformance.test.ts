import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: vi.fn(async ({ prompt }: { prompt: string }) => ({
    response: prompt.includes("You measure outcomes for an Arturo Business Function Runtime")
      ? JSON.stringify({
          health: "healthy",
          objectiveProgress: "The available safety evidence was reviewed and gaps were identified.",
          lesson: "Small-parts evidence must be present before a toy can be cleared.",
          shouldCreateFollowUpJob: false,
          followUpTask: null,
          requiredCapabilities: [
            "safety",
          ],
        })
      : "The evidence review identified missing small-parts test results.",
  })),
}));

import { saveStaffingAssignment } from "../staffing/staffingStore";
import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import {
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";
import {
  addWorker,
  clearWorkers,
} from "../control/workers";
import {
  clearEnterprises,
  createAndSaveEnterprise as persistEnterprise,
} from "../enterprise/enterpriseStore";

import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";
import {
  clearOperationalMemory,
} from "../memory/operationalMemoryStore";
import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";
import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";
import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";
import {
  processNextQueuedJob,
} from "../runtime/workerRuntime";
import {
  handleUiHealthCommand,
} from "./uiHealthEntries";
import {
  readEventEntries,
} from "./uiEventEntries";
import {
  readChapterJobInspectionEntry,
} from "./uiJobDetailEntries";
import {
  readOperationalMemoryEntry,
} from "./uiMemoryEntries";

import { ensureTestSigner } from "../testing/cliTestSetup";

function createAndSaveEnterprise(
  input: Parameters<typeof persistEnterprise>[0]
): ReturnType<typeof persistEnterprise> {
  const enterprise = persistEnterprise(input);
  ensureTestSigner({ enterpriseId: enterprise.id });
  return enterprise;
}



function clearChapterState(): void {
  clearJobs();
  clearRuntimeEventStore();
  clearOperationalMemory();
  clearWorkers();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
}

beforeEach(clearChapterState);
afterEach(clearChapterState);

describe("Chapters 7–10 conformance", () => {
  it("records a Function lifecycle without learning from unverified model synthesis", async () => {
    const enterprise = createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Allow parents to buy ethical toys for young children.",
    });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:product-safety`,
      enterpriseId: enterprise.id,
      label: "Product Safety",
      objective: "Ensure every toy is safe and appropriate for its intended age group.",
      successCriteria: [
        "Safety evidence is complete before release.",
      ],
    });
    const runtime = startRuntimeForBusinessFunction(definition);
    addWorker({
      name: "Product Safety Reasoning Worker",
      displayName: "Product Safety Reasoning Worker",
      kind: "ai",
      archetype: "guardian",
      model: "test-model",
      availability: "available",
      capabilities: [
        "llm",
        "safety",
      ],
      run: function* () {
        return undefined;
      },
    });
    // A Function's Task from an Event goes through createTask (C1), which
    // needs someone staffed on the Function.
    saveStaffingAssignment({ businessFunctionId: definition.id, workerName: "Product Safety Reasoning Worker", role: "ai", rationale: "test" });

    await publishOrganisationalEventToRuntimes(
      {
        label: "Toy Safety Evidence Submitted",
        sourceBusinessFunction: "Product Development",
        enterpriseName: enterprise.name,
      },
      async () => ({
        shouldCreateJob: true,
        task: "Review the submitted toy safety evidence and identify assessment gaps.",
        reason: "New evidence must be assessed against the Product Safety Objective.",
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    expect(listJobs()).toHaveLength(1);
    const completed = await processNextQueuedJob();
    expect(completed?.status).toBe("completed");

    const inspection = readChapterJobInspectionEntry(listJobs()[0].id);
    expect(inspection.body).toContain("Function:           Product Safety");
    expect(inspection.body).toContain(`Operating process:  ${runtime.id}`);
    expect(inspection.body).toContain("Status:              Completed");
    expect(inspection.body).toContain("Assigned:");
    expect(inspection.body).toContain("Result:");

    const memory = readOperationalMemoryEntry();
    expect(memory.body).toContain("No operational memory.");
    expect(memory.body).not.toContain("Customer prefers SMS reminders");

    const events = readEventEntries().body;
    expect(events).toContain("Function Started");
    expect(events).toContain("Task Created");
    expect(events).toContain("Worker Assigned");
    expect(events).toContain("Task Started");
    expect(events).toContain("Task Completed");
    expect(events).not.toContain("Memory Entry Added");
    expect(events).toContain("Outcome Measurement Skipped");

    const health = handleUiHealthCommand([
      "Product Safety",
    ]);
    expect(health.body).toContain("Overall Health:\n  Unknown");
    expect(health.body).toContain("Tasks Completed");
    expect(health.body).toContain("1/1 (100%)");
    expect(health.body).toContain("Outcomes Measured");
    expect(health.body).toContain("Lessons Retained");
    expect(readEventEntries().body).toContain("Health Updated");
  });
});
