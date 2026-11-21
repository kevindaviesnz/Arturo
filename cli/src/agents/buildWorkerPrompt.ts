import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import {
  buildArchetypeInstructionBlock,
} from "./archetypeRegistry";

import type {
  Worker,
} from "../control/workers";

// Re-exported so existing importers keep working; the definitions are shared
// with the Workflow step prompt, which previously had no boundaries at all.
export {
  AUTHORSHIP_BOUNDARY,
  DATA_PROVENANCE_BOUNDARY,
  RECORDS_BOUNDARY,
} from "./outputBoundaries";

import {
  OUTPUT_BOUNDARIES,
} from "./outputBoundaries";

/**
 * Formats worker refinement instructions for the final worker prompt.
 *
 * @param refinement Worker-specific refinement text.
 * @returns Prompt section or empty string.
 *
 * PURE: No side effects.
 */
export function formatWorkerRefinementBlock(
  refinement: string | undefined
): string {
  if (
    !refinement ||
    refinement.trim().length === 0
  ) {
    return "";
  }

  return [
    "Worker-specific refinement:",
    "",
    refinement.trim(),
  ].join("\n");
}

/** Formats shared organizational knowledge supplied by the Runtime. */
export function formatOperationalMemoryBlock(
  entries: readonly string[]
): string {
  if (entries.length === 0) {
    return "";
  }

  return [
    "Relevant Operational Memory:",
    ...entries.map((entry) => `- ${entry}`),
    "Use this knowledge when relevant, but do not treat it as the current Task's raw evidence.",
  ].join("\n");
}


/** Formats records supplied by Arturo as authoritative execution context. */
export function formatAuthoritativeContextBlock(entries: readonly string[]): string {
  if (!entries.length) return "";
  return [
    "Authoritative Arturo context:",
    ...entries.map((entry) => `- ${entry}`),
    "Treat these records as authoritative. Do not replace them with assumptions about similarly named organisations.",
  ].join("\n");
}

/** Formats the runtime-controlled external tool boundary for one execution. */
export function formatExternalToolContextBlock(
  toolResults: readonly string[]
): string {
  if (
    toolResults.length ===
    0
  ) {
    return [
      "External tool results supplied to this execution: none.",
      "Do not claim to have searched, browsed, accessed sources, or verified citations. If external evidence is needed, state that it is unavailable.",
    ].join(
      "\n"
    );
  }

  return [
    "External tool results supplied to this execution:",
    ...toolResults.map(
      (result) =>
        `- ${result}`
    ),
    "Use only the captured results supplied below. Search snippets are unverified third-party content, not proof that a claim is true.",
    "Do not claim to have opened or read a result page, used a private account, or verified a source unless that separate evidence is explicitly supplied.",
  ].join(
    "\n"
  );
}

/**
 * Builds the final prompt sent to the LLM.
 *
 * @param worker Worker executing the task.
 * @param task User task.
 * @returns Fully constructed LLM prompt.
 *
 * PURE: No side effects.
 */
export function buildWorkerPrompt(
  worker: Worker<any, any>,
  task: string,
  operationalMemory: readonly string[] = [],
  authoritativeContext: readonly string[] = [],
  externalToolResults: readonly string[] = []
): string {
  const refinement =
    formatWorkerRefinementBlock(
      worker.refinement
    );
  const memory = formatOperationalMemoryBlock(
    operationalMemory
  );
  const context = formatAuthoritativeContextBlock(authoritativeContext);
  const tools =
    formatExternalToolContextBlock(
      externalToolResults
    );

  return renderEnterprisePrompt("Worker Task Execution", {
    ARCHETYPE_INSTRUCTIONS: worker.archetype
      ? buildArchetypeInstructionBlock(worker.archetype)
      : "You are a task worker producing the requested deliverable from supplied information.",
    TASK: task,
    BUSINESS_CONTEXT: context,
    OPERATIONAL_MEMORY: memory,
    EXTERNAL_TOOL_CONTEXT: tools,
    WORKER_REFINEMENT: refinement,
    OUTPUT_BOUNDARIES,
  });
}
