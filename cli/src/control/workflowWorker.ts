/** Persisted, versioned pure workflows. No arbitrary code, tools or model calls. */
export type WorkflowWorkerDefinition = {
  readonly version: 1;
  readonly steps: readonly (
    | { readonly operation: "template"; readonly template: string }
    | { readonly operation: "json-select"; readonly path: readonly string[] }
  )[];
};

const MAX_TEXT = 100_000;
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

/** Validate untrusted persisted definitions before registration and execution. */
export function validateWorkflowDefinition(value: unknown): WorkflowWorkerDefinition {
  const candidate = value as WorkflowWorkerDefinition | undefined;
  if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.steps) || candidate.steps.length < 1 || candidate.steps.length > 32) {
    throw new Error("Workflow requires version 1 and between 1 and 32 deterministic steps.");
  }
  for (const step of candidate.steps) {
    if (step?.operation === "template") {
      if (typeof step.template !== "string" || step.template.length > MAX_TEXT) throw new Error("Workflow template exceeds text limit or is invalid.");
    } else if (step?.operation === "json-select") {
      if (!Array.isArray(step.path) || step.path.length < 1 || step.path.length > 16 || step.path.some((key: unknown) => typeof key !== "string" || !key || forbiddenKeys.has(key))) {
        throw new Error("Workflow JSON path is invalid.");
      }
    } else {
      throw new Error("Unsupported Workflow operation. Only template and json-select are executable.");
    }
  }
  return structuredClone(candidate);
}

/** Each step consumes the previous output; cancellation is checked before every step. */
export function executeWorkflowDefinition(definition: WorkflowWorkerDefinition, input: string, signal?: AbortSignal): string {
  const validated = validateWorkflowDefinition(definition);
  let output = input;
  for (const step of validated.steps) {
    if (signal?.aborted) throw new Error("Workflow execution aborted.");
    if (output.length > MAX_TEXT) throw new Error("Workflow output exceeds text limit.");
    if (step.operation === "template") {
      // Bound expansion before allocating the replacement string.
      const occurrences = step.template.split("{{input}}").length - 1;
      if (step.template.length + occurrences * (output.length - 9) > MAX_TEXT) throw new Error("Workflow output exceeds text limit.");
      // Callback replacement preserves literal dollar signs in the input.
      output = step.template.replaceAll("{{input}}", () => output);
    } else {
      let value: unknown = JSON.parse(output);
      for (const key of step.path) {
        if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error(`Workflow JSON field missing: ${key}`);
        value = (value as Record<string, unknown>)[key];
      }
      output = typeof value === "string" ? value : JSON.stringify(value);
    }
    if (output.length > MAX_TEXT) throw new Error("Workflow output exceeds text limit.");
  }
  return output;
}
