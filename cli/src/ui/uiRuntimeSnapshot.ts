import {
  listWorkers,
} from "../control/workers";

import {
  getSelectedModel,
} from "../llm/modelSelection";

import {
  listJobs,
} from "../runtime/jobQueue";

import {
  listWorkflowRuns,
} from "../runtime/workflowRunStore";

import {
  listHumanTasks,
} from "../runtime/humanTaskStore";

import {
  listApprovalChains,
} from "../runtime/approvalChainStore";

import {
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  resolveLlmProvider,
} from "../llm/llmClient";

import {
  getLlmTokensUsed,
} from "../llm/llmUsage";

export type UiRuntimeSnapshot = {
  readonly workers: number;
  readonly jobs: number;
  readonly workflowRuns: number;
  readonly businessFunctions: number;
  readonly humanWorkers: number;
  readonly humanTasks: number;
  readonly waitingApprovals: number;
  readonly modelProvider: string;
  readonly defaultModel: string;
  readonly tokensUsed: number;
};

/**
 * Purpose: Counts approval chains that are currently waiting for approval.
 *
 * Params:
 * - chains: Approval chains from the runtime store.
 *
 * Returns:
 * - Number of approval chains with pending status.
 *
 * PURE: No side effects.
 */
export function countWaitingApprovals(
  chains: readonly ReturnType<typeof listApprovalChains>[number][]
): number {
  return chains.filter(
    (chain) => chain.status === "pending"
  ).length;
}

/**
 * Purpose: Formats runtime snapshot data for the context panel.
 *
 * Params:
 * - snapshot: Current UI runtime snapshot.
 *
 * Returns:
 * - Multi-line context panel text.
 *
 * PURE: No side effects.
 */
export function formatRuntimeContextText(
  snapshot: UiRuntimeSnapshot
): string {
  return [
    "{cyan-fg}{bold}◆ ENTERPRISE PULSE{/bold}{/cyan-fg}",
    "{gray-fg}Live operational context{/gray-fg}",
    "",
    "{bold}CAPACITY{/bold}",
    "",
    `Ongoing Functions        {bold}${snapshot.businessFunctions}{/bold}`,
    `Workers             {bold}${snapshot.workers}{/bold}`,
    `Tasks               {bold}${snapshot.jobs}{/bold}`,
    `Workflow runs       {bold}${snapshot.workflowRuns}{/bold}`,
    `Human workers       {bold}${snapshot.humanWorkers}{/bold}`,
    `Human tasks         {bold}${snapshot.humanTasks}{/bold}`,
    "",
    "{bold}MODEL{/bold}",
    "",
    `Provider            {bold}${snapshot.modelProvider}{/bold}`,
    "Default model",
    `{gray-fg}${snapshot.defaultModel}{/gray-fg}`,
    `Tokens used         {bold}${snapshot.tokensUsed}{/bold}`,
    "",
    "{bold}GOVERNANCE{/bold}",
    "",
    `Approvals waiting   {bold}${snapshot.waitingApprovals}{/bold}`,
    "",
    "{bold}STATE{/bold}",
    "",
    "{green-fg}●{/green-fg} Console online",
    "{gray-fg}Local runtime{/gray-fg}",
  ].join("\n");
}

/**
 * Purpose: Reads current Arturo runtime state for the terminal UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Current runtime snapshot counts.
 *
 * SIDE EFFECT:
 * - Reads runtime stores.
 */
export function readUiRuntimeSnapshot(): UiRuntimeSnapshot {
  const provider =
    resolveLlmProvider(
      process.env.ARTURO_LLM_PROVIDER
    );

  const workers = listWorkers();

  return {
    workers: workers.length,
    humanWorkers: workers.filter((worker) => worker.kind === "human").length,
    jobs: listJobs().length,
    workflowRuns: listWorkflowRuns().length,
    businessFunctions:
      listBusinessFunctionDefinitions().length,
    humanTasks: listHumanTasks().length,
    waitingApprovals: countWaitingApprovals(
      listApprovalChains()
    ),
    // The operator's /model choice outranks the environment, and a paid
    // choice is labelled so its cost is never invisible in the status line.
    modelProvider:
      getSelectedModel()?.provider === "gemini"
        ? "Gemini (paid)"
        : getSelectedModel()
          ? "Ollama"
          : provider === "gemini"
            ? "Gemini"
            : "Ollama",
    defaultModel:
      getSelectedModel()?.model ??
      process.env.ARTURO_LLM_MODEL ??
      "llama3.2:latest",
    tokensUsed: getLlmTokensUsed(),
  };
}
