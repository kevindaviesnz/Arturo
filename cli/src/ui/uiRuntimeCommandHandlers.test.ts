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
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";
import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";
import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";
import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";
import {
  handleUiRuntimeStartCommand,
} from "./uiRuntimeCommandHandlers";

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

describe("UI Runtime commands", () => {
  it("starts a Runtime with no Jobs until it observes a signal", async () => {
    const enterprise = createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Make safe toys.",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:product-safety`,
      enterpriseId: enterprise.id,
      label: "Product Safety",
      objective: "Ensure every toy is safe.",
    });

    const entries = await handleUiRuntimeStartCommand([
      "Product Safety",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(entries[0].body).toContain("Tasks:\n  0");
  });
});
