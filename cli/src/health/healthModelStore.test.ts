import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  getBusinessFunctionDefinitionByIdOrLabel,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import {
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";
import {
  addOperationalMemory,
  clearOperationalMemory,
} from "../memory/operationalMemoryStore";
import {
  formatRuntimeDetail,
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";
import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";
import {
  evaluateBusinessFunctionHealth,
} from "./healthModelStore";

function clearState(): void {
  clearRuntimeEventStore();
  clearOperationalMemory();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
}

beforeEach(clearState);
afterEach(clearState);

describe("healthModelStore", () => {
  it("counts and displays only eligible verified lessons", () => {
    const declared = createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Curriculum Development Function",
    });
    const runtime = startRuntimeForBusinessFunction(declared);
    const definition = getBusinessFunctionDefinitionByIdOrLabel(declared.id)!;

    addOperationalMemory({
      scopeId: runtime.id,
      content: "Quarantined model lesson.",
      source: "runtime-outcome:job-1",
    });
    addOperationalMemory({
      scopeId: runtime.id,
      content: "Manually curated context.",
      source: "manual",
    });
    addOperationalMemory({
      scopeId: runtime.id,
      content: "Verified retained lesson.",
      source: "verified:review-1",
    });

    const report = evaluateBusinessFunctionHealth(definition);
    expect(report.indicators.find((indicator) => indicator.label === "Lessons Retained")?.value).toBe("1");

    const detail = formatRuntimeDetail(definition, runtime);
    expect(detail).toContain("Overall Health:      Unknown (computed)");
    expect(detail).toContain("Latest Outcome:      None measured");
    expect(detail).toContain("Lessons Retained:     1");
    expect(detail).toContain("Verified retained lesson.");
    expect(detail).not.toContain("Quarantined model lesson.");
    expect(detail).not.toContain("Manually curated context.");
  });
});
