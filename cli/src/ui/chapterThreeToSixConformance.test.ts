import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { saveStaffingAssignment } from "../staffing/staffingStore";
import {
  clearBusinessFunctionDefinitions,
  getBusinessFunctionDefinitionByIdOrLabel,
} from "../business/businessFunctionDefinitionStore";
import {
  clearBusinessFunctions,
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import {
  clearWorkers,
} from "../control/workers";
import {
  clearEnterprises,
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";
import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";
import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";
import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";
import {
  handleUiCommand,
} from "./uiCommandHandlers";
import {
  ensureTestSigner,
} from "../testing/cliTestSetup";

function clearChapterState(): void {
  clearJobs();
  clearRuntimeEventStore();
  clearWorkers();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
}

beforeEach(clearChapterState);
afterEach(clearChapterState);

describe("Chapters 3–6 conformance", () => {
  it("moves from Enterprise identity to running work assigned to a suitable Worker", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "Ethical Toys",
      "--mission",
      "Allow parents to buy ethical toys for young children",
    ]);

    const enterprise = getEnterpriseByIdOrName("Ethical Toys");
    expect(enterprise).toMatchObject({
      name: "Ethical Toys",
      mission: "Allow parents to buy ethical toys for young children",
      businessFunctionIds: [],
    });
    ensureTestSigner({ enterpriseId: enterprise!.id });

    await handleUiCommand("/function", [
      "create",
      "Product Safety",
      "--enterprise",
      "Ethical Toys",
      "--objective",
      "Ensure every toy is safe and appropriate for its intended age group.",
    ]);

    let definition = getBusinessFunctionDefinitionByIdOrLabel("Product Safety");
    expect(definition).toMatchObject({
      enterpriseId: enterprise?.id,
      status: "declared",
      runtimeId: undefined,
    });

    await handleUiCommand("/function", [
      "start",
      "Product Safety",
    ]);

    definition = getBusinessFunctionDefinitionByIdOrLabel("Product Safety");
    expect(definition?.status).toBe("active");
    expect(definition?.runtimeId).toBeDefined();
    expect(getBusinessFunction(definition?.runtimeId ?? "")?.state).toBe("running");
    expect(listJobs()).toEqual([]);

    await publishOrganisationalEventToRuntimes(
      {
        label: "Toy Safety Evidence Submitted",
        sourceBusinessFunction: "Product Development",
        enterpriseName: "Ethical Toys",
      },
      async () => ({
        shouldCreateJob: true,
        task: "Assess the submitted toy safety evidence for age appropriateness and hazards.",
        reason: "The new evidence directly affects the Product Safety Objective.",
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    // A Function's Task from an Event goes through createTask (C1), which
    // refuses work for a Function nobody is staffed on, rather than queueing
    // it to wait for a Worker.
    expect(listJobs()).toEqual([]);

    await handleUiCommand("/add-ai-worker", [
      "Product Safety Reasoning Worker",
      "--archetype",
      "guardian",
    ]);
    saveStaffingAssignment({ businessFunctionId: definition!.id, workerName: "Product Safety Reasoning Worker", role: "ai", rationale: "test" });

    await publishOrganisationalEventToRuntimes(
      {
        label: "Toy Safety Evidence Submitted",
        sourceBusinessFunction: "Product Development",
        enterpriseName: "Ethical Toys",
      },
      async () => ({
        shouldCreateJob: true,
        task: "Assess the submitted toy safety evidence for age appropriateness and hazards.",
        reason: "The new evidence directly affects the Product Safety Objective.",
        requiredCapabilities: [
          "safety",
        ],
      })
    );

    expect(listJobs()).toHaveLength(1);
    expect(listJobs()[0]).toMatchObject({
      status: "queued",
      worker: "Product Safety Reasoning Worker",
      selectedWorker: "Product Safety Reasoning Worker",
    });
  });
});
