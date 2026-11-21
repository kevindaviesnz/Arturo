// src/control/workflowCompiler.ts

import { getWorker } from "./workers";

export type CompiledStep = {
  name: string;
  worker: any;
};

export type CompiledWorkflow = {
  name: string;
  steps: CompiledStep[];
};

/**
 * Compile-time validation only
 * → DOES NOT execute workflow
 */
export function compileWorkflowDefinition(
  name: string,
  steps: string[]
): CompiledWorkflow {
  const compiledSteps: CompiledStep[] = [];

  for (const step of steps) {
    const worker = getWorker(step);

    if (!worker) {
      throw new Error(
        `Workflow compile error: worker not found -> "${step}"`
      );
    }

    compiledSteps.push({
      name: step,
      worker,
    });
  }

  return {
    name,
    steps: compiledSteps,
  };
}