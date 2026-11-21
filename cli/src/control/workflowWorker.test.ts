import { describe, expect, it } from "vitest";
import { executeWorkflowDefinition, validateWorkflowDefinition } from "./workflowWorker";

describe("deterministic Workflow Worker definitions", () => {
  it("runs ordered, bounded transformations without a model", () => {
    const definition = { version: 1, steps: [
      { operation: "json-select", path: ["matter", "reference"] },
      { operation: "template", template: "Matter: {{input}}" },
    ] };
    expect(executeWorkflowDefinition(validateWorkflowDefinition(definition), '{"matter":{"reference":"ABC-12"}}')).toBe("Matter: ABC-12");
  });
  it("fails closed for unknown versions, external steps and malformed paths", () => {
    expect(() => validateWorkflowDefinition({ version: 2, steps: [] })).toThrow();
    expect(() => validateWorkflowDefinition({ version: 1, steps: [{ operation: "shell.exec" }] })).toThrow();
    expect(() => validateWorkflowDefinition({ version: 1, steps: [{ operation: "json-select", path: ["__proto__"] }] })).toThrow();
  });
  it("rejects missing input fields, cancellation and unbounded output", () => {
    const select = validateWorkflowDefinition({ version: 1, steps: [{ operation: "json-select", path: ["missing"] }] });
    expect(() => executeWorkflowDefinition(select, "{}")).toThrow(/missing/);
    const template = validateWorkflowDefinition({ version: 1, steps: [{ operation: "template", template: "{{input}}{{input}}" }] });
    const controller = new AbortController(); controller.abort();
    expect(() => executeWorkflowDefinition(template, "text", controller.signal)).toThrow(/abort/i);
    expect(() => executeWorkflowDefinition(template, "a".repeat(100_000))).toThrow(/limit/);
  });
});
