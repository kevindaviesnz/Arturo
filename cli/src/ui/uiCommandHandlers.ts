import { checkPassOn, describePassOn, getPassOnRule, setPassOn, type PassOnSetting } from "../runtime/passOnRules";
import { stopRoute } from "../runtime/resultPassOn";
import { setAsideTaskResult } from "../task/taskSetAside";
import { addClient, CLIENT_ADD_USAGE, describeClients, flagValue, resolveEnterprise, setUpBusiness } from "../clients/clientCommands";
import { startSetupFlow, replyToSetup, isSetupFlowActive, clearSetupFlow, runSetupScript, setupFlowHasSavedEnterprise, commandContinuesSetup } from "../setup/setupFlow";
import { startTaskWorkType, replyToTaskWorkType, isTaskWorkTypeActive, clearTaskWorkType } from "./uiTaskWorkType";
import { startLaterStaffMenu, replyToLaterStaff, isLaterStaffActive, clearLaterStaff } from "./uiStaffLater";
import { runWorkCommand } from "../work/workCommands";
import { refuseTypedWorkSettingCommand, resolveEnterpriseIdForTypedWorkCheck } from "../work/workLocks";
import { assignClientDesk, createClientAssistant, describeProposal, findClientAssistant, latestProposal, proposeClientAssistant } from "../clients/clientAssistant";
import { checklistFor, talkToAssistant } from "../clients/clientIntake";
import { changeFunctionChecks, describeFunctionChecks, getFunctionChecks, parseWordLimit } from "../business/functionChecks";
import { describeHandOff, refuseHandOff, removeHandOff, setHandOff } from "../runtime/handOff";
import { setBusinessFunctionFollowOn } from "../business/businessFunctionDefinitionStore";
import { formatBusinessFunctionStaffLines } from "../repl/businessFunctionCommands";
import { planTaskRetry } from "../task/planTaskRetry";
import { replyToTask } from "../task/replyToTask";
import { signOffTaskResult } from "../task/taskSignOff";
import { resolveJobEnterpriseId } from "../runtime/jobOrganisation";
import { handleWorkerLifecycleCommand } from "../repl/workerLifecycleCommands";
import { isWorkerAvailableForNewTask } from "../control/workers";
// src/ui/uiCommandHandlers.ts
import {
  formatTaskDetail,
} from "../repl/taskDetailCommands";

import { formatUiTable } from "./uiTable";
import { formatDisplayDate } from "./uiDate";

import { removeBusinessFunction } from "../business/businessFunctionRemoval";
import { createEnterpriseFunction, describeDuplicateFunction, findDuplicateFunction } from "../business/businessFunctionCreation";

import { readUiRuntimeSnapshot } from "./uiRuntimeSnapshot";

import {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  archetypeRegistry,
} from "../agents/archetypeRegistry";

import {
  createGeneratedWorkflow,
  type GeneratedWorkflowResult,
} from "../repl/generatedWorkflowCommand";

import {
  runPlannedWorkflowFromArgs,
  type PlannedWorkflowRunResult,
} from "../repl/plannedWorkflowRunCommand";

import {
  addWorker,
  CORE_CAPABILITIES,
  getWorker,
  createHumanWorker,
  isConsequentialCapability,
  listWorkers,
  registerAiWorker,
  type WorkerAvailability,
  type WorkerCapability,
} from "../control/workers";

import {
  designatedApproversForFunction,
} from "../staffing/functionApprovers";

import {
  listApprovalChains,
} from "../runtime/approvalChainStore";

import {
  isApprovalCapableMode,
  resolveDefaultHumanWorkerMode,
} from "../control/humanWorkerMode";

import {
  getModelRoutingStatus,
} from "../llm/modelRouting";

import {
  getEffectiveModelName,
} from "../llm/modelSelection";

import {
  INFERABLE_CAPABILITIES,
} from "../runtime/businessFunctionRuntimeRouting";

import {
  planAskWorkflow,
  type AskWorkflowResult,
} from "../repl/askWorkflow";

import {
  resetApplicationState,
} from "../repl/resetCommands";

import {
  getJob,
  listJobs,
} from "../runtime/jobQueue";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  readApprovalEntries,
} from "./uiApprovalEntries";

import {
  readHumanTaskEntries,
} from "./uiHumanTaskEntries";

import {
  createUiHelpEntry,
} from "./uiHelpEntries";

import {
  readJobDetailEntry,
} from "./uiJobDetailEntries";

import {
  createNumberedJobsListEntry,
} from "./uiJobEntries";

import {
  readTimelineEntries,
} from "./uiTimelineEntries";

import {
  WorkStreamEntry,
} from "./uiState";
import { createUiOverviewEntries, createWhatsWaitingEntries } from "./uiOverviewEntries";
import { formatWeeklyEmailAcceptances } from "../staffing/emailAcceptance";
import { isOwner } from "../identity/companySignIn";
import {
  formatSetupRequiredBody,
  isReadyForWork,
  readSetupState,
} from "./uiSetupProgress";
import { captureUiCommandOutput, REFUSED_LABEL } from "./uiConsoleCapture";
import { handleUiWorkerChatCommand } from "./uiWorkerChatEntries";
import {
  readModelRoutingEntry,
  readModelsEntry,
} from "./uiModelRoutingEntries";
import {
  handleTaskCreateCommand,
} from "../repl/taskRoutingCommands";
import {
  UI_PRIMARY_COMMANDS,
} from "./uiCommandHelp";
import {
  handleApproveCommand,
  handleRejectCommand,
  handleApprovalStatusCommand,
} from "../repl/approvalCommands";

import {
  handleBlockTaskCommand,
  handleCompleteTaskCommand,
  handleCreateTaskCommand,
  handleHumanTaskCommand,
  handleReviseTaskCommand,
} from "../repl/humanTaskCommands";

import {
  getHumanTask,
  listHumanTasks,
} from "../runtime/humanTaskStore";

import type {
  HumanTask,
} from "../runtime/humanTaskStore";

import {
  handleArtefactCommand,
  handleArtefactsCommand,
} from "../repl/artefactCommands";

import {
  getWorkflow,
  listWorkflows,
} from "../control/workflows";

import {
  listProcedures,
} from "../procedures/procedureStore";

import {
  formatProcedureReference,
} from "../procedures/procedure";

import {
  hasWorkerForArchetype,
} from "../repl/askWorkflow";

import {
  getArtefact,
  getArtefactVersion,
  listArtefacts,
} from "../artefacts/artefactStore";

import type {
  ArtefactReviewStatus,
} from "../artefacts/artefact";

import {
  ARTEFACT_KINDS,
} from "../artefacts/artefact";

import {
  readWorkerEntries,
  readWorkerInspectionEntry,
  readWorkersByCapabilityEntry,
} from "./uiWorkerEntries";

import {
  formatWorkerRemoval,
} from "../repl/workerInspectionCommands";

import {
  safelyRemoveWorker,
} from "../control/workerRemoval";

import {
  ARCHETYPE_USES,
  readArchetypeEntry,
} from "./uiArchetypeEntries";

import {
  listArchetypes,
} from "../agents/archetypeRegistry";

import {
  getCapabilityDescription,
  readCapabilitiesEntry,
} from "./uiCapabilityEntries";

import {
  handleWebSearchCommand,
  readWebSearchEntry,
} from "./uiWebSearchEntries";

import {
  handleUiScheduleCommand,
} from "./uiScheduleEntries";

import {
  refineWorker,
} from "../control/workers";

import {
  formatStartWorkflowResult,
} from "../repl/startWorkflowCommands";

import {
  startWorkflowRun,
} from "../runtime/startWorkflowRun";

import {
  getWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  wakeWorkerRuntime,
} from "../runtime/workerRuntime";

import {
  createAndSaveEnterprise,
  listEnterprises,
  updateEnterpriseDescription,
  updateEnterpriseMission,
  updateEnterpriseName,
} from "../enterprise/enterpriseStore";

import {
  DEFAULT_RECOMMENDATION_REASON,
  type BusinessFunctionRecommendation,
} from "../guidance/nextStepAdvisor";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  attachEnterpriseBusinessFunction,
  getEnterprise,
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  createEnterpriseBusinessFunctionId,
  formatBusinessFunctionCreatedNextAction,
} from "../repl/businessFunctionCommands";

import {
  formatEnterpriseCreatedNextAction,
  formatEnterpriseDetail,
} from "../repl/enterpriseCommands";

import {
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitions,
  listBusinessFunctionDefinitionsByEnterprise,
  updateBusinessFunctionDetails,
} from "../business/businessFunctionDefinitionStore";

import {
  failBusinessFunctionRuntime,
  pauseBusinessFunctionRuntime,
  resumeBusinessFunctionRuntime,
  startBusinessFunctionRuntime,
  stopBusinessFunctionRuntime,
} from "../business/businessFunctionRuntimeStore";

import type {
  BusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  handleUiRuntimeStartCommand,
} from "./uiRuntimeCommandHandlers";

import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  assignQueuedJobsToWorker,
  formatWorkerRegistered,
  getWorkerFlagValue,
  registerWorkerFromArgs,
  removeWorkerFlagPairs,
} from "../repl/workerRegistrationCommands";

import {
  evaluateNewWorkerForRunningRuntimes,
} from "../runtime/businessFunctionRuntimeWorkerSignal";

import {
  formatRuntimeSignalEvaluations,
} from "../runtime/businessFunctionRuntimeEvaluator";

import {
  handleUiMemoryCommand,
  readOperationalMemoryEntry,
} from "./uiMemoryEntries";

import {
  listAllOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  handleUiEventCommand,
  handleUiEventPublishCommand,
  handleUiEventRuleCommand,
  readEventEntries,
} from "./uiEventEntries";

import {
  listJobCompletionEventRules,
} from "../events/jobCompletionEventRuleStore";

import {
  handleUiHealthCommand,
} from "./uiHealthEntries";

import {
  handleUiGovernanceCommand,
} from "./uiGovernanceEntries";

import {
  loadPolicyRules,
} from "../storage/policyRepository";

import {
  handleUiDelegationCommand,
} from "./uiDelegationEntries";

import {
  listDelegationRequests,
} from "../delegation/delegationStore";

import {
  clearPendingNextConfirmation,
  consumePendingNextConfirmation,
  handleUiNextCommand,
  readPendingNextConfirmation,
  recordNextFeedback,
} from "./uiNextEntries";

import {
  isInteractiveSession,
  nonInteractiveRefusal,
} from "../core/interactivity";

import {
  startAdviseSession,
} from "./uiAdviseEntries";

import {
  handleUiStaffCommand,
  handleUiStartReadyFunctionsCommand,
} from "./uiStaffingEntries";

import {
  handleUiModelCommand,
} from "./uiModelEntries";

import {
  startAddHumanWorkerRole,
  startAddHumanWorkerFlow,
} from "./uiAddHumanWorkerFlow";

import {
  handleUiSuggestCommand,
  suggestFunctionChoices,
} from "./uiSuggestEntries";

import {
  resolveModelProfile,
} from "../llm/modelProfiles";

/**
 * Purpose: Handles a plain-language response to the pending /next confirmation.
 *
 * Params:
 * - response: User response submitted without a slash command.
 *
 * Returns:
 * - Confirmation result entries, or undefined when no /next confirmation is pending.
 *
 * SIDE EFFECT:
 * - May create recommended Business Function definitions and attach them to the Enterprise.
 * - Consumes the pending confirmation after yes or no.
 */
export function handleUiNextConfirmation(
  response: string
): readonly WorkStreamEntry[] | undefined {
  const pending =
    readPendingNextConfirmation();

  if (!pending) {
    return undefined;
  }

  const normalisedResponse =
    response.trim().toLowerCase();

  if (
    normalisedResponse === "no" ||
    normalisedResponse === "n"
  ) {
    const enterpriseName = pending.enterpriseName;
    clearPendingNextConfirmation();

    return [
      {
        actor: "Arturo",
        label: "Functions unchanged",
        // Declining left the operator with nothing at all: no Functions, and no
        // indication of what to do instead. Turning down a set of suggestions
        // is not the same as wanting to stop.
        body: [
          "No recommended Functions were created.",
          "",
          "Ask again with what you would rather have:",
          `  /next "${enterpriseName}" --feedback "<what these missed>"`,
          "",
          "Or write one yourself:",
          `  /function create "<name>" --enterprise "${enterpriseName}" --objective "<what must keep being true>"`,
        ].join("\n"),
      },
    ];
  }

  if (
    normalisedResponse !== "yes" &&
    normalisedResponse !== "y"
  ) {
    return [
      {
        actor: "Arturo",
        label: "Confirmation required",
        body: 'Reply "yes" to create all recommended Functions, or "no" to leave them unchanged.',
      },
    ];
  }

  const confirmed =
    consumePendingNextConfirmation();

  if (!confirmed) {
    return undefined;
  }

  const created = createRecommendedFunctions(
    confirmed.recommendations,
    confirmed.enterpriseId,
    confirmed.enterpriseName
  );

  return [
    ...stripRepeatedNextAction(
      created
    ),
    {
      actor: "Arturo",
      label: "Next",
      body: "Now put a team behind these. Run /staff and Arturo proposes who does the work — AI Workers for the routine parts, and you for anything that needs sign-off.",
    },
  ];
}

/**
 * Creates the given recommended Functions under an Enterprise, skipping any
 * whose name already exists. Shared by the "create all" confirmation and the
 * interactive one-at-a-time review.
 *
 * SIDE EFFECT: Registers Business Function definitions.
 */
export function createRecommendedFunctions(
  recommendations: readonly BusinessFunctionRecommendation[],
  enterpriseId: string,
  enterpriseName: string
): readonly WorkStreamEntry[] {
  const existingNames = new Set(
    listBusinessFunctionDefinitionsByEnterprise(enterpriseId).map(
      (definition) => definition.label.trim().toLowerCase()
    )
  );

  return recommendations.flatMap((recommendation) => {
    const normalisedName = recommendation.name.trim().toLowerCase();

    if (existingNames.has(normalisedName)) {
      return [
        {
          actor: "Arturo",
          label: "Function skipped",
          body: `${recommendation.name} already exists in ${enterpriseName}.`,
        },
      ];
    }

    existingNames.add(normalisedName);

    // The recommendation's "reason" is why Arturo proposed the Function, not a
    // description of it. When the model gave no reason the advisor fills a
    // placeholder; persisting that placeholder would feed "The model did not
    // explain this recommendation." into every Worker prompt. Carry a real
    // reason across only; otherwise leave the description empty.
    const description =
      recommendation.reason?.trim() &&
      recommendation.reason.trim() !== DEFAULT_RECOMMENDATION_REASON
        ? recommendation.reason.trim()
        : undefined;

    return handleUiFunctionCreateSubcommand([
      recommendation.name,
      "--enterprise",
      enterpriseId,
      "--objective",
      recommendation.objective,
      ...(description ? ["--description", description] : []),
    ]);
  });
}

// --- Interactive /next review (one Function at a time) ----------------------
//
// Instead of one long block of every recommended Function ending in a single
// "create all?" yes/no, an interactive operator reviews them one at a time,
// each shown with its objective, why Arturo suggests it, and a couple of
// example tasks, answering yes or skip. Only approved ones are created.
// Headless/CI keeps the whole-block guidance + yes/no.

type NextReview = {
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly recommendations: readonly BusinessFunctionRecommendation[];
  readonly index: number;
  readonly approved: readonly BusinessFunctionRecommendation[];
  /**
   * Set once every recommendation has been skipped: the next reply is what was
   * wrong with them, not another yes/skip. This is what --feedback was for, and
   * it is asked at the one moment it is obviously useful.
   */
  readonly awaitingFeedback?: boolean;
};

let pendingNextReview: NextReview | undefined;

export function isNextReviewActive(): boolean {
  return pendingNextReview !== undefined;
}

export function clearNextReview(): void {
  pendingNextReview = undefined;
}

/** Builds the card shown for one recommended Function. */
function formatFunctionReviewCard(
  recommendation: BusinessFunctionRecommendation,
  position: number,
  total: number
): WorkStreamEntry {
  const reason =
    recommendation.reason?.trim() &&
    recommendation.reason.trim() !== DEFAULT_RECOMMENDATION_REASON
      ? recommendation.reason.trim()
      : undefined;
  const examples = recommendation.exampleTasks ?? [];

  return {
    actor: "Arturo",
    label: `Area of work ${position} of ${total}`,
    body: [
      recommendation.name,
      `  What it keeps on top of: ${recommendation.objective}`,
      ...(reason ? [`  Why it helps:            ${reason}`] : []),
      "",
      ...(examples.length
        ? ["  For example, it could handle:", ...examples.map((task) => `    · ${task}`), ""]
        : []),
      `Add ${recommendation.name}? Reply yes to add, skip to leave it out, or ESC to stop.`,
    ].join("\n"),
  };
}

/**
 * Starts the interactive review. Returns a short intro plus the first Function
 * card; the reply router feeds each answer to handleNextReviewReply.
 */
export function startNextReview(
  enterpriseId: string,
  enterpriseName: string,
  recommendations: readonly BusinessFunctionRecommendation[]
): readonly WorkStreamEntry[] {
  pendingNextReview = { enterpriseId, enterpriseName, recommendations, index: 0, approved: [] };

  const intro: WorkStreamEntry = {
    actor: "Arturo",
    label: "Areas of work to set up",
    body: [
      `For ${enterpriseName}, Arturo suggests ${recommendations.length} ongoing area${recommendations.length === 1 ? "" : "s"} of work to set up (it calls these Functions).`,
      "I'll show them one at a time — say yes to add each, or skip.",
      "Nothing is created until you answer.",
    ].join("\n"),
  };

  return [intro, formatFunctionReviewCard(recommendations[0], 1, recommendations.length)];
}

/**
 * Routes a reply to the active /next review. Returns undefined when no review
 * is active so the caller can pass the reply on.
 *
 * SIDE EFFECT: On the final Function, creates the approved Functions.
 */
export function handleNextReviewReply(
  reply: string
): readonly WorkStreamEntry[] | undefined {
  if (!pendingNextReview) return undefined;

  const review = pendingNextReview;
  const trimmed = reply.trim().toLowerCase();

  if (trimmed === "cancel") {
    clearNextReview();
    return [{ actor: "Arturo", label: "Nothing created", body: "No Functions were created. Run /next any time to look again." }];
  }

  if (review.awaitingFeedback) {
    const enterpriseName = review.enterpriseName;
    clearNextReview();
    if (!reply.trim() || trimmed === "no" || trimmed === "skip") {
      return [
        {
          actor: "Arturo",
          label: "Nothing created",
          body: "No Functions were created. Run /next any time to look again.",
        },
      ];
    }
    recordNextFeedback(reply.trim());
    return [
      {
        actor: "Arturo",
        label: "Noted",
        body: `Arturo will take that into account for ${enterpriseName}. Run /next to see a fresh set.`,
      },
    ];
  }

  const recommendation = review.recommendations[review.index];
  let approved = review.approved;

  if (trimmed === "yes" || trimmed === "y") {
    approved = [...approved, recommendation];
  } else if (trimmed !== "skip" && trimmed !== "no" && trimmed !== "n") {
    return [{ actor: "Arturo", label: `Area of work ${review.index + 1} of ${review.recommendations.length}`, body: `Please reply yes to add ${recommendation.name}, skip to leave it out, or ESC to stop.` }];
  }

  const nextIndex = review.index + 1;

  if (nextIndex < review.recommendations.length) {
    pendingNextReview = { ...review, index: nextIndex, approved };
    return [formatFunctionReviewCard(review.recommendations[nextIndex], nextIndex + 1, review.recommendations.length)];
  }

  // Last Function answered — create the approved ones.
  clearNextReview();

  if (approved.length === 0) {
    // Skipping every one is the moment feedback matters most, so ask for it
    // rather than leaving --feedback to be discovered in the help.
    pendingNextReview = { ...review, approved, awaitingFeedback: true };
    return [
      {
        actor: "Arturo",
        label: "Nothing created",
        body: [
          "You skipped them all, so nothing was created.",
          "",
          "What was wrong with them? (For example: too many, or too close together.)",
          "Arturo will take it into account next time. Or type no to leave it.",
        ].join("\n"),
      },
    ];
  }

  return [
    ...stripRepeatedNextAction(
      createRecommendedFunctions(approved, review.enterpriseId, review.enterpriseName)
    ),
    {
      actor: "Arturo",
      label: "Next",
      body: "Now put a team behind these. Run /staff and Arturo proposes who does the work — AI Workers for the routine parts, and you for anything that needs sign-off.",
    },
  ];
}

/**
 * Removes the per-Function "Next: run /staff" block from a bulk creation.
 *
 * Creating five Functions at once repeated the identical next step five times,
 * which reads as noise and buries the Function detail it is attached to. The
 * caller appends it once instead.
 *
 * PURE: No side effects.
 */
export function stripRepeatedNextAction(
  entries: readonly WorkStreamEntry[]
): readonly WorkStreamEntry[] {
  return entries.map(
    (entry) => ({
      ...entry,
      body: entry.body
        .replace(
          /\n*\s*Run \/staff[^\n]*\n?/,
          ""
        )
        .trimEnd(),
    })
  );
}

/**
 * Purpose: Formats an optional enterprise description for UI output.
 *
 * Params:
 * - description: Optional enterprise description.
 *
 * Returns:
 * - Description text or "(none)".
 *
 * PURE: No side effects.
 */
export function formatUiEnterpriseDescription(
  description: string | undefined
): string {
  return description && description.trim().length > 0
    ? description
    : "(none)";
}

/**
 * Purpose: Lists flag-shaped tokens in UI command args that are not in the
 * command's recognised set, so a handler can refuse rather than silently
 * absorb an unknown flag (and its value) into a positional field such as a
 * Worker or Enterprise name.
 *
 * Params:
 * - args: Command arguments.
 * - knownFlags: Flags the command understands (each "--name").
 *
 * Returns:
 * - The unknown flag names, in first-seen order, without duplicates.
 *
 * PURE: No side effects.
 */
export function findUnknownUiFlags(
  args: readonly string[],
  knownFlags: readonly string[]
): readonly string[] {
  const known =
    new Set(knownFlags);
  const unknown: string[] = [];

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const flagName =
      arg.split("=", 1)[0];

    if (known.has(flagName) || unknown.includes(flagName)) {
      continue;
    }

    unknown.push(flagName);
  }

  return unknown;
}

/**
 * Purpose: Finds a flag value in UI command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Flag value or undefined.
 *
 * PURE: No side effects.
 */
export function getUiFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const equalsPrefix =
    `${flag}=`;

  const equalsIndex =
    args.findIndex(
      (arg) =>
        arg.startsWith(
          equalsPrefix
        )
    );

  if (equalsIndex !== -1) {
    const nextFlagOffset = args
      .slice(equalsIndex + 1)
      .findIndex((arg) => arg.startsWith("--"));
    const end = nextFlagOffset === -1
      ? args.length
      : equalsIndex + 1 + nextFlagOffset;
    return [
      args[equalsIndex].slice(equalsPrefix.length),
      ...args.slice(equalsIndex + 1, end),
    ].filter(Boolean).join(" ") || undefined;
  }

  const flagIndex =
    args.indexOf(
      flag
    );

  if (flagIndex === -1) {
    return undefined;
  }

  const nextFlagOffset = args
    .slice(flagIndex + 1)
    .findIndex((arg) => arg.startsWith("--"));
  const end = nextFlagOffset === -1
    ? args.length
    : flagIndex + 1 + nextFlagOffset;
  return args.slice(flagIndex + 1, end).join(" ") || undefined;
}

/**
 * Purpose: Removes a flag and its value from UI command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Args without the flag pair.
 *
 * PURE: No side effects.
 */
export function removeUiFlagPair(
  args: readonly string[],
  flag: string
): readonly string[] {
  const equalsPrefix =
    `${flag}=`;

  const flagIndex =
    args.findIndex(
      (arg) =>
        arg === flag ||
        arg.startsWith(
          equalsPrefix
        )
    );

  if (flagIndex === -1) {
    return args;
  }

  const nextFlagOffset = args
    .slice(flagIndex + 1)
    .findIndex((arg) => arg.startsWith("--"));
  const end = nextFlagOffset === -1
    ? args.length
    : flagIndex + 1 + nextFlagOffset;

  return [
    ...args.slice(0, flagIndex),
    ...args.slice(end),
  ];
}

/**
 * Purpose: Creates usage text for the /enterprise command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Enterprise command usage text.
 *
 * PURE: No side effects.
 */
export function createEnterpriseUsageText(): string {
  return [
    "Usage:",
    '  /enterprise "<name>" --description "<description>" [--mission "<mission>"]',
    '  /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
    '  /enterprise inspect "<name-or-id>"',
    '  /enterprise update "<name-or-id>" --description "<description>"',
    "  /enterprise list",
  ].join("\n");
}

/**
 * Purpose: Handles adding a business function to an enterprise from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for created function, usage, or error.
 *
 * SIDE EFFECT:
 * - Reads enterprise store.
 * - Mutates business function store.
 * - Mutates enterprise store.
 */
export function handleUiAddFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    enterpriseId,
    label,
    ...objectiveParts
  ] = args;

  const objective =
    objectiveParts
      .join(" ")
      .trim();

  if (!enterpriseId || !label || !objective) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /add-function <enterprise-id> "<function name>" "<objective>"',
      },
    ];
  }

  const enterprise =
    getEnterprise(
      enterpriseId
    );

  if (!enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseId}`,
      },
    ];
  }

  const id =
    createEnterpriseBusinessFunctionId(
      enterprise.name,
      label,
      listBusinessFunctionDefinitions().map(
        (definition) => definition.id
      )
    );

  createAndSaveBusinessFunctionDefinition({
    id,
    enterpriseId,
    label,
    objective,
    executionMode: "manual",
  });

  const businessFunction =
    createBusinessFunctionRuntime({
      id,
      label,
      objective,
      ownerWorker: "unassigned",
    });

  saveBusinessFunction(
    businessFunction
  );

  attachEnterpriseBusinessFunction(
    enterpriseId,
    businessFunction.id
  );

  return [
    {
      actor: "Arturo",
      label: "Business function added",
      body: [
        `enterprise: ${enterpriseId}`,
        `function: ${businessFunction.label}`,
        `id: ${businessFunction.id}`,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Handles /worker commands from the terminal UI.
 *
 * Params:
 * - args: Worker command arguments.
 *
 * Returns:
 * - Work stream entries for Worker registration or usage.
 *
 * SIDE EFFECT:
 * - May register a Worker.
 * - May complete the first running unassigned Job.
 */
export async function handleUiWorkerCommand(
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand !== "add") {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: [
          'Use /add-ai-worker "<name>" --archetype <archetype> [--model <local-model>] [--refine "<specialization>"]',
          'or /add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]',
        ].join("\n"),
      },
    ];
  }

  const result =
    registerWorkerFromArgs(
      subcommandArgs
    );

  if (!result.ok) {
    return [
      {
        actor: "Arturo",
        label: "Worker registration failed",
        body: result.message,
      },
    ];
  }

  const assignedJobs = assignQueuedJobsToWorker(result.worker);

  const evaluations = await evaluateNewWorkerForRunningRuntimes(
    result.worker
  );

  return [
    {
      actor: "Arturo",
      label: "Worker registered",
      body: formatWorkerRegistered(
        result.worker
      ) + `\n\nQueued Tasks assigned: ${assignedJobs}`,
    },
    ...(evaluations.length > 0
      ? [
          {
            actor: "Arturo",
            label: "Running Functions evaluated Worker availability",
            body: formatRuntimeSignalEvaluations(evaluations),
          },
        ]
      : []),
  ];
}

/**
 * Purpose: Creates a task detail usage entry.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining /task-detail usage.
 *
 * PURE: No side effects.
 */
export function createTaskDetailUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: 'Use /task inspect "<task-id>"',
  };
}

/**
 * Purpose: Handles task detail display for the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry containing task detail.
 *
 * SIDE EFFECT:
 * - Reads runtime task store through formatTaskDetail.
 */
export function handleUiTaskDetailCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    id,
  ] = args;

  return [
    {
      actor: "Arturo",
      label: "Task detail",
      body: id
        ? formatTaskDetail(
            id
          )
        : createTaskDetailUsageEntry().body,
    },
  ];
}

/**
 * Purpose: Formats workflow business function labels for display.
 *
 * Params:
 * - result: Completed ask workflow result.
 *
 * Returns:
 * - Business function display lines, or an empty list.
 *
 * PURE: No side effects.
 */
export function formatWorkflowBusinessFunctionLines(
  result: AskWorkflowResult
): readonly string[] {
  const labels =
    result.enforcedPlan.steps
      .map(
        (step) =>
          step.instruction.split(":")[0]?.trim() ?? ""
      )
      .filter(
        (label) =>
          label.length > 0
      );

  return labels.length === 0
    ? []
    : [
        `workflow steps: ${labels.length}`,
        "",
        ...labels.map(
          (label, index) =>
            `${index + 1}. ${label}`
        ),
        "",
      ];
}

/**
 * Purpose: Creates a fallback entry for unsupported UI commands.
 *
 * Params:
 * - command: Unsupported command name.
 *
 * Returns:
 * - Work stream entry explaining the unsupported command.
 *
 * PURE: No side effects.
 */
export function createUnsupportedUiCommandEntry(
  command: string
): WorkStreamEntry {
  const suggestions =
    findSimilarUiCommands(command);

  // "does not handle /check yet" implies a planned command, but this is the
  // catch-all for every typo. Plain text already gets a recovery block; a
  // mistyped command got nothing at all, which is the worse case of the two
  // because the operator knows the command exists and cannot see their slip.
  return {
    actor: "Arturo",
    label: "Unknown command",
    body: [
      `There is no ${command} command.`,
      ...(suggestions.length
        ? [
            "",
            suggestions.length === 1
              ? "Did you mean:"
              : "Did you mean one of:",
            ...suggestions.map(
              (name) => `  ${name}`
            ),
          ]
        : []),
      "",
      "Run /help for the full list.",
    ].join("\n"),
  };
}

/**
 * Finds commands close enough to a mistyped one to be worth offering.
 *
 * Deliberately conservative: a prefix match, or an edit distance of one or two
 * on a name long enough for that to mean something. Offering half the command
 * list would be no more useful than offering none.
 *
 * PURE: No side effects.
 */
export function findSimilarUiCommands(
  command: string
): readonly string[] {
  const typed = command.replace(/^\//, "").toLowerCase();
  if (!typed) return [];

  return UI_PRIMARY_COMMANDS.filter(
    (candidate) => {
      const name = candidate.replace(/^\//, "").toLowerCase();
      if (name === typed) return false;
      if (
        name.startsWith(typed) ||
        typed.startsWith(name)
      ) {
        return true;
      }
      const budget = typed.length >= 5 ? 2 : 1;
      return (
        editDistanceWithin(name, typed, budget)
      );
    }
  ).slice(0, 4);
}

/**
 * Whether two strings are within `budget` single-character edits of each other.
 *
 * PURE: No side effects.
 */
function editDistanceWithin(
  left: string,
  right: string,
  budget: number
): boolean {
  if (Math.abs(left.length - right.length) > budget) {
    return false;
  }

  let previous = Array.from(
    { length: right.length + 1 },
    (_unused, index) => index
  );

  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] =
        left[row - 1] === right[column - 1]
          ? previous[column - 1]
          : 1 +
            Math.min(
              previous[column - 1],
              previous[column],
              current[column - 1]
            );
    }
    if (Math.min(...current) > budget) return false;
    previous = current;
  }

  return previous[right.length] <= budget;
}

/**
 * Purpose: Creates an ask command usage entry.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining /ask usage.
 *
 * PURE: No side effects.
 */
export function createAskUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: 'Use /ask "<request>" or /ask --auto-workers "<request>"',
  };
}

/**
 * Purpose: Creates an ask workflow failure entry.
 *
 * Params:
 * - error: Unknown caught error.
 *
 * Returns:
 * - Work stream entry describing the failure.
 *
 * PURE: No side effects.
 */
export function createAskFailedEntry(
  error: unknown
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Workflow failed",
    body:
      error instanceof Error
        ? error.message
        : "Unknown /ask failure.",
  };
}

/**
 * Purpose: Formats auto-created worker details for UI display.
 *
 * Params:
 * - result: Completed ask workflow result.
 *
 * Returns:
 * - Human-readable auto-worker summary.
 *
 * PURE: No side effects.
 */
export function formatAutoWorkerSummary(
  result: AskWorkflowResult
): string {
  if (!result.autoWorkers) {
    return "disabled";
  }

  if (result.autoCreatedWorkers.length === 0) {
    return "enabled; created none";
  }

  return `enabled; created ${result.autoCreatedWorkers
    .map(
      (worker) =>
        `${worker.kind}:${worker.name}(${worker.archetype})`
    )
    .join(", ")}`;
}

/**
 * Purpose: Converts an ask workflow result into UI work stream entries.
 *
 * Params:
 * - result: Completed ask workflow result.
 *
 * Returns:
 * - Work stream entries describing the queued workflow.
 *
 * PURE: No side effects.
 */
export function createAskWorkflowResultEntries(
  result: AskWorkflowResult
): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Planner",
      label: "Objective classified",
      body: [
        `objective: ${result.objective.description}`,
        `type: ${result.objective.type}`,
        `lifetime: ${result.objective.lifetime}`,
        // The prompt asks for a reason only when the objective is unsupported,
        // and businessPattern can come back empty, so both are printed only
        // when they say something. Rendered unconditionally they produced a
        // labelled field with nothing after it, which reads as a value Arturo
        // failed to work out rather than one it never asked for.
        ...(result.objective.businessPattern
          ? [`business pattern: ${result.objective.businessPattern}`]
          : []),
        `supported: ${result.objective.supported ? "yes" : "no"}`,
        ...(result.objective.reason
          ? [`reason: ${result.objective.reason}`]
          : []),
      ].join("\n"),
    },
    {
      actor: "Planner",
      label: "Workflow created",
      body: [
        `workflow objective: ${result.enforcedPlan.objective}`,
        `workflow run: ${result.workflowRunId}`,
        `steps planned: ${result.stepCount}`,
        ...formatWorkflowBusinessFunctionLines(
          result
        ),
        `first worker: ${result.firstWorkerName ?? "none"}`,
        formatCreatedWorkerCount(
          result
        ),
      ].join("\n"),
    },
    {
      actor: "Arturo",
      label: "Next",
      body: [
        "Plan is ready for review.",
        "",
        // This used to say "Use /tasks to review the plan", and /tasks then
        // answered "No tasks found" — the plan's steps do not become Tasks
        // until /start creates them, which the very next line said. Pointing
        // at the command that shows nothing yet made a working plan look like
        // a failed one.
        `The plan has ${result.stepCount} step${result.stepCount === 1 ? "" : "s"}. No Tasks exist yet, so /tasks will not show them.`,
        `Use /start ${result.workflowRunId} to create its Tasks and begin execution.`,
        "Then /tasks lists them, and /task inspect \"<task-id>\" reads one in full.",
        "",
        "Nothing runs until you start it.",
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Formats the number of workers created for a workflow.
 *
 * Params:
 * - result: Completed ask workflow result.
 *
 * Returns:
 * - Human-readable worker creation count.
 *
 * PURE: No side effects.
 */
export function formatCreatedWorkerCount(
  result: AskWorkflowResult
): string {
  return result.autoWorkers
    ? `workers created: ${result.autoCreatedWorkers.length}`
    : "workers created: 0";
}

/**
 * Purpose: Creates a usage entry for worker registration commands.
 *
 * Params:
 * - command: Command name.
 * - usage: Usage text.
 *
 * Returns:
 * - Work stream entry explaining command usage.
 *
 * PURE: No side effects.
 */
export function createWorkerRegistrationUsageEntry(
  command: string,
  usage: string
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: `${command}: ${usage}`,
  };
}

/**
 * Purpose: Creates an unknown-archetype entry.
 *
 * Params:
 * - archetype: Unknown archetype value.
 *
 * Returns:
 * - Work stream entry explaining allowed archetypes.
 *
 * PURE: No side effects.
 */
export function createUnknownArchetypeEntry(
  archetype: string
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Unknown archetype",
    body: [
      `unknown archetype: ${archetype}`,
      `allowed archetypes: ${Object.keys(archetypeRegistry).join(", ")}`,
    ].join("\n"),
  };
}

export type AiWorkerRegistrationArgs = {
  readonly name?: string;
  readonly archetype: string;
  readonly model?: string;
  readonly refinement?: string;
  readonly usesFlagSyntax?: boolean;
  /**
   * True when only a name was given and "assistant" was filled in. The
   * archetype decides the Worker's capabilities and therefore what it can be
   * routed to, so an interactive operator is asked rather than defaulted; a
   * headless run keeps the default so scripts do not block.
   */
  readonly archetypeInferred?: boolean;
};

/**
 * Parses the primary flag syntax and the older positional syntax.
 * Positional parsing remains available so existing demonstrations still run.
 */
export function parseAiWorkerRegistrationArgs(
  args: readonly string[]
): AiWorkerRegistrationArgs {
  const usesFlagSyntax =
    args.some(
      (arg) =>
        arg.startsWith("--")
    );

  if (usesFlagSyntax) {
    const positionalArgs =
      removeWorkerFlagPairs(
        args,
        [
          "--archetype",
          "--model",
          "--refine",
        ]
      );

    return {
      name:
        positionalArgs.join(" ").trim() ||
        undefined,
      archetype:
        getWorkerFlagValue(
          args,
          "--archetype"
        ) ?? "",
      model:
        getWorkerFlagValue(
          args,
          "--model"
        ),
      refinement:
        getWorkerFlagValue(
          args,
          "--refine"
        ),
      usesFlagSyntax: true,
    };
  }

  let archetypeIndex = -1;
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (archetypeRegistry[args[index] as AgentArchetype]) {
      archetypeIndex = index;
      break;
    }
  }

  if (archetypeIndex < 0) {
    if (args.length > 1) {
      return {
        name: args.slice(0, -1).join(" ").trim() || undefined,
        archetype: args[args.length - 1],
      };
    }
    return {
      name: args.join(" ").trim() || undefined,
      archetype: "assistant",
      archetypeInferred: true,
    };
  }

  return {
    name: args.slice(0, archetypeIndex).join(" ").trim() || undefined,
    archetype: args[archetypeIndex],
    model: args[archetypeIndex + 1],
  };
}

/**
 * Purpose: Registers an AI worker from terminal UI command arguments.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entries describing the result.
 *
 * SIDE EFFECT:
 * - Registers an AI worker.
 * - Broadcasts runtime event.
 */
export function handleUiAddAiWorker(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  // The model is chosen in one place, /model, and holds until it is changed
  // there. A per-Worker model never actually reached the provider — it only
  // put a second, wrong name in the Worker record and its attestations.
  if (args.includes("--model")) {
    return [
      {
        actor: "Arturo",
        label: "Choose models with /model",
        body: [
          "--model has been replaced by the /model command.",
          "Run /model to choose which AI model Arturo uses. Every Worker uses that choice until you change it there.",
        ].join("\n"),
      },
    ];
  }

  const unknownFlags =
    findUnknownUiFlags(
      args,
      ["--archetype", "--refine"]
    );

  if (unknownFlags.length > 0) {
    return [
      {
        actor: "Arturo",
        label: "Unknown option",
        body: [
          `/add-ai-worker does not accept ${unknownFlags.join(", ")}.`,
          "",
          '/add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]',
        ].join("\n"),
      },
    ];
  }

  const {
    name,
    archetype: archetypeRaw,
    refinement,
    usesFlagSyntax,
    archetypeInferred,
  } = parseAiWorkerRegistrationArgs(args);

  if (
    !name ||
    (usesFlagSyntax && !archetypeRaw)
  ) {
    return [
      createWorkerRegistrationUsageEntry(
        "/add-ai-worker",
        '/add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]'
      ),
    ];
  }

  // A name with no role: ask, rather than quietly registering an "assistant".
  // The archetype decides the Worker's capabilities, and therefore what Tasks
  // it can be routed to at all.
  if ((archetypeInferred || !archetypeRaw) && name && isInteractiveSession()) {
    commandMenu = { kind: "aiworker", stage: "role", name };
    return [askAiWorkerRole(name)];
  }

  const archetype = archetypeRaw;

  const definition =
    archetypeRegistry[
      archetype as AgentArchetype
    ];

  if (!definition) {
    return [
      createUnknownArchetypeEntry(
        archetype
      ),
    ];
  }

  // Every Worker runs on whatever /model currently selects. Recording that
  // name here keeps the Worker record honest at the moment of registration;
  // execution and attestation read the live choice, so changing /model later
  // changes what actually runs.
  const resolvedModel = getEffectiveModelName();

  const worker =
    registerAiWorker(
      name,
      archetype as AgentArchetype,
      resolvedModel,
      refinement
    );
  const assignedJobs = assignQueuedJobsToWorker(worker);

  broadcastEvent(
    "worker.registered",
    "success",
    `AI worker registered: ${name} (total: ${listWorkers().length})`
  );

  return [
    {
      actor: "Arturo",
      label: "AI worker added",
      body: [
        `name: ${name}`,
        `archetype: ${archetype}`,
        `model: ${resolvedModel} (chosen with /model)`,
        `refinement: ${refinement?.trim() || "none"}`,
        `queued Tasks assigned: ${assignedJobs}`,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Registers a human worker from terminal UI command arguments.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entries describing the result.
 *
 * SIDE EFFECT:
 * - Registers a human worker.
 * - Broadcasts runtime event.
 */
export function handleUiAddHumanWorker(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const usesFlagSyntax =
    args.some(
      (arg) =>
        arg.startsWith("--")
    );
  const knownFlags =
    [
      "--archetype",
      "--email",
      "--availability",
      "--refine",
    ];

  // A Human Worker's name is the trust anchor for every approval it signs, so
  // an unrecognised flag must be refused rather than absorbed into the name.
  // --model is called out because it is documented as "intentionally not
  // accepted" for Humans, who never use a model.
  const unknownFlags =
    findUnknownUiFlags(
      args,
      knownFlags
    );

  if (unknownFlags.length > 0) {
    const modelNote =
      unknownFlags.includes("--model")
        ? [
            "",
            "Human Workers do not use a model, so --model is not accepted.",
          ]
        : [];
    return [
      {
        actor: "Arturo",
        label: "Unknown option",
        body: [
          `/add-human-worker does not accept ${unknownFlags.join(", ")}.`,
          ...modelNote,
          "",
          '/add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]',
        ].join("\n"),
      },
    ];
  }

  const positionalArgs =
    usesFlagSyntax
      ? removeWorkerFlagPairs(
          args,
          knownFlags
        )
      : args;
  const name =
    usesFlagSyntax
      ? positionalArgs.join(" ").trim()
      : positionalArgs[0];
  const archetypeRaw =
    usesFlagSyntax
      ? getWorkerFlagValue(
          args,
          "--archetype"
        )
      : positionalArgs[1];
  const email =
    usesFlagSyntax
      ? getWorkerFlagValue(
          args,
          "--email"
        )
      : positionalArgs[2];
  const availabilityRaw =
    getWorkerFlagValue(
      args,
      "--availability"
    ) ?? "available";
  const refinement =
    getWorkerFlagValue(
      args,
      "--refine"
    );

  if (!name) {
    // No name and no flags: start the switch-free guided flow (name, then role
    // by number). Anyone who did pass flags but no name still gets the usage
    // line, since they are clearly scripting.
    if (!usesFlagSyntax) {
      return startAddHumanWorkerFlow();
    }
    return [
      createWorkerRegistrationUsageEntry(
        "/add-human-worker",
        '/add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]'
      ),
    ];
  }

  const archetype =
    archetypeRaw as AgentArchetype | undefined;

  if (
    archetype &&
    !archetypeRegistry[
      archetype
    ]
  ) {
    return [
      createUnknownArchetypeEntry(
        archetype
      ),
    ];
  }

  // No role given: ask. The role decides whether this person can approve
  // governed work, which is usually the reason they are being added at all.
  // Registering them role-less silently produced someone who cannot approve,
  // and that only surfaced later at /approve.
  if (!archetypeRaw && isInteractiveSession()) {
    return startAddHumanWorkerRole(name);
  }

  if (
    ![
      "available",
      "busy",
      "offline",
    ].includes(
      availabilityRaw
    )
  ) {
    return [
      {
        actor: "Arturo",
        label: "Unknown availability",
        body: `unknown availability: ${availabilityRaw}\nallowed availability: available, busy, offline`,
      },
    ];
  }

  addWorker(
    createHumanWorker(
      name,
      archetype,
      email,
      availabilityRaw as WorkerAvailability,
      refinement
    )
  );

  broadcastEvent(
    "worker.registered",
    "success",
    `Human worker registered: ${name}`
  );

  // A Human added with no approving role cannot clear a Governance hold. Saying
  // so here — rather than letting the operator discover it only when /approve
  // refuses — closes the loop a walkthrough got stuck in.
  const approvalNote = isApprovalCapableMode(
    resolveDefaultHumanWorkerMode(archetype)
  )
    ? []
    : [
        "",
        `${name} can be assigned Human Tasks, but their role does not include signing off work or giving go-aheads governed work.`,
        `To register someone who can sign off work and give go-aheads, add --archetype guardian (or --archetype reviewer), then re-run /staff.`,
      ];

  return [
    {
      actor: "Arturo",
      label: "Human worker added",
      body: [
        `name: ${name}`,
        `archetype: ${archetype ?? "none"}`,
        `email: ${email ?? "none"}`,
        `availability: ${availabilityRaw}`,
        `refinement: ${refinement?.trim() || "none"}`,
        ...approvalNote,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Creates a successful runtime reset entry.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry describing the reset.
 *
 * PURE: No side effects.
 */
export function createResetSuccessEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Everything deleted",
    body: "Arturo is now empty, as though you had just installed it.",
  };
}

/**
 * Purpose: Handles the terminal UI /reset command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries describing the reset result.
 *
 * SIDE EFFECT:
 * - Resets Arturo application/runtime state.
 */
/** Set when /reset has warned and is waiting for the operator to confirm. */
let pendingResetConfirmation = false;

export function clearPendingResetConfirmation(): void {
  pendingResetConfirmation = false;
}

/**
 * Formats the warning shown before a reset, listing what would be destroyed.
 *
 * Naming the actual counts is the point: "this deletes everything" is easy to
 * skim past, while "5 Functions, 6 Workers, 12 Tasks" is not.
 *
 * PURE: No side effects.
 */
export function formatResetWarning(
  snapshot: {
    readonly businessFunctions: number;
    readonly workers: number;
    readonly jobs: number;
    readonly humanTasks: number;
    readonly waitingApprovals: number;
  }
): string {
  return [
    "This permanently deletes everything in this Arturo installation:",
    "",
    `  Functions         ${snapshot.businessFunctions}`,
    `  Workers           ${snapshot.workers}`,
    `  Tasks             ${snapshot.jobs}`,
    `  Human Tasks       ${snapshot.humanTasks}`,
    `  Approvals waiting ${snapshot.waitingApprovals}`,
    "",
    "Enterprises, Governance policies, Events, Schedules, Memory, Artefacts,",
    "chat history, and the Timeline all go with them. There is no undo.",
    "",
    'Reply "yes" to delete everything, or "no" to keep it.',
  ].join("\n");
}

/**
 * Handles `/task retry <task-id>`: creates a failed Task again as a new one.
 *
 * The new Task goes through the same creation, routing and Governance as one
 * typed by hand. Nothing is copied from the failed Task's approval.
 *
 * SIDE EFFECT: Creates a Task.
 */
export function handleUiTaskRetryCommand(
  taskId: string | undefined
): readonly WorkStreamEntry[] {
  if (!taskId) {
    return [
      {
        actor: "Arturo",
        label: "Task retry",
        body: "Usage: /task retry <task-id>",
      },
    ];
  }

  const plan = planTaskRetry(taskId);

  if (!plan.retry) {
    return [
      {
        actor: "Arturo",
        label: "Task retry",
        body: plan.reason,
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Task retry",
      body: `Creating ${taskId} again as a new Task. It is routed and governed afresh; any approval given to ${taskId} does not carry over.`,
    },
    captureUiCommandOutput(
      "Task created",
      () => handleTaskCreateCommand([...plan.createArgs])
    ),
  ];
}

/**
 * Handles /reset, warning before destroying state.
 *
 * A destructive, irreversible command fired on first press with no
 * confirmation. That is survivable on an empty installation and not survivable
 * on a month of work.
 *
 * SIDE EFFECT:
 * - Reads runtime counts.
 * - Arms a pending confirmation; does not delete anything on its own.
 */
export function handleUiResetCommand(): readonly WorkStreamEntry[] {
  const snapshot =
    readUiRuntimeSnapshot();

  pendingResetConfirmation = true;

  return [
    {
      actor: "Arturo",
      label: "Reset requested",
      body: formatResetWarning(
        snapshot
      ),
    },
  ];
}

/**
 * Applies a reply to a pending reset, or returns undefined when none is armed.
 *
 * SIDE EFFECT: Deletes application state when the reply confirms.
 */
export function handleUiResetConfirmation(
  reply: string
): readonly WorkStreamEntry[] | undefined {
  if (!pendingResetConfirmation) {
    return undefined;
  }

  const normalized =
    reply.trim().toLowerCase();

  if (normalized === "yes" || normalized === "y") {
    pendingResetConfirmation = false;
    resetApplicationState();

    return [
      createResetSuccessEntry(),
    ];
  }

  if (normalized === "no" || normalized === "n") {
    pendingResetConfirmation = false;

    return [
      {
        actor: "Arturo",
        label: "Reset cancelled",
        body: "Nothing was deleted.",
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Confirmation required",
      body: 'Reply "yes" to delete everything, or "no" to keep it.',
    },
  ];
}

/**
 * Purpose: Creates a workflow command usage entry.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining /workflow usage.
 *
 * PURE: No side effects.
 */
export function createWorkflowUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: 'Use /workflow "<workflow request>"',
  };
}

/**
 * Purpose: Creates a workflow generation failure entry.
 *
 * Params:
 * - error: Unknown caught error.
 *
 * Returns:
 * - Work stream entry describing the failure.
 *
 * PURE: No side effects.
 */
export function createWorkflowFailedEntry(
  error: unknown
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Workflow generation failed",
    body:
      error instanceof Error
        ? error.message
        : "Unknown /workflow failure.",
  };
}

/**
 * Purpose: Formats generated workflow steps for terminal display.
 *
 * Params:
 * - result: Generated workflow result.
 *
 * Returns:
 * - Multi-line workflow step summary.
 *
 * PURE: No side effects.
 */
export function formatGeneratedWorkflowSteps(
  result: GeneratedWorkflowResult
): string {
  return result.plan.steps
    .map(
      (step, index) =>
        `${index + 1}. ${step.archetype} — ${step.instruction}`
    )
    .join("\n");
}

/**
 * Purpose: Converts a generated workflow result into UI work stream entries.
 *
 * Params:
 * - result: Generated workflow result.
 *
 * Returns:
 * - Work stream entries describing the saved workflow.
 *
 * PURE: No side effects.
 */
export function createGeneratedWorkflowEntries(
  result: GeneratedWorkflowResult
): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Arturo",
      label: "Workflow created",
      body: [
        `name: ${result.name}`,
        "mode: planned",
        `source: ${result.generationMode ?? "model-generated"}`,
        `objective: ${result.plan.objective}`,
        result.plan.explanation
          ? `explanation: ${result.plan.explanation}`
          : "explanation: none",
        "",
        "steps:",
        formatGeneratedWorkflowSteps(
          result
        ),
      ].join("\n"),
    },
    {
      actor: "Arturo",
      label: "Next",
      body: `Use /run ${result.name} to start this workflow.`,
    },
  ];
}

/**
 * Purpose: Creates a /run usage entry for the terminal UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining /run usage.
 *
 * PURE: No side effects.
 */
export function createRunUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: 'Use /run [--auto-workers] <workflow> "<task>"',
  };
}

/**
 * Purpose: Creates a planned workflow run failure entry.
 *
 * Params:
 * - error: Unknown caught error.
 *
 * Returns:
 * - Work stream entry describing the failure.
 *
 * PURE: No side effects.
 */
export function createPlannedWorkflowRunFailedEntry(
  error: unknown
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Run failed",
    body:
      error instanceof Error
        ? error.message
        : "Unknown planned workflow run failure.",
  };
}

/**
 * Purpose: Handles workflow start from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry describing the start result.
 *
 * SIDE EFFECT:
 * - Reads workflow run store.
 * - Starts workflow execution.
 * - Wakes worker runtime.
 */
export function handleUiStartWorkflowCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    workflowRunId,
  ] = args;

  if (!workflowRunId) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: "Use /start <run-id>",
      },
    ];
  }

  const run =
    getWorkflowRun(
      workflowRunId
    );

  if (!run?.executionPlan) {
    return [
      {
        actor: "Arturo",
        label: "Workflow start failed",
        body: `workflow execution plan not found: ${workflowRunId}`,
      },
    ];
  }

  try {
    const result =
      startWorkflowRun(
        workflowRunId,
        run.executionPlan
      );

    wakeWorkerRuntime();

    return [
      {
        actor: "Arturo",
        label: "Workflow started",
        body: formatStartWorkflowResult(
          result.workflowRunId,
          result.jobIds
        ),
      },
    ];
  } catch (error) {
    return [
      {
        actor: "Arturo",
        label: "Workflow start failed",
        body:
          error instanceof Error
            ? error.message
            : String(error),
      },
    ];
  }
}

/**
 * Purpose: Formats auto-created workers for terminal display.
 *
 * Params:
 * - result: Planned workflow run result.
 *
 * Returns:
 * - Human-readable auto-worker summary.
 *
 * PURE: No side effects.
 */
export function formatPlannedRunAutoWorkers(
  result: PlannedWorkflowRunResult
): string {
  if (!result.autoWorkers) {
    return "disabled";
  }

  if (result.autoCreatedWorkers.length === 0) {
    return "enabled; created none";
  }

  return `enabled; created ${result.autoCreatedWorkers
    .map(
      (worker) =>
        `${worker.name}(${worker.archetype})`
    )
    .join(", ")}`;
}

/**
 * Purpose: Converts a planned workflow run result into UI work stream entries.
 *
 * Params:
 * - result: Planned workflow run result.
 *
 * Returns:
 * - Work stream entries describing the queued workflow run.
 *
 * PURE: No side effects.
 */
export function createPlannedWorkflowRunEntries(
  result: PlannedWorkflowRunResult
): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Arturo",
      label: "Planned workflow run queued",
      body: [
        `workflow: ${result.workflowName}`,
        `workflow run: ${result.workflowRunId}`,
        `steps: ${result.stepCount}`,
        `first worker: ${result.firstWorkerName ?? "none"}`,
        `auto-workers: ${formatPlannedRunAutoWorkers(result)}`,
      ].join("\n"),
    },
    {
      actor: "Arturo",
      label: "Next",
      body: "Use /tasks, /task inspect <task-id>, or /timeline to inspect progress.",
    },
  ];
}

/**
 * Purpose: Creates worker refinement entry.
 *
 * Params:
 * - workerName: Worker name.
 *
 * Returns:
 * - Work stream entry describing refinement.
 *
 * PURE: No side effects.
 */
export function createWorkerRefinedEntry(
  workerName: string,
  specialisation?: string
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Worker refined",
    body: [
      `worker refined: ${workerName}`,
      ...(specialisation?.trim()
        ? ["", "Specialisation:", specialisation.trim()]
        : []),
    ].join("\n"),
  };
}

/**
 * Purpose: Creates UI entries for stored enterprises.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries for enterprises.
 *
 * SIDE EFFECT:
 * - Reads enterprise store.
 */
export function createEnterpriseEntries(): readonly WorkStreamEntry[] {
  const enterprises =
    listEnterprises();

  if (enterprises.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Enterprises",
        body: "No enterprises.",
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Enterprises",
      body: formatUiTable(
        ["ID", "Name", "Status", "Functions"],
        enterprises.map(
          (enterprise) => [
            enterprise.id,
            enterprise.name,
            enterprise.status,
            String(enterprise.businessFunctionIds.length),
          ]
        )
      ),
    },
  ];
}

/**
 * Purpose: Handles /enterprise create from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "create".
 *
 * Returns:
 * - Work stream entry for created enterprise or usage.
 *
 * SIDE EFFECT:
 * - Mutates enterprise store.
 */
export function handleUiEnterpriseCreateSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const mission =
    getUiFlagValue(
      args,
      "--mission"
    )?.trim() ?? "";

  const description =
    getUiFlagValue(
      args,
      "--description"
    )?.trim();

  const positionalArgs =
    removeUiFlagPair(
      removeUiFlagPair(
        args,
        "--mission"
      ),
      "--description"
    );

  const [
    name,
  ] = positionalArgs;

  if (!name) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /enterprise "<name>" --description "<description>" or /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
      },
    ];
  }

  // A business with no mission is a hollow record: the mission is the context
  // every Worker is given. Rather than creating one silently, ask — the same
  // question the guided flow asks, entered at the point the value is missing.
  // Presence of the flag, not its value: "--mission" with an empty value is
  // the guided flow's "skip" coming back, and must not re-ask forever.
  const missionSupplied =
    args.includes("--mission") ||
    args.some((arg) => arg.startsWith("--mission="));

  if (!missionSupplied && !description && isInteractiveSession()) {
    commandMenu = { kind: "enterprise", stage: "create-mission", name };
    return [
      {
        actor: "Arturo",
        label: "Mission:",
        body: [
          `In one sentence, what does ${name} exist to do?`,
          "",
          "This is the context Arturo gives Workers, so plain and specific beats polished.",
          "Or type skip to leave it blank for now.",
        ].join("\n"),
      },
    ];
  }

  const enterprise =
    createAndSaveEnterprise({
      name,
      mission,
      description,
    });

  return [
    {
      actor: "Arturo",
      label: "Enterprise created",
      body: [
        "Enterprise created.",
        "",
        `  ID:                  ${enterprise.id}`,
        `  Name:                ${enterprise.name}`,
        `  Mission:             ${enterprise.mission?.trim() || "(none)"}`,
        `  Description:         ${formatUiEnterpriseDescription(enterprise.description)}`,
        `  Status:              ${enterprise.status}`,
        `  Created:             ${formatDisplayDate(enterprise.createdAt)}`,
        // Functions, Workers and Policies are all 0 on a business that was
        // created a moment ago, so three rows of zero were the widest part of
        // the block and said nothing.
        "",
        formatEnterpriseCreatedNextAction(
          enterprise
        ),
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Handles `/enterprise create --advise` — starts an interactive advisory
 * conversation for non-technical operators. Arturo talks with the operator in
 * plain language, reacting to what they say (answered as plain text via the
 * advise-session continuation), then synthesises a mission, creates the
 * Enterprise, and recommends Business Functions. The Enterprise is created only
 * after the conversation ends, so cancelling leaves nothing behind.
 *
 * The Enterprise name is optional: an operator who hasn't named their business
 * yet can omit it, and Arturo will propose a name once the conversation gives it
 * enough to go on, which the operator confirms or overrides.
 *
 * The conversation needs a human to answer, so it refuses in a non-interactive
 * session rather than hanging or guessing.
 *
 * SIDE EFFECT: Starts the module-level advise session (no Enterprise yet) and
 * calls the configured LLM provider for the opening turn.
 */
export async function handleUiEnterpriseAdviseCreateSubcommand(
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  if (!isInteractiveSession()) {
    return [
      {
        actor: "Arturo",
        label: "Interactive guidance unavailable",
        body: nonInteractiveRefusal(
          "/enterprise create --advise",
          'Create the Enterprise directly with /enterprise create "<name>" --mission "<mission>", then run /next "<name>".'
        ),
      },
    ];
  }

  const positionalArgs =
    removeUiFlagPair(
      removeUiFlagPair(
        args.filter(
          (arg) =>
            arg !== "--advise" &&
            arg !== "--chat"
        ),
        "--mission"
      ),
      "--description"
    );

  const [name] = positionalArgs;

  return [
    await startAdviseSession(
      name
    ),
  ];
}

/**
 * Purpose: Handles /enterprise inspect from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "inspect".
 *
 * Returns:
 * - Work stream entry containing enterprise detail or usage.
 *
 * SIDE EFFECT:
 * - Reads enterprise and business function stores.
 */
export function handleUiEnterpriseInspectSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    idOrName,
  ] = args;

  if (!idOrName) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /enterprise inspect "<name-or-id>"',
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Enterprise detail",
      body: formatEnterpriseDetail(
        idOrName
      ),
    },
  ];
}

/**
 * Purpose: Handles /enterprise update from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "update".
 *
 * Returns:
 * - Work stream entry for updated enterprise, usage, or not found.
 *
 * SIDE EFFECT:
 * - Mutates enterprise store.
 */
export function handleUiEnterpriseUpdateSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    idOrName,
  ] = args;

  const unknownFlags =
    findUnknownUiFlags(
      args,
      ["--description", "--name", "--mission"]
    );

  if (unknownFlags.length > 0) {
    return [
      {
        actor: "Arturo",
        label: "Unknown option",
        body: [
          `/enterprise update does not accept ${unknownFlags.join(", ")}.`,
          "",
          'Use /enterprise update "<name-or-id>" --description "<description>"',
          '  or  --mission "<mission>"',
          '  or  --name "<corrected name>"',
        ].join("\n"),
      },
    ];
  }

  const description =
    getUiFlagValue(
      args,
      "--description"
    )?.trim();

  const mission =
    getUiFlagValue(
      args,
      "--mission"
    )?.trim();

  const name =
    getUiFlagValue(
      args,
      "--name"
    )?.trim();

  if (!idOrName || (!description && !mission && !name)) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: [
          'Use /enterprise update "<name-or-id>" --description "<description>"',
          'or  /enterprise update "<name-or-id>" --mission "<mission>"',
          'or  /enterprise update "<name-or-id>" --name "<corrected name>"',
        ].join("\n"),
      },
    ];
  }

  // Apply the requested fields in turn, threading the latest record through so
  // a single command can rename, re-mission, and re-describe together. Each
  // step re-resolves by the current name so a rename earlier in the chain does
  // not strand the later lookups.
  let enterprise =
    name
      ? updateEnterpriseName(
          idOrName,
          name
        )
      : getEnterpriseByIdOrName(idOrName);

  if (!enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${idOrName}`,
      },
    ];
  }

  if (mission !== undefined) {
    enterprise =
      updateEnterpriseMission(
        enterprise.name,
        mission
      ) ?? enterprise;
  }

  if (description !== undefined) {
    enterprise =
      updateEnterpriseDescription(
        enterprise.name,
        description
      ) ?? enterprise;
  }

  return [
    {
      actor: "Arturo",
      label: "Enterprise updated",
      body: [
        "Enterprise updated.",
        "",
        `  ID:          ${enterprise.id}`,
        `  Name:        ${enterprise.name}`,
        `  Mission:     ${enterprise.mission?.trim() || "(none)"}`,
        `  Description: ${formatUiEnterpriseDescription(enterprise.description)}`,
        `  Status:      ${enterprise.status}`,
        `  Updated:     ${new Date(enterprise.updatedAt).toISOString()}`,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Handles /enterprise commands from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entries for enterprise create, inspect, update, list, or usage.
 *
 * SIDE EFFECT:
 * - May read or mutate the enterprise store.
 */
export async function handleUiEnterpriseCommand(
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "create") {
    if (
      subcommandArgs.includes("--advise") ||
      subcommandArgs.includes("--chat")
    ) {
      return handleUiEnterpriseAdviseCreateSubcommand(
        subcommandArgs
      );
    }

    return handleUiEnterpriseCreateSubcommand(
      subcommandArgs
    );
  }
  

  if (subcommand === "inspect") {
    if (subcommandArgs.length === 0 && isInteractiveSession()) {
      const names = listEnterprises().map((enterprise) => enterprise.name);
      if (names.length === 0) {
        return [
          {
            actor: "Arturo",
            label: "No businesses yet",
            body: "You haven't set up a business yet. Type /setup to start.",
          },
        ];
      }
      if (names.length === 1) {
        return handleUiEnterpriseInspectSubcommand([names[0]]);
      }
      commandMenu = { kind: "enterprise", stage: "inspect-pick", names };
      return pickList("Which business?", names);
    }
    return handleUiEnterpriseInspectSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "update") {
    // A name with no field to change: ask which one, rather than printing a
    // usage line of switches the operator has to translate back.
    const updateTarget = subcommandArgs[0];
    if (
      updateTarget &&
      !subcommandArgs.some((arg) => arg.startsWith("--")) &&
      isInteractiveSession()
    ) {
      const existing = getEnterpriseByIdOrName(updateTarget);
      if (!existing) {
        return [
          {
            actor: "Arturo",
            label: "Business not found",
            body: `There is no business called "${updateTarget}". Run /enterprise list to see the exact names.`,
          },
        ];
      }
      commandMenu = { kind: "enterprise", stage: "edit-field", name: existing.name };
      return [askEnterpriseEditField(existing.name)];
    }
    return handleUiEnterpriseUpdateSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "list") {
    return createEnterpriseEntries();
  }

  if (
    subcommand &&
    getUiFlagValue(
      args,
      "--description"
    )?.trim()
  ) {
    return handleUiEnterpriseCreateSubcommand(
      args
    );
  }

  // No subcommand: an interactive operator gets a guided menu (set up / look
  // at / list) rather than a switch-laden usage block. Headless runs keep the
  // usage text so nothing waits on a prompt that can't be answered.
  if (!subcommand && isInteractiveSession()) {
    return [...await startSetupFlow()];
  }

  return [
    {
      actor: "Arturo",
      label: "Usage",
      body: createEnterpriseUsageText(),
    },
  ];
}

/**
 * Purpose: Creates usage text for the /function command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Function command usage text.
 *
 * PURE: No side effects.
 */
export function createFunctionUsageText(): string {
  return [
    "Usage:",
    '  /function create "<name>" --enterprise "<enterprise-name-or-id>" [--objective "<objective>"] [--description "<description>"]',
    '  /function update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--enterprise "<enterprise-name-or-id>"]',
    '  /function inspect "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
    '  /function list [--enterprise "<enterprise-name-or-id>"]',
    '  /function start "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
    '  /function remove "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
  ].join("\n");
}

/**
 * Purpose: Formats an optional business function description for UI output.
 *
 * Params:
 * - description: Optional business function description.
 *
 * Returns:
 * - Description text or "(none)".
 *
 * PURE: No side effects.
 */
export function formatUiBusinessFunctionDescription(
  description: string | undefined
): string {
  return description && description.trim().length > 0
    ? description
    : "(none)";
}

/**
 * Purpose: Formats a timestamp for UI output.
 *
 * Params:
 * - timestamp: Unix timestamp in milliseconds.
 *
 * Returns:
 * - ISO timestamp.
 *
 * PURE: No side effects.
 */
export function formatUiTimestamp(
  timestamp: number
): string {
  return formatDisplayDate(timestamp);
}

/**
 * Purpose: Formats the runtime attachment state for a business function.
 *
 * Params:
 * - definition: Business function definition.
 *
 * Returns:
 * - Runtime display text.
 *
 * PURE: No side effects.
 */
export function formatUiBusinessFunctionRuntime(
  definition: BusinessFunctionDefinition
): string {
  return definition.runtimeId ?? "(none)";
}

/**
 * Purpose: Formats a Chapter 4 business function creation result.
 *
 * Params:
 * - definition: Created business function definition.
 * - enterpriseName: Owning enterprise name.
 * - enterpriseId: Owning enterprise id.
 *
 * Returns:
 * - Business function creation output.
 *
 * PURE: No side effects.
 */
export function formatUiBusinessFunctionCreated(
  definition: BusinessFunctionDefinition,
  enterpriseName: string,
  enterpriseId: string
): string {
  // No field block. Everything in it was either just typed by the operator or
  // fixed at creation, and /function inspect prints the record in full.
  return [
    "Function created.",
    "",
    `To inspect enter /function inspect "${definition.label}"`,
    "",
    ...formatMissingObjectiveWarning(
      definition
    ),
    formatBusinessFunctionCreatedNextAction(),
  ].join("\n");
}

/**
 * Warns that a Function without an Objective cannot be reasoned about.
 *
 * A Function created with no Objective was accepted in silence. The Objective
 * is what the Runtime evaluates to decide whether work is needed and what
 * /suggest anchors its proposals to — a walkthrough created a Function called
 * "invoicing" with none, and every Task /suggest proposed for it was generic
 * trade paperwork with no invoice among them. The name alone was all Arturo
 * had to go on.
 *
 * PURE: No side effects.
 */
export function formatMissingObjectiveWarning(
  definition: BusinessFunctionDefinition
): readonly string[] {
  return definition.objective?.trim()
    ? []
    : [
        "This Function has no Objective, so Arturo has only its name to work",
        "from. Suggested work and Runtime decisions will be vague until it has",
        "one:",
        `  /function update "${definition.label}" --objective "<what must keep being true>"`,
        "",
      ];
}

/**
 * Purpose: Formats a Chapter 4 business function update result.
 *
 * Params:
 * - definition: Updated business function definition.
 *
 * Returns:
 * - Business function update output.
 *
 * PURE: No side effects.
 */
export function formatUiBusinessFunctionUpdated(
  definition: BusinessFunctionDefinition
): string {
  return [
    "Function updated.",
    "",
    `  ID:            ${definition.id}`,
    `  Name:          ${definition.label}`,
    `  Objective:     ${definition.objective || "(none)"}`,
    `  Description:   ${formatUiBusinessFunctionDescription(definition.description)}`,
    `  Status:        ${definition.status}`,
    `  Updated:       ${formatUiTimestamp(definition.updatedAt)}`,
  ].join("\n");
}

/**
 * Purpose: Formats a Chapter 4 or Chapter 5 business function inspection result.
 *
 * Params:
 * - definition: Business function definition.
 * - enterpriseName: Owning enterprise name.
 * - enterpriseId: Owning enterprise id.
 *
 * Returns:
 * - Business function inspection output.
 *
 * SIDE EFFECT:
 * - Reads runtime store when a runtime is attached.
 */
export function formatUiBusinessFunctionDetail(
  definition: BusinessFunctionDefinition,
  enterpriseName: string,
  enterpriseId: string
): string {
  const runtime =
    definition.runtimeId
      ? getBusinessFunction(
          definition.runtimeId
        )
      : undefined;

  if (definition.runtimeId && runtime) {
    return [
      `Function: ${definition.label}`,
      `  ID:            ${definition.id}`,
      `  Objective:     ${definition.objective || "(none)"}`,
      `  Status:        ${definition.status}`,
      `  Operating state: ${runtime.state}`,
      ...formatBusinessFunctionStaffLines(definition.id),
    ].join("\n");
  }

  return [
    `Function: ${definition.label}`,
    `  ID:            ${definition.id}`,
    `  Enterprise:    ${enterpriseName} (${enterpriseId})`,
    `  Objective:     ${definition.objective || "(none)"}`,
    `  Description:   ${formatUiBusinessFunctionDescription(definition.description)}`,
    `  Status:        ${definition.status}`,
    ...formatBusinessFunctionStaffLines(definition.id),
    `  Created:       ${formatUiTimestamp(definition.createdAt)}`,
    `  Updated:       ${formatUiTimestamp(definition.updatedAt)}`,
    "",
    "  Operating state:",
    "    Not started",
    "",
    "  Governance:",
    "    (none defined)",
  ].join("\n");
}

/**
 * Purpose: Formats Chapter 4 business function list output.
 *
 * Params:
 * - definitions: Business function definitions.
 *
 * Returns:
 * - Business function list output.
 *
 * PURE: No side effects.
 */
export function formatUiBusinessFunctionDefinitionList(
  definitions: readonly BusinessFunctionDefinition[]
): string {
  if (definitions.length === 0) {
    return "No functions found.";
  }

  return definitions
    .map(
      (definition, index) =>
        `${index + 1}. ${definition.label}`
    )
    .join("\n");
}

/**
 * Purpose: Handles /function create from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "create".
 *
 * Returns:
 * - Work stream entry for created function, usage, or error.
 *
 * SIDE EFFECT:
 * - Reads enterprise store.
 * - Mutates business function definition store.
 * - Mutates enterprise store.
 */
export function handleUiFunctionCreateSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const enterpriseIdOrName =
    getUiFlagValue(
      args,
      "--enterprise"
    )?.trim();

  const objective =
    getUiFlagValue(
      args,
      "--objective"
    )?.trim() ?? "";

  const description =
    getUiFlagValue(
      args,
      "--description"
    )?.trim();

  const positionalArgs =
    removeUiFlagPair(
      removeUiFlagPair(
        removeUiFlagPair(
          args,
          "--enterprise"
        ),
        "--objective"
      ),
      "--description"
    );

  const [
    label,
  ] = positionalArgs;

  if (!label) {
    return [
      {
        actor: "Arturo",
        label: "What should the Function be called?",
        body: [
          "A Function is an ongoing responsibility your business needs handled.",
          "",
          '  /function create "Customer Enquiries"',
          "",
          "Arturo will use your business automatically if you only have one.",
        ].join("\n"),
      },
    ];
  }

  // A first-time user has exactly one business, so requiring --enterprise just
  // to add a Function is a needless switch: infer the only Enterprise. Ask,
  // with a numbered list, only when the choice is genuinely ambiguous.
  const allEnterprises = listEnterprises();
  const enterprise =
    enterpriseIdOrName
      ? getEnterpriseByIdOrName(enterpriseIdOrName)
      : allEnterprises.length === 1
        ? allEnterprises[0]
        : undefined;

  if (enterpriseIdOrName && !enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Business not found",
        body: `There is no business called "${enterpriseIdOrName}". Run /enterprise list to see the exact names.`,
      },
    ];
  }

  if (!enterprise) {
    if (allEnterprises.length === 0) {
      return [
        {
          actor: "Arturo",
          label: "Set up a business first",
          body: [
            "There is no business set up yet, so there is nothing to add a Function to.",
            "",
            "  /enterprise    Arturo asks about your business and sets it up",
          ].join("\n"),
        },
      ];
    }
    if (isInteractiveSession()) {
      const names = allEnterprises.map((candidate) => candidate.name);
      commandMenu = {
        kind: "function",
        stage: "create-enterprise-pick",
        name: label,
        names,
      };
      return pickList("Which business is this for?", names);
    }
    return [
      {
        actor: "Arturo",
        label: "Which business is this for?",
        body: [
          "You have more than one business, so tell Arturo which one this Function is for:",
          "",
          ...allEnterprises.map(
            (candidate) =>
              `  /function create "${label}" --enterprise "${candidate.name}"`
          ),
        ].join("\n"),
      },
    ];
  }

  // Commands address Functions by name, so a same-named duplicate in the same
  // Enterprise is unreachable from the moment it exists — every "--function
  // <name>" resolves to the first one. A probe run created "Content
  // Production" twice with no warning; the second could never be staffed,
  // started, or removed by name. Refuse rather than mint an orphan.
  const duplicate = findDuplicateFunction(enterprise.id, label);

  if (duplicate) {
    return [
      {
        actor: "Arturo",
        label: "Function already exists",
        body: [
          describeDuplicateFunction(enterprise.name, duplicate, label),
          "Commands refer to Functions by name, so a second one with the same name could never be addressed.",
          "",
          `  /function update "${duplicate.label}" --objective "<objective>"    change the existing one`,
          `  /function create "<a different name>" --enterprise "${enterprise.name}" --objective "<objective>"`,
        ].join("\n"),
      },
    ];
  }

  // A Function with no objective states nothing about what it must keep doing,
  // and that objective is what /staff and the runtime evaluate against. Ask for
  // it rather than storing a blank. Flag presence, not value, so the guided
  // flow's "skip" does not come back round.
  const objectiveSupplied =
    args.includes("--objective") ||
    args.some((arg) => arg.startsWith("--objective="));

  if (!objectiveSupplied && !description && isInteractiveSession()) {
    commandMenu = {
      kind: "function",
      stage: "create-objective",
      name: label,
      enterpriseName: enterprise.name,
    };
    return [
      {
        actor: "Arturo",
        label: "Objective:",
        body: [
          `In one sentence, what should "${label}" keep doing? (its objective)`,
          "",
          "Or type skip to leave that blank for now.",
        ].join("\n"),
      },
    ];
  }

  // The company page creates a Function through this same function.
  const created = createEnterpriseFunction({
    enterprise,
    label,
    objective,
    description,
  });

  if (!created.created) {
    return [
      {
        actor: "Arturo",
        label: "Function already exists",
        body: created.message,
      },
    ];
  }

  const definition = created.definition;

  return [
    {
      actor: "Arturo",
      label: "Function created",
      body: formatUiBusinessFunctionCreated(
        definition,
        enterprise.name,
        enterprise.id
      ),
    },
  ];
}
/**
 * Purpose: Handles /function update from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "update".
 *
 * Returns:
 * - Work stream entry for updated function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function definition store.
 */
export function handleUiFunctionUpdateSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    idOrLabel,
  ] = args;

  const description =
    getUiFlagValue(
      args,
      "--description"
    )?.trim();

  const objective =
    getUiFlagValue(
      args,
      "--objective"
    )?.trim();

  const enterpriseReference =
    getUiFlagValue(
      args,
      "--enterprise"
    )?.trim();

  const followOn =
    getUiFlagValue(
      args,
      "--follow-on"
    )?.trim().toLowerCase();

  const handOffTo =
    getUiFlagValue(
      args,
      "--hand-off-to"
    )?.trim();

  const handOffTask =
    getUiFlagValue(
      args,
      "--hand-off-task"
    )?.trim();

  const handOffSwitch =
    getUiFlagValue(
      args,
      "--hand-off"
    )?.trim().toLowerCase();

  const needsDocumentSwitch =
    getUiFlagValue(
      args,
      "--needs-document"
    )?.trim().toLowerCase();

  const maxWordsText =
    getUiFlagValue(
      args,
      "--max-words"
    )?.trim();

  // Where its results go before a person signs them off (runtime/passOnRules.ts).
  const passOnTo =
    getUiFlagValue(
      args,
      "--pass-on-to"
    )?.trim();
  const passOnSwitch =
    getUiFlagValue(
      args,
      "--pass-on"
    )?.trim().toLowerCase();
  // A route: each --route-step is "<business function>: <what its AI worker does>", in order.
  const routeSteps = args.flatMap((arg, index) => (arg === "--route-step" && index + 1 < args.length ? [args[index + 1]] : []))
    .map((value) => {
      const colon = value.indexOf(":");
      return colon === -1 ? { to: value.trim(), instruction: "" } : { to: value.slice(0, colon).trim(), instruction: value.slice(colon + 1).trim() };
    });
  const routeStopFirst =
    getUiFlagValue(
      args,
      "--route-stop-first"
    )?.trim().toLowerCase();
  const passOnMode =
    routeSteps.length ? "route" : passOnTo ? "send" : passOnSwitch === "never" ? "never" : passOnSwitch === "off" ? "me" : undefined;

  const parsedWordLimit =
    maxWordsText !== undefined
      ? parseWordLimit(maxWordsText)
      : undefined;

  if (
    !idOrLabel ||
    (!description && !objective && !followOn && !handOffTo && !handOffTask && !handOffSwitch && !needsDocumentSwitch && maxWordsText === undefined && !passOnTo && !passOnSwitch && !routeSteps.length) ||
    (routeSteps.length > 0 && (passOnSwitch !== undefined || Boolean(passOnTo))) ||
    (routeStopFirst !== undefined && (!routeSteps.length || (routeStopFirst !== "on" && routeStopFirst !== "off"))) ||
    (passOnSwitch !== undefined && passOnSwitch !== "off" && passOnSwitch !== "never") ||
    (passOnSwitch !== undefined && Boolean(passOnTo)) ||
    (needsDocumentSwitch !== undefined && needsDocumentSwitch !== "on" && needsDocumentSwitch !== "off") ||
    (followOn !== undefined && followOn !== "on" && followOn !== "off") ||
    (handOffSwitch !== undefined && handOffSwitch !== "off") ||
    (handOffSwitch !== undefined && (handOffTo || handOffTask)) ||
    (Boolean(handOffTo) !== Boolean(handOffTask))
  ) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: [
          'Use /function update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--follow-on <on|off>] [--hand-off-to "<person>" --hand-off-task "<what they do with each result>"] [--hand-off off] [--needs-document <on|off>] [--max-words <number|off>] [--pass-on-to "<business function>" | --pass-on <off|never> | --route-step "<business function>: <what it does>" ... [--route-stop-first <on|off>]] [--as "<your name>"] [--enterprise "<enterprise-name-or-id>"]',
          ...(passOnSwitch !== undefined && (passOnSwitch !== "off" && passOnSwitch !== "never" || Boolean(passOnTo))
            ? ["", "--pass-on takes off (results come to a person to sign off) or never (and no task can send them on). To send them to another business function first, use --pass-on-to on its own."]
            : []),
          ...(routeSteps.length > 0 && (passOnSwitch !== undefined || Boolean(passOnTo))
            ? ["", "A route (--route-step, once for each step in order) replaces --pass-on-to and --pass-on: give one or the other."]
            : []),
          ...(routeStopFirst !== undefined && (!routeSteps.length || (routeStopFirst !== "on" && routeStopFirst !== "off"))
            ? ["", "--route-stop-first takes on (the default: this business function's own result is signed off before the route goes on) or off, with --route-step."]
            : []),
          ...(needsDocumentSwitch !== undefined && needsDocumentSwitch !== "on" && needsDocumentSwitch !== "off"
            ? ["", "--needs-document takes on or off."]
            : []),
          ...(Boolean(handOffTo) !== Boolean(handOffTask)
            ? ["", "A hand-off needs both: who each signed-off result goes to (--hand-off-to) and what they should do with it (--hand-off-task)."]
            : []),
        ].join("\n"),
      },
    ];
  }

  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseReference}`,
      },
    ];
  }
  const scopedDefinition =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        ).find(
          (candidate) =>
            candidate.id === idOrLabel ||
            candidate.label.trim().toLowerCase() ===
              idOrLabel.toLowerCase()
        )
      : undefined;
  if (enterprise && !scopedDefinition) {
    return [
      {
        actor: "Arturo",
        label: "Function not found",
        body: `function not found in ${enterprise.name}: ${idOrLabel}`,
      },
    ];
  }
  // Checked against the Function's own business before anything is changed,
  // so a refused hand-off leaves the objective and description as they were.
  const handOffTarget =
    scopedDefinition ??
    getBusinessFunctionDefinitionByIdOrLabel(
      idOrLabel
    );
  const handOffRefusal =
    handOffTo && handOffTask
      ? refuseHandOff({ to: handOffTo, task: handOffTask, ...(handOffTarget ? { enterpriseId: handOffTarget.enterpriseId } : {}), as: getUiFlagValue(args, "--as")?.trim() ?? "" })
      : undefined;
  if (handOffRefusal) {
    return [{ actor: "Arturo", label: "Hand-off not set", body: `${handOffRefusal}\nNothing was changed.` }];
  }
  if (parsedWordLimit && "refused" in parsedWordLimit) {
    return [{ actor: "Arturo", label: "Checks not set", body: `${parsedWordLimit.refused}\nNothing was changed.` }];
  }
  const passOnSetting =
    passOnMode && handOffTarget
      ? { enterpriseId: handOffTarget.enterpriseId, functionId: handOffTarget.id, mode: passOnMode, ...(passOnTo ? { to: passOnTo } : {}), ...(routeSteps.length ? { steps: routeSteps, pauseFirst: routeStopFirst !== "off" } : {}), as: getUiFlagValue(args, "--as")?.trim() ?? "" }
      : undefined;
  if (passOnSetting) {
    const checked = checkPassOn(passOnSetting);
    if ("refused" in checked) {
      return [{ actor: "Arturo", label: "Where results go was not changed", body: `${checked.refused}\nNothing was changed.` }];
    }
  }
  const detailed =
    updateBusinessFunctionDetails(
      enterprise
        ? scopedDefinition!.id
        : idOrLabel,
      { objective, description }
    );
  const definition =
    detailed && followOn
      ? setBusinessFunctionFollowOn(detailed.id, followOn === "on")
      : detailed;

  // Checked before anything else is said to have changed, and refused whole.
  let handOffLines: string[] = [];
  if (definition && handOffTo && handOffTask) {
    const outcome = setHandOff({ functionId: definition.id, to: handOffTo, task: handOffTask, as: getUiFlagValue(args, "--as")?.trim() ?? "" });
    if ("refused" in outcome) {
      return [{ actor: "Arturo", label: "Hand-off not set", body: outcome.refused }];
    }
    handOffLines = [
      "",
      `Hand-off set: ${describeHandOff(outcome.handOff)}.`,
      `Each result from ${definition.label} becomes a Human Task for ${outcome.handOff.to} once someone signs it off, in the terminal or the browser. Nothing is handed over before that, and results signed off before now are not handed over. Stop it with --hand-off off.`,
    ];
  } else if (definition && handOffSwitch === "off") {
    handOffLines = [
      "",
      removeHandOff(definition.id)
        ? `Hand-off off. Signed-off results from ${definition.label} stay where they are; Human Tasks it already created are untouched.`
        : `${definition.label} had no hand-off. Nothing changed.`,
    ];
  }

  let checkLines: string[] = [];
  if (definition && (needsDocumentSwitch !== undefined || (parsedWordLimit && "maxWords" in parsedWordLimit))) {
    const outcome = changeFunctionChecks({
      functionId: definition.id,
      ...(needsDocumentSwitch !== undefined ? { needsDocument: needsDocumentSwitch === "on" } : {}),
      ...(parsedWordLimit && "maxWords" in parsedWordLimit ? { maxWords: parsedWordLimit.maxWords } : {}),
      setBy: getUiFlagValue(args, "--as")?.trim() ?? "",
    });
    if ("refused" in outcome) {
      return [{ actor: "Arturo", label: "Checks not set", body: outcome.refused }];
    }
    const described = describeFunctionChecks(outcome.checks);
    checkLines = [
      "",
      described.length
        ? `Checks Arturo makes on work asked of ${definition.label}, before any AI is asked: ${described.join(" ")} Work that fails a check is refused and nothing is started. These apply to work somebody asks for, not to work a running Function starts from an event.`
        : `${definition.label} has no checks. Work is not refused for a missing document or for length.`,
    ];
  }

  if (!definition) {
    return [
      {
        actor: "Arturo",
        label: "Function not found",
        body: `function not found: ${idOrLabel}`,
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Function updated",
      body: [
        formatUiBusinessFunctionUpdated(
          definition
        ),
        ...(followOn === "on"
          ? [
              "",
              `Follow-on work is on. When a Task in ${definition.label} finishes, an AI model decides whether more work is needed and Arturo creates it, up to three Tasks deep. That work is written by a model and nobody asked for it by name; anything that would act outside Arturo still waits for approval. Turn it off with --follow-on off.`,
            ]
          : followOn === "off"
            ? ["", `Follow-on work is off. ${definition.label} only does the work you ask for.`]
            : []),
        ...handOffLines,
        ...checkLines,
        ...passOnLines(definition.label, passOnSetting),
      ].join("\n"),
    },
  ];
}

/**
 * Saves where a business function's results go before sign-off, already
 * checked, and says what that means.
 *
 * SIDE EFFECT: Writes one pass-on rule.
 */
function passOnLines(label: string, setting: PassOnSetting | undefined): string[] {
  if (!setting) return [];
  const outcome = setPassOn(setting);
  if ("refused" in outcome) return ["", `Where results go was not changed: ${outcome.refused}`];
  const rule = outcome.rule;
  return [
    "",
    rule.mode === "send"
      ? `${describePassOn(rule)} Nobody signs a result off before it is checked; the check comes to the person with it, and the check is never signed off on its own. A single task can still come straight back with /task create ... --pass-on off. Set by ${rule.setBy}.`
      : rule.mode === "never"
        ? `${describePassOn(rule)} Set by ${rule.setBy}.`
        : rule.mode === "route"
          ? `${describePassOn(rule)} Nobody signs off the steps in between before the next one starts; each document comes to the person to sign off on its own. Stop a running route with /task stop-route <task-id>. A single task can still come straight back with /task create ... --pass-on off. Set by ${rule.setBy}.`
        : `${describePassOn(rule)} A single task can still be sent to be checked first with /task create ... --pass-on "<business function>". Set by ${rule.setBy}.`,
  ];
}

/**
 * Purpose: Handles /function inspect from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "inspect".
 *
 * Returns:
 * - Work stream entry for function detail, usage, or error.
 *
 * SIDE EFFECT:
 * - Reads business function definition and enterprise stores.
 */
export function handleUiFunctionInspectSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const [
    idOrLabel,
  ] = args;
  const enterpriseReference =
    getUiFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!idOrLabel) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /function inspect "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
      },
    ];
  }

  const requestedEnterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !requestedEnterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseReference}`,
      },
    ];
  }
  const definition =
    requestedEnterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          requestedEnterprise.id
        ).find(
          (candidate) =>
            candidate.id === idOrLabel ||
            candidate.label.trim().toLowerCase() ===
              idOrLabel.toLowerCase()
        )
      : getBusinessFunctionDefinitionByIdOrLabel(
          idOrLabel
        );

  if (!definition) {
    return [
      {
        actor: "Arturo",
        label: "Function not found",
        body: `function not found: ${idOrLabel}`,
      },
    ];
  }

  const enterprise =
    getEnterprise(
      definition.enterpriseId
    );

  if (!enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${definition.enterpriseId}`,
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Function detail",
      body: [
        formatUiBusinessFunctionDetail(
          definition,
          enterprise.name,
          enterprise.id
        ),
        ...(describeFunctionChecks(getFunctionChecks(definition.id)).length
          ? [
              "",
              "  Checks Arturo makes before any AI is asked:",
              ...describeFunctionChecks(getFunctionChecks(definition.id)).map((line) => `    ${line}`),
            ]
          : []),
        "",
        `  Before sign-off: ${describePassOn(getPassOnRule(definition.id))}`,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Handles /function list from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "list".
 *
 * Returns:
 * - Work stream entry for function list or error.
 *
 * SIDE EFFECT:
 * - Reads business function definition and enterprise stores.
 */
export function handleUiFunctionListSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const enterpriseIdOrName =
    getUiFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!enterpriseIdOrName) {
    return [
      {
        actor: "Arturo",
        label: "Functions",
        body: formatUiBusinessFunctionDefinitionList(
          listBusinessFunctionDefinitions()
        ),
      },
    ];
  }

  const enterprise =
    getEnterpriseByIdOrName(
      enterpriseIdOrName
    );

  if (!enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseIdOrName}`,
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Functions",
      body: formatUiBusinessFunctionDefinitionList(
        listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        )
      ),
    },
  ];
}

/**
 * Purpose: Handles /function commands from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entries for function create, inspect, update, list, or usage.
 *
 * SIDE EFFECT:
 * - May read or mutate business function definition state.
 */
/**
 * Handles `/function remove`.
 *
 * SIDE EFFECT:
 * - Removes a Function definition and its staffing when nothing depends on it.
 */
export function handleUiFunctionRemoveSubcommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  const reference = args[0];

  if (!reference || reference.startsWith("--")) {
    return [{
      actor: "Arturo",
      label: "Usage",
      body: 'Use /function remove "<name-or-id>" [--enterprise "<enterprise>"]',
    }];
  }

  const enterpriseReference =
    getUiFlagValue(
      args,
      "--enterprise"
    );
  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;

  if (enterpriseReference && !enterprise) {
    return [{
      actor: "Arturo",
      label: "Function not removed",
      body: `No Enterprise matches "${enterpriseReference}".`,
    }];
  }

  const result =
    removeBusinessFunction(
      reference,
      enterprise?.id
    );

  if (!result.ok) {
    return [{
      actor: "Arturo",
      label: "Function not removed",
      body: result.message,
    }];
  }

  return [{
    actor: "Arturo",
    label: "Function removed",
    body: [
      `Removed Function: ${result.removed.label}`,
      `Released staffing assignments: ${result.releasedAssignments}`,
      "",
      "Completed Tasks, Events, approvals, and Timeline records are preserved",
      "and still reference this Function.",
      ...(result.orphanedWorkers.length > 0
        ? [
            "",
            `${result.orphanedWorkers.length} Worker(s) now staff no Function at all:`,
            ...result.orphanedWorkers.map(
              (workerName) => `  /workers remove "${workerName}"`
            ),
            "",
            "They will not be given work while unstaffed. Remove them, or staff",
            "them to another Function with /staff.",
          ]
        : []),
    ].join("\n"),
  }];
}

export async function handleUiFunctionCommand(
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "create") {
    return handleUiFunctionCreateSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "update") {
    // A name with no field to change: ask which one.
    const updateTarget = subcommandArgs[0];
    if (
      updateTarget &&
      !subcommandArgs.some((arg) => arg.startsWith("--")) &&
      isInteractiveSession()
    ) {
      const existing =
        getBusinessFunctionDefinitionByIdOrLabel(updateTarget);
      if (!existing) {
        return [
          {
            actor: "Arturo",
            label: "Function not found",
            body: `There is no Function called "${updateTarget}". Run /functions to see the exact names.`,
          },
        ];
      }
      commandMenu = { kind: "function", stage: "edit-field", name: existing.label };
      return [askFunctionEditField(existing.label)];
    }
    return handleUiFunctionUpdateSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "inspect") {
    return handleUiFunctionInspectSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "remove") {
    return handleUiFunctionRemoveSubcommand(
      subcommandArgs
    );
  }

  if (subcommand === "list") {
    return handleUiFunctionListSubcommand(
      subcommandArgs
    );
  }

  // /help and the usage text both promise "/function start", and /job start
  // already worked. Only the canonical spelling was missing a route, so the
  // command Arturo recommends did nothing but reprint its own usage.
  if (subcommand === "start") {
    // The name is the whole command here, so getting it wrong wastes the line.
    const named = subcommandArgs[0];
    if (named && !named.startsWith("--")) {
      const known = getBusinessFunctionDefinitionByIdOrLabel(named);
      if (!known) {
        const offered = offerKnownValues({
          command: "/function",
          args,
          slot: 1,
          options: listBusinessFunctionDefinitions().map((one) => one.label),
          label: "Which Function?",
          typed: named,
        });
        if (offered) return offered;
      }
    }
    return handleUiRuntimeStartCommand(
      subcommandArgs
    );
  }

  // No subcommand: guided menu for interactive operators; usage text headless.
  if (!subcommand && isInteractiveSession()) {
    return startFunctionMenu();
  }

  return [
    {
      actor: "Arturo",
      label: "Usage",
      body: createFunctionUsageText(),
    },
  ];
}

/**
 * Interactive menus for the bare /enterprise and /function commands.
 *
 * A first-time operator who types /enterprise or /function (no subcommand) used
 * to get a switch-laden Usage block. Instead, Arturo now asks what they want to
 * do — set one up, look at one, or list them — and routes by number. Guided
 * setup ("Create") hands off to the existing --advise conversation. The flag
 * subcommands still work for scripts and power users.
 */

type CommandMenuState =
  | { readonly kind: "enterprise"; readonly stage: "choose" }
  | { readonly kind: "enterprise"; readonly stage: "create-name" }
  | { readonly kind: "enterprise"; readonly stage: "create-mission"; readonly name: string }
  | { readonly kind: "enterprise"; readonly stage: "create-description"; readonly name: string; readonly mission: string }
  | { readonly kind: "enterprise"; readonly stage: "inspect-pick"; readonly names: readonly string[] }
  | { readonly kind: "enterprise"; readonly stage: "edit-pick"; readonly names: readonly string[] }
  | { readonly kind: "enterprise"; readonly stage: "edit-field"; readonly name: string }
  | { readonly kind: "enterprise"; readonly stage: "edit-value"; readonly name: string; readonly field: string }
  | { readonly kind: "function"; readonly stage: "choose" }
  | { readonly kind: "function"; readonly stage: "create-name" }
  | { readonly kind: "function"; readonly stage: "create-objective"; readonly name: string; readonly enterpriseName?: string }
  | { readonly kind: "function"; readonly stage: "create-description"; readonly name: string; readonly objective: string; readonly enterpriseName?: string }
  | { readonly kind: "function"; readonly stage: "create-enterprise-pick"; readonly name: string; readonly names: readonly string[] }
  | { readonly kind: "function"; readonly stage: "start-pick"; readonly names: readonly string[] }
  | { readonly kind: "function"; readonly stage: "inspect-pick"; readonly names: readonly string[] }
  | { readonly kind: "function"; readonly stage: "edit-pick"; readonly names: readonly string[] }
  | { readonly kind: "function"; readonly stage: "edit-field"; readonly name: string }
  | { readonly kind: "function"; readonly stage: "edit-value"; readonly name: string; readonly field: string }
  | { readonly kind: "task"; readonly stage: "choose" }
  | { readonly kind: "task"; readonly stage: "inspect-pick"; readonly ids: readonly string[] }
  | { readonly kind: "task"; readonly stage: "create-desc" }
  | { readonly kind: "task"; readonly stage: "create-fn-pick"; readonly request: string; readonly names: readonly string[] }
  | { readonly kind: "task"; readonly stage: "create-evidence"; readonly request: string; readonly functionName: string | undefined; readonly options: readonly TaskEvidenceKind[] }
  | { readonly kind: "task"; readonly stage: "create-artefact"; readonly request: string; readonly functionName: string | undefined; readonly references: readonly string[]; readonly flag: string }
  | { readonly kind: "task"; readonly stage: "create-follow-on"; readonly request: string; readonly functionName: string | undefined; readonly ids: readonly string[] }
  | { readonly kind: "task"; readonly stage: "create-gate"; readonly request: string; readonly functionName: string | undefined; readonly references: readonly string[]; readonly holdable: readonly string[] }
  | { readonly kind: "task"; readonly stage: "create-procedure"; readonly request: string; readonly functionName: string | undefined; readonly references: readonly string[] }
  | { readonly kind: "task"; readonly stage: "create-search"; readonly request: string; readonly functionName: string | undefined }
  | { readonly kind: "schedule"; readonly stage: "choose" }
  | { readonly kind: "schedule"; readonly stage: "add-desc" }
  | { readonly kind: "schedule"; readonly stage: "add-cadence"; readonly request: string }
  | { readonly kind: "schedule"; readonly stage: "add-day"; readonly request: string }
  | { readonly kind: "schedule"; readonly stage: "add-time"; readonly request: string; readonly cadence: string }
  | { readonly kind: "schedule"; readonly stage: "add-fn-pick"; readonly request: string; readonly cadence: string; readonly at: string; readonly names: readonly string[] }
  // "--every weekly" names a frequency but not a day. Rather than refusing a
  // line the operator has already typed in full, ask only for the day and put
  // it back into their own arguments — the other flags (--at, --timezone,
  // --function) survive untouched. The menu-only path never collects a
  // timezone, so re-running the whole guided flow here would silently drop it.
  | { readonly kind: "schedule"; readonly stage: "add-day-for-args"; readonly args: readonly string[]; readonly everyIndex: number }
  // A typed line whose only fault is one value Arturo cannot match. Rather than
  // throwing the whole line away, the operator picks from the values that do
  // exist and the line is re-run with that one substituted.
  | {
      readonly kind: "retry";
      readonly stage: "pick";
      readonly command: string;
      readonly args: readonly string[];
      readonly slot: number;
      readonly options: readonly string[];
    }
  | { readonly kind: "decision"; readonly stage: "pick"; readonly action: "approve" | "reject"; readonly ids: readonly string[] }
  | { readonly kind: "decision"; readonly stage: "who"; readonly action: "approve" | "reject"; readonly id: string; readonly names: readonly string[] }
  | { readonly kind: "decision"; readonly stage: "reason"; readonly action: "reject"; readonly id: string; readonly as?: string }
  | { readonly kind: "artefact"; readonly stage: "name" }
  | { readonly kind: "artefact"; readonly stage: "kind"; readonly name: string }
  | { readonly kind: "artefact"; readonly stage: "where"; readonly name: string; readonly artKind: string }
  | { readonly kind: "artefact"; readonly stage: "worker"; readonly name: string; readonly artKind: string; readonly where: string; readonly workers: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "enterprise"; readonly name: string; readonly artKind: string; readonly where: string; readonly createdBy: string; readonly names: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "link"; readonly name: string; readonly artKind: string; readonly where: string; readonly createdBy: string; readonly enterpriseName: string; readonly taskIds: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "note"; readonly name: string; readonly artKind: string; readonly where: string; readonly createdBy: string; readonly enterpriseName: string; readonly humanTask?: string }
  | { readonly kind: "aiworker"; readonly stage: "name" }
  | { readonly kind: "aiworker"; readonly stage: "role"; readonly name: string }
  | { readonly kind: "refine"; readonly stage: "pick"; readonly workers: readonly string[] }
  | { readonly kind: "refine"; readonly stage: "text"; readonly workerName: string }
  | { readonly kind: "suggest"; readonly stage: "pick"; readonly labels: readonly string[]; readonly enterpriseReference: string | undefined }
  | { readonly kind: "humantask"; readonly stage: "create-instructions" }
  | { readonly kind: "humantask"; readonly stage: "create-follows"; readonly title: string; readonly instructions: string; readonly ids: readonly string[] }
  | { readonly kind: "humantask"; readonly stage: "create-owner"; readonly title: string; readonly instructions: string; readonly purpose: string; readonly follows: string | undefined; readonly owners: readonly string[] }
  | { readonly kind: "humantask"; readonly stage: "create-artefact"; readonly title: string; readonly instructions: string; readonly purpose: string; readonly follows: string | undefined; readonly owner: string | undefined; readonly references: readonly string[] }
  | { readonly kind: "humantask"; readonly stage: "act-pick"; readonly action: HumanTaskAction; readonly ids: readonly string[] }
  | { readonly kind: "humantask"; readonly stage: "act-text"; readonly action: HumanTaskAction; readonly id: string }
  | { readonly kind: "humantask"; readonly stage: "act-as"; readonly id: string; readonly notes: string; readonly owners: readonly string[] }
  | { readonly kind: "humantask"; readonly stage: "act-artefact"; readonly id: string; readonly notes: string; readonly as: string; readonly references: readonly string[] }
  | { readonly kind: "governance"; readonly stage: "choose" }
  | { readonly kind: "governance"; readonly stage: "add-description" }
  | { readonly kind: "governance"; readonly stage: "add-effect"; readonly description: string }
  | { readonly kind: "governance"; readonly stage: "add-capability"; readonly description: string; readonly effect: string }
  | { readonly kind: "governance"; readonly stage: "add-risk"; readonly description: string; readonly effect: string; readonly capability: string }
  | { readonly kind: "governance"; readonly stage: "add-scope"; readonly description: string; readonly effect: string; readonly capability: string; readonly risk: string; readonly names: readonly string[] }
  | { readonly kind: "governance"; readonly stage: "remove-pick"; readonly references: readonly string[] }
  | { readonly kind: "event"; readonly stage: "choose" }
  | { readonly kind: "event"; readonly stage: "publish-name"; readonly functions: readonly EventFunctionChoice[] }
  | { readonly kind: "event"; readonly stage: "publish-function"; readonly label: string; readonly functions: readonly EventFunctionChoice[] }
  | { readonly kind: "event"; readonly stage: "rule-function"; readonly functions: readonly EventFunctionChoice[] }
  | { readonly kind: "event"; readonly stage: "rule-publish"; readonly source: EventFunctionChoice }
  | { readonly kind: "event"; readonly stage: "rule-capability"; readonly source: EventFunctionChoice; readonly publishLabel: string }
  | { readonly kind: "event"; readonly stage: "rule-remove-pick"; readonly ids: readonly string[] }
  | { readonly kind: "memory"; readonly stage: "choose" }
  | { readonly kind: "memory"; readonly stage: "add-text" }
  | { readonly kind: "memory"; readonly stage: "add-scope"; readonly content: string; readonly scopes: readonly MemoryScopeChoice[] }
  | { readonly kind: "memory"; readonly stage: "remove-pick"; readonly ids: readonly string[] }
  | { readonly kind: "health"; readonly stage: "pick"; readonly names: readonly string[] }
  | { readonly kind: "delegation"; readonly stage: "choose" }
  | { readonly kind: "delegation"; readonly stage: "request-from"; readonly functions: readonly EventFunctionChoice[]; readonly work?: string }
  | { readonly kind: "delegation"; readonly stage: "request-to"; readonly from: EventFunctionChoice; readonly functions: readonly EventFunctionChoice[]; readonly work?: string }
  | { readonly kind: "delegation"; readonly stage: "request-work"; readonly from: EventFunctionChoice; readonly to: EventFunctionChoice }
  | { readonly kind: "delegation"; readonly stage: "inspect-pick"; readonly ids: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "choose" }
  | { readonly kind: "artefact"; readonly stage: "watch-folder" }
  | { readonly kind: "artefact"; readonly stage: "watch-function"; readonly folder: string; readonly functions: readonly { readonly label: string; readonly enterprise: string }[] }
  | { readonly kind: "artefact"; readonly stage: "watch-task"; readonly folder: string; readonly functionLabel: string; readonly enterprise: string }
  | { readonly kind: "artefact"; readonly stage: "watch-person"; readonly folder: string; readonly functionLabel: string; readonly enterprise: string; readonly instruction: string; readonly people: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "watch-each"; readonly folder: string; readonly functionLabel: string; readonly enterprise: string; readonly instruction: string; readonly person: string }
  | { readonly kind: "artefact"; readonly stage: "watch-first"; readonly folder: string; readonly functionLabel: string; readonly enterprise: string; readonly instruction: string; readonly person: string; readonly list: string }
  | { readonly kind: "artefact"; readonly stage: "version-pick"; readonly ids: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "version-where"; readonly artefactId: string }
  | { readonly kind: "artefact"; readonly stage: "version-worker"; readonly artefactId: string; readonly where: string; readonly workers: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "version-note"; readonly artefactId: string; readonly where: string; readonly createdBy: string }
  | { readonly kind: "artefact"; readonly stage: "inspect-pick"; readonly ids: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "verify-pick"; readonly references: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "submit-pick"; readonly references: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "submit-reviewer"; readonly reference: string; readonly reviewers: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "submit-note"; readonly reference: string; readonly reviewer: string }
  | { readonly kind: "artefact"; readonly stage: "review-pick"; readonly references: readonly string[]; readonly reviewers: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "review-reviewer"; readonly reference: string; readonly reviewers: readonly string[] }
  | { readonly kind: "artefact"; readonly stage: "review-decision"; readonly reference: string; readonly reviewer: string }
  | { readonly kind: "artefact"; readonly stage: "review-notes"; readonly reference: string; readonly reviewer: string; readonly decision: string }
  | { readonly kind: "workflow"; readonly stage: "choose" }
  | { readonly kind: "workflow"; readonly stage: "describe" }
  | { readonly kind: "workflow"; readonly stage: "build-name" }
  | { readonly kind: "workflow"; readonly stage: "build-objective"; readonly name: string }
  | { readonly kind: "workflow"; readonly stage: "build-step-worker"; readonly name: string; readonly objective: string; readonly steps: readonly WorkflowStepDraft[]; readonly workers: readonly string[] }
  | { readonly kind: "workflow"; readonly stage: "build-step-instruction"; readonly name: string; readonly objective: string; readonly steps: readonly WorkflowStepDraft[]; readonly workers: readonly string[]; readonly worker: string }
  | { readonly kind: "run"; readonly stage: "pick"; readonly names: readonly string[] }
  | { readonly kind: "run"; readonly stage: "missing-workers"; readonly name: string; readonly archetypes: readonly string[] }
  | { readonly kind: "run"; readonly stage: "start-file"; readonly name: string; readonly autoWorkers: boolean; readonly references: readonly string[] }
  | { readonly kind: "run"; readonly stage: "context"; readonly name: string; readonly autoWorkers: boolean; readonly inputArtefact: string | undefined }
  | { readonly kind: "startfunctions"; readonly stage: "confirm"; readonly enterpriseName: string | undefined }
  | { readonly kind: "startfunctions"; readonly stage: "enterprise"; readonly names: readonly string[] };

let commandMenu: CommandMenuState | undefined;

/** The operator's local IANA timezone, used as the schedule default. */
function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Day names accepted by the schedule parser, Monday-first for the picker. */
/**
 * Frequency words that mean "once a week" but leave out the day it lands on.
 * Accepted at the prompt and completed by asking, rather than refused.
 *
 * Deliberately only the weekly words. "monthly" and "fortnightly" are cadences
 * Arturo cannot keep, and asking which day would quietly turn a request it
 * cannot honour into a weekly one the operator never asked for — those still
 * get a refusal that says so.
 */
const WEEKLY_WITHOUT_A_DAY: ReadonlySet<string> = new Set([
  "weekly",
  "week",
  "every-week",
  "everyweek",
]);

const WEEKDAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function askScheduleTime(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What time?",
    body: [
      "What time of day? Use 24-hour time, like 09:00 or 17:30.",
      `(Times are in your timezone, ${localTimezone()}.)`,
    ].join("\n"),
  };
}

/** Builds the artefact from collected answers, delegating to the flag handler. */
function createArtefactFromAnswers(
  name: string,
  artKind: string,
  where: string,
  createdBy: string,
  enterpriseName: string,
  humanTask?: string,
  note?: string
): readonly WorkStreamEntry[] {
  const whereFlag = /^https:\/\//i.test(where) ? "--uri" : "--file";
  return [
    captureUiCommandOutput("Artefact", () =>
      handleArtefactCommand([
        "add",
        name,
        "--enterprise",
        enterpriseName,
        "--kind",
        artKind,
        whereFlag,
        where,
        "--created-by",
        createdBy,
        ...(humanTask ? ["--human-task", humanTask] : []),
        ...(note ? ["--notes", note] : []),
      ])
    ),
  ];
}

/**
 * What a new Task can be given to work from. Only the ones that make sense in
 * the current installation are offered, and the chosen list is remembered so a
 * reply maps to the same option the operator was shown.
 */
type TaskEvidenceKind =
  | "none"
  | "file"
  | "await-approval"
  | "search"
  | "procedure"
  | "follow-on";

const TASK_EVIDENCE_LABELS: Readonly<
  Record<TaskEvidenceKind, string>
> = {
  none: "No, it has everything it needs",
  file: "Work from a file you've attached",
  "await-approval": "Wait until a file has been approved, then work from it",
  search: "Search the public web first",
  procedure: "Follow one of your written Procedures",
  // Without this the operator had to paste the previous result into the
  // instruction by hand, and the Worker still never saw it: a support reply
  // written with no sight of the triage it followed invented a confirmation
  // ("our team has confirmed that the licence key was not sent") that nothing
  // had established. Arturo carries the material; the operator still decides
  // when the next step happens.
  "follow-on": "Continue from work that's already finished",
};

/** The finished Tasks a new one can be told to continue from. */
function completedTaskChoices(): readonly { id: string; task: string }[] {
  return listJobs()
    .filter((job) => job.status === "completed")
    .map((job) => ({ id: job.id, task: job.task }));
}

/**
 * Everything finished that a Task could be told to work from.
 *
 * Both kinds: an AI Worker's result and what a person reported. To the
 * operator picking what to continue from they are the same thing, and the
 * Sensor pattern -- a person observes, the AI reasons about what they found --
 * has no other route. Without it the operator retyped the findings into the
 * instruction and became the carrier themselves, which is what Blueprint 3
 * did while its own header claimed the AI was given them verbatim.
 *
 * A Human Task completed with no notes is left out. There is nothing in it to
 * work from, and picking one produces a Worker that reports being given
 * nothing -- the failure this whole mechanism exists to prevent.
 *
 * Not offered by /create-human-task, which hands over a Job's result only.
 */
function completedWorkChoices(): readonly { id: string; task: string }[] {
  return [
    ...completedTaskChoices(),
    ...listHumanTasks()
      .filter((task) => task.status === "completed" && Boolean(task.notes?.trim()))
      .map((task) => ({ id: task.id, task: `${task.title} — what a person found` })),
  ];
}

/** The files a Task can be told to work from right now. */
function taskInputArtefactReferences(): readonly string[] {
  return artefactVersionReferences("approved").concat(
    artefactVersionReferences("draft")
  );
}

/** The files a Task could wait on — ones not yet approved. */
function taskPendingArtefactReferences(): readonly string[] {
  return artefactVersionReferences("draft").concat(
    artefactVersionReferences("awaiting_review")
  );
}

/**
 * Asks what a new Task should work from, and remembers the answers gathered so
 * far. This is where --input-artefact, --search-query, --after-artefact-approval
 * and --procedure used to be typed.
 */
function askTaskEvidence(
  request: string,
  functionName: string | undefined
): readonly WorkStreamEntry[] {
  const options: TaskEvidenceKind[] = ["none"];
  if (completedWorkChoices().length > 0) options.push("follow-on");
  if (taskInputArtefactReferences().length > 0) options.push("file");
  if (taskPendingArtefactReferences().length > 0) {
    options.push("await-approval");
  }
  options.push("search");
  if (listProcedures().length > 0) options.push("procedure");

  commandMenu = {
    kind: "task",
    stage: "create-evidence",
    request,
    functionName,
    options,
  };
  return [askTaskEvidenceEntry(options)];
}

/** The "what should it work from?" question, sized to what actually exists. */
function askTaskEvidenceEntry(
  options: readonly TaskEvidenceKind[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Does this task need anything else?",
    body: [
      ...options.map(
        (option, index) => `  ${index + 1}. ${TASK_EVIDENCE_LABELS[option]}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Creates the Task from collected answers, delegating to the flag handler. */
function createTaskFromAnswers(
  request: string,
  functionName: string | undefined,
  extraArgs: readonly string[]
): readonly WorkStreamEntry[] {
  if (isInteractiveSession()) {
    return startTaskWorkType({ request, functionName, extraArgs });
  }
  return [
    captureUiCommandOutput("Task created", () =>
      handleTaskCreateCommand([
        request,
        ...(functionName ? ["--function", functionName] : []),
        ...extraArgs,
      ])
    ),
  ];
}

/** Records a new version of an existing Artefact from collected answers. */
function createArtefactVersionFromAnswers(
  artefactId: string,
  where: string,
  createdBy: string,
  note?: string
): readonly WorkStreamEntry[] {
  const whereFlag = /^https:\/\//i.test(where) ? "--uri" : "--file";
  return [
    captureUiCommandOutput("Artefact", () =>
      handleArtefactCommand([
        "version",
        artefactId,
        whereFlag,
        where,
        "--created-by",
        createdBy,
        ...(note ? ["--notes", note] : []),
      ])
    ),
  ];
}

/** Builds the Human Task from collected answers, delegating to the flag handler. */
function createHumanTaskFromAnswers(
  title: string,
  instructions: string,
  purpose: string,
  follows: string | undefined,
  owner: string | undefined,
  inputArtefact: string | undefined
): readonly WorkStreamEntry[] {
  return [
    captureUiCommandOutput("Human task created", () =>
      handleCreateTaskCommand([
        title,
        instructions,
        ...(purpose ? ["--purpose", purpose] : []),
        ...(follows ? ["--follows", follows] : []),
        ...(owner ? ["--assign-to", owner] : []),
        ...(inputArtefact ? ["--artefact", inputArtefact] : []),
      ])
    ),
  ];
}

/**
 * Asks whether the person is acting on a Task that has already finished.
 *
 * /task has offered this since Blueprint 1; a Human Task had no equivalent, so
 * the only way to hand an AI Worker's output to a person was to paste it into
 * the instructions by hand. Skipped when nothing has finished yet.
 */
function askHumanTaskFollows(
  title: string,
  instructions: string
): readonly WorkStreamEntry[] {
  const choices = completedTaskChoices();
  if (choices.length === 0) {
    return askHumanTaskOwner(title, instructions, "", undefined);
  }
  const ids = choices.map((choice) => choice.id);
  commandMenu = {
    kind: "humantask",
    stage: "create-follows",
    title,
    instructions,
    ids,
  };
  return [
    {
      actor: "Arturo",
      label: "Is there finished work they should act on?",
      body: [
        "  1. No",
        ...choices.map(
          (choice, index) =>
            `  ${index + 2}. ${choice.task.length <= 70 ? choice.task : `${choice.task.slice(0, 67)}...`} \u2014 ${choice.id}`
        ),
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Opens the assignee question, or skips it when nobody is registered. */
function askHumanTaskOwner(
  title: string,
  instructions: string,
  purpose: string,
  follows: string | undefined
): readonly WorkStreamEntry[] {
  const owners = availableHumanWorkerNames();
  if (owners.length === 0) {
    return askHumanTaskInputArtefact(title, instructions, purpose, follows, undefined);
  }
  commandMenu = {
    kind: "humantask",
    stage: "create-owner",
    title,
    instructions,
    purpose,
    follows,
    owners,
  };
  return [
    {
      actor: "Arturo",
      label: "Worker:",
      body: [
        ...owners.map((name, index) => `  ${index + 1}. ${name}`),
        `  ${owners.length + 1}. Leave it unassigned for now`,
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/**
 * Asks which exact file version the person must look at, replacing --artefact
 * on /create-human-task. Skipped entirely when nothing is attached.
 */
function askHumanTaskInputArtefact(
  title: string,
  instructions: string,
  purpose: string,
  follows: string | undefined,
  owner: string | undefined
): readonly WorkStreamEntry[] {
  const references = taskInputArtefactReferences();
  if (references.length === 0) {
    clearCommandMenu();
    return createHumanTaskFromAnswers(title, instructions, purpose, follows, owner, undefined);
  }
  commandMenu = {
    kind: "humantask",
    stage: "create-artefact",
    title,
    instructions,
    purpose,
    follows,
    owner,
    references,
  };
  return [askHumanTaskInputArtefactEntry(references)];
}

/** The "must they look at a file?" question. */
function askHumanTaskInputArtefactEntry(
  references: readonly string[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Must they look at a file?",
    body: [
      "Is there a file they must inspect to do this?",
      "",
      "  1. No",
      ...references.map(
        (reference, index) => `  ${index + 2}. ${artefactReferenceLabel(reference)}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/**
 * Asks whether the person produced a file, replacing --artefact on
 * /complete-human-task. An output file is passed to the next Workflow step, so it is
 * worth one question rather than a switch nobody discovers.
 */
function askHumanTaskOutputArtefact(
  id: string,
  notes: string,
  as: string | undefined
): readonly WorkStreamEntry[] {
  const references = taskInputArtefactReferences();
  if (references.length === 0) {
    clearCommandMenu();
    return [
      captureUiCommandOutput("Human task completed", () =>
        handleCompleteTaskCommand([id, notes, ...(as ? ["--as", as] : [])])
      ),
    ];
  }
  commandMenu = {
    kind: "humantask",
    stage: "act-artefact",
    id,
    notes,
    as: as ?? "",
    references,
  };
  return [askHumanTaskOutputArtefactEntry(references)];
}

/** The "did they produce a file?" question. */
function askHumanTaskOutputArtefactEntry(
  references: readonly string[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Did they produce a file?",
    body: [
      "Did this produce a file that later work should use?",
      "",
      "  1. No",
      ...references.map(
        (reference, index) => `  ${index + 2}. ${artefactReferenceLabel(reference)}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Builds the schedule from collected answers, delegating to the flag handler. */
function createScheduleFromAnswers(
  request: string,
  cadence: string,
  at: string,
  functionName?: string
): readonly WorkStreamEntry[] {
  return [
    handleUiScheduleCommand([
      "add",
      request,
      "--every",
      cadence,
      "--at",
      at,
      "--timezone",
      localTimezone(),
      ...(functionName ? ["--function", functionName] : []),
    ]),
  ];
}

export function clearCommandMenu(): void {
  commandMenu = undefined;
  clearSetupFlow();
  clearTaskWorkType();
  clearLaterStaff();
}

export function isCommandMenuActive(): boolean {
  return commandMenu !== undefined || isSetupFlowActive() || isTaskWorkTypeActive() || isLaterStaffActive();
}

/** What each guided flow is collecting, for the line that says it was dropped. */
const MENU_SUBJECTS: Readonly<Record<string, string>> = {
  enterprise: "setting up a business",
  function: "setting up a Function",
  task: "creating a Task",
  schedule: "setting up a schedule",
  artefact: "attaching a file",
  aiworker: "adding an AI Worker",
  humantask: "closing a Human Task",
  delegation: "handing work between Functions",
  governance: "adding a governance rule",
  event: "setting up an Event",
  memory: "saving something to memory",
  health: "checking a Function's health",
  decision: "signing work off",
  retry: "picking a name",
};

/**
 * Ends a half-finished guided flow because a command was typed instead.
 *
 * Typing a command mid-flow already abandoned whatever had been collected —
 * `/enterprise` part-way through setting up a business threw away the name and
 * the mission already given, and said nothing at all. The answers still go;
 * the operator is now told they went, so a lost answer looks like a lost
 * answer rather than a command that quietly did nothing.
 *
 * Returns undefined when no flow was open, so the caller adds no noise.
 *
 * SIDE EFFECT: Clears the module-level menu state.
 */
export function abandonCommandMenu(): { subject: string; unsaved: boolean } | undefined {
  if (isLaterStaffActive()) {
    clearLaterStaff();
    commandMenu = undefined;
    return { subject: "changing staff", unsaved: false };
  }
  if (isTaskWorkTypeActive()) {
    clearTaskWorkType();
    commandMenu = undefined;
    return { subject: "creating a Task", unsaved: true };
  }
  if (isSetupFlowActive()) {
    const unsaved = !setupFlowHasSavedEnterprise();
    clearSetupFlow();
    commandMenu = undefined;
    return { subject: "setting up a business", unsaved };
  }
  if (!commandMenu) return undefined;
  const subject = MENU_SUBJECTS[commandMenu.kind] ?? "what you had started";
  clearCommandMenu();
  return { subject, unsaved: true };
}

function menuNumber(reply: string): number | undefined {
  const n = Number(reply.trim());
  return Number.isInteger(n) ? n : undefined;
}

/** Starts the interactive /enterprise menu. */
export function startEnterpriseMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "enterprise", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Please select an option:",
      body: [
        "  1. Set up a new business",
        "  2. Talk it through with Arturo first",
        "  3. Look at a business you've set up",
        "  4. Change a business's details",
        "  5. See all your businesses",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Starts the interactive /function menu. */
export function startFunctionMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "function", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Please select an option:",
      body: [
        `Businesses loaded: ${listEnterprises().map(row => `${row.name} (${row.id})`).join(", ") || "none"}`,
        "",
        // Starting one is the step straight after adding it, and it had no
        // menu entry at all — the only way in was /function start, or the
        // legacy /runtime start, neither of which the menu mentions.
        "  1. Add a new Function",
        "  2. Start one running",
        "  3. Look at a Function you've set up",
        "  4. Change a Function's details",
        "  5. See all your Functions",
        "  6. Go back",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** One editable detail, and how to ask for its new value. */
type EditableField = {
  readonly label: string;
  readonly flag: string;
  readonly prompt: string;
  readonly body: (name: string) => string;
};

/** What can be changed about a business, in the order it is usually needed. */
const ENTERPRISE_EDIT_FIELDS: readonly EditableField[] = [
  {
    label: "What it does (its mission)",
    flag: "--mission",
    prompt: "Mission:",
    body: (name) =>
      [
        `In one sentence, what does ${name} exist to do?`,
        "",
        "This replaces the current mission and becomes the context Workers are given.",
      ].join("\n"),
  },
  {
    label: "A longer description",
    flag: "--description",
    prompt: "Describe it",
    body: (name) => `Describe ${name} in more detail, for people and for Worker context.`,
  },
  {
    label: "Its name",
    flag: "--name",
    prompt: "What should it be called?",
    body: (name) =>
      [
        `What should ${name} be called instead?`,
        "",
        "Functions, Workers, Tasks, and history stay attached to it.",
      ].join("\n"),
  },
];

/** What can be changed about a Function. */
const FUNCTION_EDIT_FIELDS: readonly EditableField[] = [
  {
    label: "What it keeps doing (its objective)",
    flag: "--objective",
    prompt: "What should it keep doing?",
    body: (name) => `In one sentence, what should "${name}" keep doing?`,
  },
  {
    label: "A longer description",
    flag: "--description",
    prompt: "Describe it",
    body: (name) => `Describe "${name}" in more detail, for people and for Worker context.`,
  },
];

/**
 * Asks for the longer description, after the one-line mission.
 *
 * The created record prints "Description (none)" right where the operator is
 * reading, so leaving it unreachable except through a switch invited exactly
 * the question it could not answer.
 */
function askEnterpriseDescription(name: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Description:",
    body: "",
  };
}

/** Asks for a Function's longer description, after its one-line objective. */
function askFunctionDescription(name: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Description:",
    body: "",
  };
}

/** Asks which detail of a business to change. */
function askEnterpriseEditField(name: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: `Change ${name}`,
    body: [
      "What would you like to change?",
      "",
      ...ENTERPRISE_EDIT_FIELDS.map(
        (field, index) => `  ${index + 1}. ${field.label}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks which detail of a Function to change. */
function askFunctionEditField(name: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: `Change ${name}`,
    body: [
      "What would you like to change?",
      "",
      ...FUNCTION_EDIT_FIELDS.map(
        (field, index) => `  ${index + 1}. ${field.label}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Says there is no business to act on, and how to get one. */
function noEnterpriseYetEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "No businesses yet",
    body: [
      "You haven't set up a business yet.",
      "Run /enterprise and choose 1 to set one up.",
    ].join("\n"),
  };
}

/** Says there is no Function to act on, and how to get one. */
function noFunctionYetEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "No Functions yet",
    body: "You have no Functions yet. Run /function and choose 1 to add one.",
  };
}

/** Starts the interactive /task menu. */
export function startTaskMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "task", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Please select an option:",
      body: [
        "  1. Create a task",
        // 2 and 3 used to run the same code and print the same list, so the
        // menu offered a choice that was not one. Looking at a task means one
        // task's full record, which the menu never had a route to at all.
        "  2. Look at one task in full",
        "  3. See all your tasks",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Starts the interactive /schedule menu. */
export function startScheduleMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "schedule", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Your schedules",
      body: [
        "A schedule makes a task happen automatically at times you choose.",
        "What would you like to do?",
        "",
        "  1. Schedule a task",
        "  2. See your schedules",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/**
 * Offers the values that do exist when a typed one matched nothing.
 *
 * `/function start "Client Advice"` used to answer "function not found" and
 * stop, leaving the operator to run /functions, read the real spelling, and
 * retype the whole line. The names were right there to offer. The original
 * arguments are kept and only the unmatched token is replaced, so flags further
 * along the line survive.
 *
 * Returns undefined when there is nothing to offer — a caller with no options
 * to show should keep its own not-found message rather than open an empty menu.
 *
 * SIDE EFFECT: Sets the module-level menu state.
 */
export function offerKnownValues(input: {
  readonly command: string;
  readonly args: readonly string[];
  readonly slot: number;
  readonly options: readonly string[];
  readonly label: string;
  readonly typed: string;
}): readonly WorkStreamEntry[] | undefined {
  if (input.options.length === 0 || !isInteractiveSession()) return undefined;
  commandMenu = {
    kind: "retry",
    stage: "pick",
    command: input.command,
    args: input.args,
    slot: input.slot,
    options: input.options,
  };
  return [
    {
      actor: "Arturo",
      label: input.label,
      body: [
        `There is nothing here called "${input.typed}". Did you mean one of these?`,
        "",
        ...input.options.map((option, index) => `  ${index + 1}. ${option}`),
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Starts the guided /artefact add wizard (attach a file as evidence). */
export function startArtefactAdd(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "artefact", stage: "name" };
  return [
    {
      actor: "Arturo",
      label: "Attach a file",
      body: [
        "Let's attach a file (a document, design, or other evidence) to your business.",
        "",
        "What should this file be called? (For example: Client contract)",
        "",
        "Or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** The AI-Worker roles offered in the guided /add-ai-worker flow. */
function aiWorkerRoles(): readonly AgentArchetype[] {
  return listArchetypes();
}

/** Starts the guided /add-ai-worker flow (name, then role). */
export function startAiWorkerAdd(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "aiworker", stage: "name" };
  return [
    {
      actor: "Arturo",
      label: "Add an AI Worker",
      body: [
        "Usually /staff adds the AI Workers you need for you. To add one by hand:",
        "",
        "What should this AI Worker be called? (For example: Contract Review Specialist)",
        "",
        "Or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Asks what kind of file is being attached. */
function askArtefactKind(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What kind of file?",
    body: [
      "What kind of file is it?",
      "",
      ...ARTEFACT_KINDS.map((kind, index) => `  ${index + 1}. ${kind}`),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks how often a scheduled Task should recur. */
function askScheduleCadence(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "How often?",
    body: [
      "How often should this happen?",
      "",
      "  1. Every day",
      "  2. Once a week, on a particular day",
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks what Arturo should do when a Governance rule matches. */
function askGovernanceEffect(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What should happen?",
    body: [
      "When this rule matches, what should Arturo do?",
      "",
      ...GOVERNANCE_EFFECTS.map(
        (option, index) => `  ${index + 1}. ${option.summary}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks what overall result a hand-built Workflow should produce. */
function askWorkflowObjective(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What is it for?",
    body: [
      "In one sentence, what overall result should it produce?",
      "",
      "Or type skip to leave that blank.",
    ].join("\n"),
  };
}

/** Asks which role a new AI Worker should take, as a numbered list. */
function askAiWorkerRole(name: string): WorkStreamEntry {
  const roles = aiWorkerRoles();
  return {
    actor: "Arturo",
    label: "What is its role?",
    body: [
      `What should "${name}" do? Pick the closest role:`,
      "",
      ...roles.map((role, index) => `  ${index + 1}. ${role} — ${ARCHETYPE_USES[role]}`),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Starts the guided /refine-worker flow (pick a Worker, then describe the role). */
export function startRefineWorker(): readonly WorkStreamEntry[] {
  // Use the registry name (the key refineWorker looks up), not the display
  // name — for AI Workers these are the same, and refine targets AI Workers.
  const workers = listWorkers()
    .filter((worker) => !worker.system)
    .map((worker) => worker.name);

  if (workers.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "No Workers yet",
        body: "There are no Workers to refine. Run /staff or /add-ai-worker to add some first.",
      },
    ];
  }

  commandMenu = { kind: "refine", stage: "pick", workers };
  return pickList("Refine a Worker", workers);
}

/**
 * Starts the guided /suggest picker: choose which Function to suggest work for
 * from a numbered list, rather than copy-pasting a --function flag.
 */
export function startSuggestMenu(
  labels: readonly string[],
  enterpriseReference: string | undefined
): readonly WorkStreamEntry[] {
  commandMenu = { kind: "suggest", stage: "pick", labels, enterpriseReference };
  return pickList("Which Function should Arturo suggest work for?", labels);
}

/**
 * The Governance effects, in the order a person weighs them: hold it for a
 * human first, refuse outright, or let it run.
 *
 * The wording is deliberately about consequences ("wait for a person to say
 * yes") rather than the stored enum, but the value handed to the policy engine
 * is unchanged — the menu collects answers, it does not decide anything.
 */
const GOVERNANCE_EFFECTS: readonly {
  readonly effect: string;
  readonly summary: string;
}[] = [
  {
    effect: "require-approval",
    summary: "Wait for a person to say yes before it runs",
  },
  {
    effect: "deny",
    summary: "Refuse it — never let this run",
  },
  {
    effect: "allow",
    summary: "Allow it — record the decision and let it run",
  },
];

/** The risk levels a rule can narrow to, plus "any". */
const GOVERNANCE_RISKS = ["any", "low", "medium", "high"] as const;

/**
 * Capabilities offered when choosing what a Governance rule applies to, with
 * the consequential ones first — those are what a rule is usually written for.
 */
function governanceCapabilityChoices(): readonly WorkerCapability[] {
  // Within each group, the consequential ones lead — those are what a rule is
  // usually written for.
  const byConsequence = (
    list: readonly WorkerCapability[]
  ): readonly WorkerCapability[] => [
    ...list.filter((capability) => isConsequentialCapability(capability)),
    ...list.filter((capability) => !isConsequentialCapability(capability)),
  ];

  const inferable = CORE_CAPABILITIES.filter((capability) =>
    INFERABLE_CAPABILITIES.includes(capability)
  );
  const rest = CORE_CAPABILITIES.filter(
    (capability) => !INFERABLE_CAPABILITIES.includes(capability)
  );
  return [...byConsequence(inferable), ...byConsequence(rest)];
}

/** Starts the interactive /governance menu. */
export function startGovernanceMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "governance", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Governance",
      body: [
        "Governance rules decide what work needs a person's say-so before it runs.",
        "",
        "  1. Add a rule",
        "  2. See the rules in place",
        "  3. Remove a rule",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/**
 * Asks which work a new rule applies to, as a numbered capability list.
 *
 * The list is split by whether Arturo can recognise the capability in a task
 * an operator types. A rule on one it cannot will not match a typed Task — it
 * was possible to pick "analysis", have the rule stored and listed, and never
 * have it fire. Both groups stay pickable, because the second still matches
 * work that declares the capability another way, but the difference is stated
 * rather than left to be discovered.
 */
function askGovernanceCapability(): WorkStreamEntry {
  const choices = governanceCapabilityChoices();
  const inferableCount = choices.filter((capability) =>
    INFERABLE_CAPABILITIES.includes(capability)
  ).length;

  const line = (capability: WorkerCapability, index: number): string =>
    `  ${index + 1}. ${capability} — ${getCapabilityDescription(capability).meaning}`;

  return {
    actor: "Arturo",
    label: "What does it apply to?",
    body: [
      "Which kind of work does this rule cover?",
      "",
      "Arturo can spot these in a task you type:",
      "",
      ...choices.slice(0, inferableCount).map(line),
      "",
      "It will not spot these in a task you type. A rule on one of them still",
      "applies to work that declares it another way — a Procedure, a Workflow",
      "step, or a task a running Function creates from an Event:",
      "",
      ...choices
        .slice(inferableCount)
        .map((capability, index) => line(capability, index + inferableCount)),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Builds the Governance rule from collected answers via the flag handler. */
function createGovernancePolicyFromAnswers(
  description: string,
  effect: string,
  capability: string,
  risk: string,
  enterpriseName: string | undefined
): readonly WorkStreamEntry[] {
  return [
    handleUiGovernanceCommand([
      "policy",
      "add",
      description,
      "--effect",
      effect,
      "--capability",
      capability,
      ...(risk === "any" ? [] : ["--risk", risk]),
      ...(enterpriseName
        ? ["--scope", "enterprise", "--enterprise", enterpriseName]
        : ["--scope", "global"]),
    ]),
  ];
}

/**
 * One Function an Event can come from, carrying the Enterprise it belongs to
 * so the guided flow never has to ask for the Enterprise separately.
 */
type EventFunctionChoice = {
  readonly label: string;
  readonly enterpriseName: string;
  /** Whether the Function's operating process is currently running. */
  readonly running: boolean;
};

/** The Functions an Event can be published from, with their owning business. */
function eventFunctionChoices(): readonly EventFunctionChoice[] {
  return listBusinessFunctionDefinitions().flatMap((definition) => {
    const enterprise = getEnterpriseByIdOrName(definition.enterpriseId);
    return enterprise
      ? [
          {
            label: definition.label,
            enterpriseName: enterprise.name,
            running: isBusinessFunctionRunning(definition.runtimeId),
          },
        ]
      : [];
  });
}

/** Whether a Function's operating process is running and can take work. */
function isBusinessFunctionRunning(
  runtimeId: string | undefined
): boolean {
  return runtimeId !== undefined
    && getBusinessFunction(runtimeId)?.state === "running";
}

/** How a Function is shown in an Event picker: name, and whose it is. */
function eventFunctionLabel(choice: EventFunctionChoice): string {
  return `${choice.label} (${choice.enterpriseName})`;
}

/** Starts the interactive /event menu. */
export function startEventMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "event", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Signals",
      body: [
        "An Event is a signal that something happened, which other Functions can react to.",
        "",
        "  1. Announce that something has happened",
        "  2. Announce it automatically whenever work finishes",
        "  3. See the automatic announcements",
        "  4. Stop an automatic announcement",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Says there is nothing to publish from, and where to go next. */
function noEventFunctionsEntry(): readonly WorkStreamEntry[] {
  clearCommandMenu();
  return [
    {
      actor: "Arturo",
      label: "No Functions yet",
      body: [
        "An Event has to come from one of your Functions, and you have none yet.",
        "Run /function and choose 1 to add one.",
      ].join("\n"),
    },
  ];
}

/** Asks what an automatic announcement should be called. */
function askEventRulePublishLabel(
  source: EventFunctionChoice
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What should it announce?",
    body: [
      `When ${source.label} finishes a piece of work, what should Arturo announce?`,
      "",
      "For example: evidence-ready. Other Functions can then react to it.",
    ].join("\n"),
  };
}

/** Publishes the Event from collected answers, delegating to the flag handler. */
async function publishEventFromAnswers(
  label: string,
  source: EventFunctionChoice
): Promise<WorkStreamEntry> {
  return await handleUiEventPublishCommand([
    label,
    "--source",
    source.label,
    "--enterprise",
    source.enterpriseName,
  ]);
}

/** Asks which work an automatic announcement should be limited to. */
function askEventRuleCapability(): WorkStreamEntry {
  const choices = governanceCapabilityChoices();
  return {
    actor: "Arturo",
    label: "Only for certain work?",
    body: [
      "Should this fire for every finished task, or only some kinds?",
      "",
      "  1. Every finished task",
      ...choices.map(
        (capability, index) => `  ${index + 2}. Only ${capability} work`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** One ordered step being built up in the guided /workflow create flow. */
type WorkflowStepDraft = {
  readonly worker: string;
  readonly instruction: string;
};

/** Starts the interactive /workflow menu. */
export function startWorkflowMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "workflow", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Workflows",
      body: [
        "A Workflow is a reusable, ordered path through several Workers.",
        "",
        "  1. Describe it, and let Arturo work out the steps",
        "  2. Set the steps myself, in order",
        "  3. See the saved Workflows",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** Asks which Worker performs the next step, or whether the order is finished. */
function askWorkflowStepWorker(
  workers: readonly string[],
  steps: readonly WorkflowStepDraft[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: steps.length === 0 ? "Who does the first step?" : "Who does the next step?",
    body: [
      ...(steps.length > 0
        ? [
            "So far:",
            ...steps.map(
              (step, index) => `  ${index + 1}. ${step.worker} — ${step.instruction}`
            ),
            "",
          ]
        : []),
      steps.length === 0
        ? "Which Worker does the first step?"
        : "Which Worker does the next step?",
      "",
      ...workers.map((worker, index) => `  ${index + 1}. ${worker}`),
      ...(steps.length > 0
        ? [`  ${workers.length + 1}. That's all the steps — save it`]
        : []),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/**
 * Saves the built-up Workflow through the deterministic create form, which
 * makes no planning-model call and preserves the named order exactly.
 */
async function createWorkflowFromAnswers(
  name: string,
  objective: string,
  steps: readonly WorkflowStepDraft[]
): Promise<readonly WorkStreamEntry[]> {
  try {
    return createGeneratedWorkflowEntries(
      await createGeneratedWorkflow([
        "create",
        name,
        ...(objective ? ["--objective", objective] : []),
        ...steps.flatMap((step) => ["--step", step.worker, step.instruction]),
      ])
    );
  } catch (error) {
    return [createWorkflowFailedEntry(error)];
  }
}

/** Starts the interactive /run picker over the saved Workflows. */
export function startRunMenu(): readonly WorkStreamEntry[] {
  const names = listWorkflows().map((workflow) => workflow.name);
  if (names.length === 0) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "No Workflows yet",
        body: "There is nothing saved to run. Run /workflow to design one first.",
      },
    ];
  }
  commandMenu = { kind: "run", stage: "pick", names };
  return pickList("Which Workflow should run?", names);
}

/**
 * The archetypes a saved Workflow's steps need but no registered Worker holds.
 *
 * PURE apart from reading the Worker registry: it decides what to ask, and
 * creates nothing.
 */
function missingWorkflowArchetypes(
  workflowName: string
): readonly string[] {
  const workflow = getWorkflow(workflowName);
  if (!workflow || workflow.mode !== "planned") return [];
  return Array.from(
    new Set(
      workflow.steps
        .map((step) => step.archetype)
        .filter(
          (archetype) =>
            archetypeRegistry[archetype as AgentArchetype] !== undefined &&
            !hasWorkerForArchetype(archetype as AgentArchetype)
        )
    )
  );
}

/** After the Workflow is chosen, asks only the questions that apply to it. */
function askAfterRunWorkflowPicked(
  name: string
): readonly WorkStreamEntry[] {
  const archetypes = missingWorkflowArchetypes(name);
  if (archetypes.length > 0) {
    commandMenu = { kind: "run", stage: "missing-workers", name, archetypes };
    return [askRunMissingWorkers(name, archetypes)];
  }
  return askRunStartFile(name, false);
}

/**
 * Asks whether Arturo may create the roles a Workflow's steps need.
 *
 * This is what --auto-workers stood for. Creating Workers is a real change, so
 * it is put as a question with the roles named, rather than a switch whose
 * effect is invisible until afterwards.
 */
function askRunMissingWorkers(
  name: string,
  archetypes: readonly string[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Some steps have no Worker",
    body: [
      `${name} has steps that need roles nobody is registered for:`,
      "",
      ...archetypes.map((archetype) => `  · ${archetype}`),
      "",
      "  1. Create those roles for me and run it",
      "  2. Stop — I'll add them myself",
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks whether the run should start from an attached file. */
function askRunStartFile(
  name: string,
  autoWorkers: boolean
): readonly WorkStreamEntry[] {
  const references = artefactVersionReferences("approved").concat(
    artefactVersionReferences("draft")
  );
  if (references.length === 0) {
    return askRunContext(name, autoWorkers, undefined);
  }
  commandMenu = { kind: "run", stage: "start-file", name, autoWorkers, references };
  return [askRunStartFileEntry(references)];
}

/** The "start from a file?" question, sized to what is actually attached. */
function askRunStartFileEntry(
  references: readonly string[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Start from a file?",
    body: [
      "Should the first step start from a file you've attached?",
      "",
      "  1. No, it has everything it needs",
      ...references.map(
        (reference, index) => `  ${index + 2}. ${artefactReferenceLabel(reference)}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Asks for anything the run should know, then runs it. */
function askRunContext(
  name: string,
  autoWorkers: boolean,
  inputArtefact: string | undefined
): readonly WorkStreamEntry[] {
  commandMenu = { kind: "run", stage: "context", name, autoWorkers, inputArtefact };
  return [
    {
      actor: "Arturo",
      label: "Anything to add?",
      body: [
        "Is there anything this run should know? (For example: Create two designs for the youth collection.)",
        "",
        "Or type skip to run it as saved.",
      ].join("\n"),
    },
  ];
}

/**
 * Starts the interactive /start-functions confirmation.
 *
 * The old --ready flag existed to make the batch start deliberate. That
 * deliberateness is preserved as an explicit question rather than a switch:
 * nothing starts until the operator answers 1.
 */
export function startFunctionsMenu(): readonly WorkStreamEntry[] {
  const names = listEnterprises().map((enterprise) => enterprise.name);
  if (names.length > 1) {
    commandMenu = { kind: "startfunctions", stage: "enterprise", names };
    return [
      {
        actor: "Arturo",
        label: "Which business?",
        body: [
          "Which business's Functions should Arturo try to start?",
          "",
          ...names.map((name, index) => `  ${index + 1}. ${name}`),
          `  ${names.length + 1}. All of them`,
          "",
          "Reply with a number, or ESC to go back.",
        ].join("\n"),
      },
    ];
  }
  commandMenu = { kind: "startfunctions", stage: "confirm", enterpriseName: undefined };
  return [askStartFunctionsConfirmation(undefined)];
}

/** Asks for the explicit go-ahead the --ready flag used to stand for. */
function askStartFunctionsConfirmation(
  enterpriseName: string | undefined
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Start everything that is ready?",
    body: [
      enterpriseName
        ? `Arturo will check every Function in ${enterpriseName} and start the ones that pass.`
        : "Arturo will check every Function and start the ones that pass.",
      "A Function missing a Worker or a required approver stays stopped, with the reason.",
      "",
      "  1. Yes, start them",
      "  2. No, leave them alone",
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** The review decisions a person can record against an exact file version. */
const ARTEFACT_DECISIONS: readonly {
  readonly decision: string;
  readonly summary: string;
}[] = [
  { decision: "approve", summary: "Approve it — this exact version is good to use" },
  { decision: "reject", summary: "Reject it — this version must not be used" },
  { decision: "revise", summary: "Send it back — say what must change" },
];

/**
 * The exact file versions in a given review state, as `id@version` references.
 *
 * Review is always bound to one exact version, never to the file in general,
 * so the pickers work in exact references throughout.
 */
function artefactVersionReferences(
  status?: ArtefactReviewStatus
): readonly string[] {
  return listArtefacts().flatMap((artefact) =>
    artefact.versions
      .filter((version) => !status || version.reviewStatus === status)
      .map((version) => `${artefact.id}@${version.version}`)
  );
}

/** How a file version reads in a picker: name, kind, and exact reference. */
function artefactReferenceLabel(reference: string): string {
  const [id] = reference.split("@");
  const artefact = getArtefact(id);
  return artefact
    ? `${artefact.name} (${artefact.kind}) — ${reference}`
    : reference;
}

/** The registered people a file version can be sent to for review. */
function artefactReviewerNames(): readonly string[] {
  return availableHumanWorkerNames();
}

/** Asks what a person decided about one exact file version. */
function askArtefactDecision(
  reference: string,
  reviewer: string
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What did they decide?",
    body: [
      `What did ${reviewer} decide about ${artefactReferenceLabel(reference)}?`,
      "",
      ...ARTEFACT_DECISIONS.map(
        (option, index) => `  ${index + 1}. ${option.summary}`
      ),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

/** Starts the interactive /artefact menu. */
/** Asks whether a watched folder's JSON files should be split into entries. */
function askWatchEach(person: string): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Whole files, or one Task per entry?",
    body: [
      `${person} will be recorded as having set this up.`,
      "",
      "If the program writes JSON with a list in it, Arturo can give each of the first few entries its own Task.",
      "Type the list's name (for example: trends), or press Enter to hand over each file whole.",
    ].join("\n"),
  };
}

/** Sets up the watch through the same command the one-line form uses. */
function runWatchAdd(
  folder: string,
  functionLabel: string,
  enterprise: string,
  instruction: string,
  person: string,
  list?: string,
  first?: number
): WorkStreamEntry {
  return captureUiCommandOutput("Folder watched", () =>
    handleArtefactCommand([
      "watch",
      "add",
      folder,
      "--function",
      functionLabel,
      "--enterprise",
      enterprise,
      "--task",
      instruction,
      "--created-by",
      person,
      ...(list ? ["--each", list, "--first", String(first ?? 3)] : []),
    ])
  );
}

export function startArtefactMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "artefact", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Files",
      body: [
        "Arturo records where a file is and what it is, so work can point at an exact version.",
        "",
        "  1. Attach a file",
        "  2. Record a new version of a file you've attached",
        "  3. Send a file to someone for review",
        "  4. Record a review decision",
        "  5. See the files",
        "  6. Look at one file and every version of it",
        "  7. Check a file still matches what Arturo recorded",
        "  8. Watch a folder, so files a program writes there are taken in by themselves",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** One thing a note can be filed under: a Function, a business, or everything. */
type MemoryScopeChoice = {
  readonly label: string;
  readonly reference: string;
};

/**
 * The scopes a note can be filed under, most specific first: the Functions
 * that will read it, then the businesses, then everything.
 */
function memoryScopeChoices(): readonly MemoryScopeChoice[] {
  return [
    ...listBusinessFunctionDefinitions().map((definition) => ({
      label: `${definition.label} — only this Function's work`,
      reference: definition.label,
    })),
    ...listEnterprises().map((enterprise) => ({
      label: `${enterprise.name} — everything this business does`,
      reference: enterprise.name,
    })),
    { label: "Everything on this computer", reference: "global" },
  ];
}

/** Starts the interactive /memory menu. */
export function startMemoryMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "memory", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "What Arturo remembers",
      body: [
        "Notes here are given to Workers as context on later work.",
        "",
        "  1. Write a note down",
        // "See what is written down" described the right thing without ever
        // saying "memory", so /memory looked like a command that answers a
        // question with a menu instead of with what is stored.
        "  2. Show me everything in memory",
        "  3. Remove a note",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/**
 * Starts the interactive /health picker.
 *
 * Bare /health answered with usage text, alone among the commands the manual
 * teaches. Health is read about one Function, and the operator is being asked
 * which — a question the product can put directly.
 *
 * SIDE EFFECT: Sets the command menu, or answers immediately.
 */
export function startHealthMenu(): readonly WorkStreamEntry[] {
  const names =
    listBusinessFunctionDefinitions().map(
      (definition) => definition.label
    );

  if (names.length === 0) {
    clearCommandMenu();
    return [noFunctionYetEntry()];
  }

  if (names.length === 1) {
    clearCommandMenu();
    return [handleUiHealthCommand([names[0]])];
  }

  commandMenu = { kind: "health", stage: "pick", names };
  return pickList(
    "Which Function's health?",
    names
  );
}

/** Starts the interactive /delegation menu. */
export function startDelegationMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "delegation", stage: "choose" };
  return [
    {
      actor: "Arturo",
      label: "Handing work between Functions",
      body: [
        "One Function can ask another to do a bounded piece of work for it.",
        "",
        "  1. Ask one Function to do work for another",
        "  2. See what has been handed over",
        "  3. Look at one handover",
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/** The Human Task actions that ask a person for something in writing. */
type HumanTaskAction = "complete" | "block" | "revise";

/** The registered people a Human Task can be assigned to or attributed to. */
/**
 * The people this Task's decision would actually be accepted from.
 *
 * `refuseUndesignatedApprover` rejects anyone the staffing plan did not make
 * accountable, and `resolveApprovalCommandIdentity` rejects anyone whose role
 * cannot approve. Offering a name the command would then refuse is the pattern
 * this menu exists to avoid, so the list is narrowed to both before it is shown.
 * With no designation recorded, the control is open by design and every
 * approval-capable person is offered.
 */
export function approverNamesForJob(
  jobId: string
): readonly string[] {
  const capable = listWorkers()
    .filter(
      (worker) =>
        worker.kind === "human" &&
        !worker.system &&
        worker.availability !== "offline" &&
        isApprovalCapableMode(worker.humanMode)
    )
    .map((worker) => worker.displayName ?? worker.name);

  const designated =
    designatedApproversForFunction(
      getJob(jobId)?.businessFunctionId
    );

  if (designated.length === 0) return capable;

  return capable.filter((name) =>
    designated.some(
      (approver: string) => approver.toLowerCase() === name.toLowerCase()
    )
  );
}

/** One line per Task waiting on a decision: its id and what it would do. */
function describeWaitingDecision(
  jobId: string
): string {
  const job = getJob(jobId);
  const instruction = (job?.task ?? "").replace(/\s+/g, " ").trim();
  return instruction.length > 88
    ? `${jobId} — ${instruction.slice(0, 88)}…`
    : `${jobId} — ${instruction || "(no instruction recorded)"}`;
}

/**
 * Opens the guided /approve or /reject flow.
 *
 * Approving was the last thing in the product that could only be done with a
 * switch: an operator had to know the Task id, and had to know to add
 * `--as "<name>"` the moment a second person could approve. It is also the
 * command that matters most, so it is the worst one to leave uncomfortable.
 */
export function startDecisionMenu(
  action: "approve" | "reject"
): readonly WorkStreamEntry[] {
  const waiting = listApprovalChains()
    .filter((chain: { status: string }) => chain.status === "pending")
    .map((chain: { jobId: string }) => chain.jobId);

  if (waiting.length === 0) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "Nothing is waiting for a decision",
        body: [
          "No Task is currently held for approval.",
          "Run /approvals to see the record, or /tasks to see what is running.",
        ].join("\n"),
      },
    ];
  }

  // Precheck the people before the Task: choosing a Task and then being told
  // nobody may decide it wastes the operator's time on a dead end.
  if (waiting.every((jobId: string) => approverNamesForJob(jobId).length === 0)) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "No one on record can decide this",
        body: [
          "Work is waiting, but nobody registered may approve it.",
          "Run /add-human-worker and give them the sign-off role, then re-run /staff",
          "so the plan names who is accountable.",
        ].join("\n"),
      },
    ];
  }

  if (waiting.length === 1) {
    return continueDecisionMenu(action, waiting[0]);
  }

  commandMenu = { kind: "decision", stage: "pick", action, ids: waiting };
  return pickList(
    action === "approve" ? "Which one are you approving?" : "Which one are you turning down?",
    waiting.map(describeWaitingDecision)
  );
}

/** Asks who is deciding when more than one person could, then finishes. */
function continueDecisionMenu(
  action: "approve" | "reject",
  id: string
): readonly WorkStreamEntry[] {
  const names = approverNamesForJob(id);

  if (names.length > 1) {
    commandMenu = { kind: "decision", stage: "who", action, id, names };
    return pickList("Who is deciding?", names);
  }

  return finishDecisionMenu(action, id, names[0]);
}

/** Runs the decision, asking a rejection for its reason first. */
function finishDecisionMenu(
  action: "approve" | "reject",
  id: string,
  as: string | undefined
): readonly WorkStreamEntry[] {
  if (action === "reject") {
    commandMenu = { kind: "decision", stage: "reason", action, id, as };
    return [
      {
        actor: "Arturo",
        label: "Why are you turning it down?",
        body: [
          "The reason is kept with the decision, so whoever picks this up next knows what to change.",
          "",
          "Type it and press enter.",
        ].join("\n"),
      },
    ];
  }

  clearCommandMenu();
  return [
    captureUiCommandOutput("Approval", () =>
      handleApproveCommand([id, ...(as ? ["--as", as] : [])])
    ),
  ];
}

function availableHumanWorkerNames(): readonly string[] {
  return listWorkers()
    .filter(
      (worker) =>
        worker.kind === "human" &&
        !worker.system &&
        isWorkerAvailableForNewTask(worker)
    )
    .map((worker) => worker.displayName ?? worker.name);
}

/**
 * Names a Human Task from what it asks for.
 *
 * The title is what /human-tasks lists, what the completion prompt quotes back
 * and what the browser page heads itself with, so it cannot simply be blank —
 * but asking for it separately made the operator say the same thing twice,
 * and every recorded session answered the two prompts with near-identical
 * text. The same truncation the Task pickers use, so the two read alike.
 *
 * PURE: No side effects.
 */
export function deriveHumanTaskTitle(instructions: string): string {
  const text = instructions.trim();
  return text.length <= 70 ? text : `${text.slice(0, 67)}...`;
}

/** Starts the guided /create-human-task flow (description, then who does it). */
export function startCreateHumanTaskMenu(): readonly WorkStreamEntry[] {
  commandMenu = { kind: "humantask", stage: "create-instructions" };
  return [
    {
      actor: "Arturo",
      label: "Description:",
      body: "",
    },
  ];
}

/** One line per Human Task in a picker: id, title, and current state. */
function humanTaskChoiceLabel(task: HumanTask): string {
  return `${task.title} — ${task.status.replace("_", " ")} (${task.id})`;
}

/**
 * Starts the guided /complete-human-task, /block-task, or /revise-task flow: pick a
 * Human Task from a numbered list, then say what happened in plain words.
 *
 * Only tasks the action can actually apply to are offered, so an operator
 * cannot pick a completed task and then be told it was the wrong one.
 */
export function startHumanTaskAction(
  action: HumanTaskAction
): readonly WorkStreamEntry[] {
  // Completion is attributed to a registered person, so with nobody registered
  // it can only fail closed. Say that up front rather than after the notes are
  // typed out.
  if (action === "complete" && availableHumanWorkerNames().length === 0) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "No one to attribute it to",
        body: [
          "Finishing a Human Task records which person did it, and no one is registered as available.",
          "Run /add-human-worker to add the person, then /complete-human-task again.",
        ].join("\n"),
      },
    ];
  }

  const eligible = listHumanTasks().filter((task) =>
    action === "revise"
      ? task.status !== "completed"
      : task.status === "open" || task.status === "needs_revision"
  );

  if (eligible.length === 0) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "Nothing waiting on a person",
        body: [
          "There are no Human Tasks this applies to.",
          "Run /human-tasks to see them all, or /create-human-task to ask a person for something.",
        ].join("\n"),
      },
    ];
  }

  const ids = eligible.map((task) => task.id);
  if (ids.length === 1) {
    commandMenu = { kind: "humantask", stage: "act-text", action, id: ids[0] };
    return [askHumanTaskActionText(action, eligible[0].title)];
  }

  commandMenu = { kind: "humantask", stage: "act-pick", action, ids };
  return pickList(
    action === "complete"
      ? "Which task is finished?"
      : action === "block"
        ? "Which task is stuck?"
        : "Which task needs changing?",
    eligible.map(humanTaskChoiceLabel)
  );
}

/** Asks for the notes, blocking reason, or revision instructions. */
function askHumanTaskActionText(
  action: HumanTaskAction,
  title: string
): WorkStreamEntry {
  if (action === "complete") {
    return {
      actor: "Arturo",
      // Names the task back. The operator reached here by typing a row number
      // against a list that reorders as tasks change state, and this is the
      // only thing between picking the wrong row and recording notes and an
      // attributed completion against it.
      label: `What was done for "${title}"?`,
      body: "",
    };
  }
  if (action === "block") {
    return {
      actor: "Arturo",
      label: "What is blocking it?",
      body: [
        `Why can "${title}" not go ahead right now?`,
        "",
        "Name the concrete blocker, and who owns the next step if you know.",
      ].join("\n"),
    };
  }
  return {
    actor: "Arturo",
    label: "What needs changing?",
    body: [
      `What must change before "${title}" can be finished?`,
      "",
      "Be specific — this is sent back as the revision instructions.",
    ].join("\n"),
  };
}

function pickList(
  label: string,
  names: readonly string[]
): readonly WorkStreamEntry[] {
  return [
    {
      actor: "Arturo",
      label,
      body: [
        "Which one?",
        "",
        ...names.map((name, index) => `  ${index + 1}. ${name}`),
        "",
        "Reply with a number, or ESC to go back.",
      ].join("\n"),
    },
  ];
}

/**
 * Labels one Task in the "which task?" picker.
 *
 * A Task has no name, only the sentence it was created from, so the row has to
 * carry enough of that sentence to tell two apart, plus the status — which is
 * usually why the operator is looking.
 *
 * PURE: No side effects.
 */
function describeTaskChoice(
  task: ReturnType<typeof listJobs>[number]
): string {
  const summary =
    task.task.length > 60
      ? `${task.task.slice(0, 60).trimEnd()}…`
      : task.task;

  return `${summary} — ${task.status}`;
}

/**
 * Routes a plain-text reply to the active /enterprise or /function menu.
 * Returns undefined when no menu is active so the caller can pass the reply on.
 *
 * SIDE EFFECT: May start an advise session, create/inspect/list Enterprises or
 * Functions, and clear the menu state.
 */
/**
 * Removes one matching pair of surrounding quotes from a guided-prompt reply.
 *
 * Every example Arturo prints uses quoted names (e.g. `/add-ai-worker "Contract
 * Review Specialist"`), so at an interactive name prompt users naturally type
 * the quotes too. The command-line path shell-strips them; this keeps the
 * guided path consistent instead of baking literal quotes into the name.
 *
 * PURE: No side effects. Only strips when the same quote opens and closes.
 */
export function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (trimmed.length >= 2 && (first === '"' || first === "'") && last === first) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function handleCommandMenuReply(
  reply: string
): Promise<readonly WorkStreamEntry[] | undefined> {
  if (isLaterStaffActive()) return replyToLaterStaff(reply);
  if (isSetupFlowActive()) return replyToSetup(reply);
  if (isTaskWorkTypeActive()) return replyToTaskWorkType(reply);
  if (!commandMenu) return undefined;

  const state = commandMenu;
  const trimmed = reply.trim();

  if (trimmed.toLowerCase() === "cancel") {
    clearCommandMenu();
    return [{ actor: "Arturo", label: "Cancelled", body: "No problem — nothing was changed." }];
  }

  // --- Enterprise menu ---
  if (state.kind === "enterprise") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        commandMenu = { kind: "enterprise", stage: "create-name" };
        return [
          {
            actor: "Arturo",
            label: "Name:",
            body: "",
          },
        ];
      }
      if (choice === 2) {
        clearCommandMenu();
        return [await startAdviseSession()];
      }
      if (choice === 3) {
        const names = listEnterprises().map((enterprise) => enterprise.name);
        if (names.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No businesses yet",
              body: [
                "You haven't set up a business yet.",
                "Run /enterprise and choose 1 to set one up.",
              ].join("\n"),
            },
          ];
        }
        if (names.length === 1) {
          clearCommandMenu();
          return [...(await handleUiEnterpriseInspectSubcommand([names[0]]))];
        }
        commandMenu = { kind: "enterprise", stage: "inspect-pick", names };
        return pickList("Which business?", names);
      }
      if (choice === 4) {
        const names = listEnterprises().map((enterprise) => enterprise.name);
        if (names.length === 0) {
          clearCommandMenu();
          return [noEnterpriseYetEntry()];
        }
        if (names.length === 1) {
          commandMenu = { kind: "enterprise", stage: "edit-field", name: names[0] };
          return [askEnterpriseEditField(names[0])];
        }
        commandMenu = { kind: "enterprise", stage: "edit-pick", names };
        return pickList("Which business?", names);
      }
      if (choice === 5) {
        clearCommandMenu();
        return createEnterpriseEntries();
      }
      return [
        { actor: "Arturo", label: "Please select an option:", body: "Please reply 1, 2, 3, 4, or 5 — or ESC to go back." },
      ];
    }

    if (state.stage === "create-name") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Name:", body: "Please type the name, or ESC to go back." },
        ];
      }
      commandMenu = {
        kind: "enterprise",
        stage: "create-mission",
        name: stripSurroundingQuotes(trimmed),
      };
      return [
        {
          actor: "Arturo",
          label: "Mission:",
          body: "",
        },
      ];
    }

    if (state.stage === "edit-pick") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.names.length) {
        return [
          { actor: "Arturo", label: "Which business?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      const name = state.names[index - 1];
      commandMenu = { kind: "enterprise", stage: "edit-field", name };
      return [askEnterpriseEditField(name)];
    }

    if (state.stage === "edit-field") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > ENTERPRISE_EDIT_FIELDS.length) {
        return [askEnterpriseEditField(state.name)];
      }
      const field = ENTERPRISE_EDIT_FIELDS[index - 1];
      commandMenu = { kind: "enterprise", stage: "edit-value", name: state.name, field: field.flag };
      return [
        {
          actor: "Arturo",
          label: field.prompt,
          body: field.body(state.name),
        },
      ];
    }

    if (state.stage === "edit-value") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Nothing changed", body: "Please type the new value, or ESC to go back." },
        ];
      }
      const { name, field } = state;
      clearCommandMenu();
      return await handleUiEnterpriseCommand([
        "update",
        name,
        field,
        stripSurroundingQuotes(trimmed),
      ]);
    }

    if (state.stage === "create-mission") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Mission:", body: "Please describe what the business does, or type skip to leave it blank." },
        ];
      }
      commandMenu = {
        kind: "enterprise",
        stage: "create-description",
        name: state.name,
        mission: trimmed.toLowerCase() === "skip" ? "" : trimmed,
      };
      return [askEnterpriseDescription(state.name)];
    }

    if (state.stage === "create-description") {
      const { name, mission } = state;
      // Enter on its own leaves it blank. The label no longer says "or type
      // skip", so re-asking an empty reply would loop with nothing on screen
      // saying how to get past it — ESC is the only other way out, and that
      // discards the name and mission already answered.
      const description = !trimmed || trimmed.toLowerCase() === "skip" ? "" : trimmed;
      clearCommandMenu();
      // Both values are passed explicitly, even when blank: the operator was
      // asked and answered, so this is a deliberate blank rather than an
      // omission the create path should ask about again.
      return await handleUiEnterpriseCommand([
        "create",
        name,
        "--mission",
        mission,
        ...(description ? ["--description", description] : []),
      ]);
    }

    // inspect-pick
    const index = menuNumber(trimmed);
    if (!index || index < 1 || index > state.names.length) {
      return [
        { actor: "Arturo", label: "Which business?", body: `Please reply with a number from 1 to ${state.names.length}.` },
      ];
    }
    const name = state.names[index - 1];
    clearCommandMenu();
    return [...(await handleUiEnterpriseInspectSubcommand([name]))];
  }

  // --- Re-run a typed line with one value corrected ---
  if (state.kind === "retry") {
    const choice = menuPick(trimmed, state.options);
    if (!choice) {
      return [
        {
          actor: "Arturo",
          label: "Which one?",
          body: `Please reply with a number from 1 to ${state.options.length}, or the name itself.`,
        },
      ];
    }
    const corrected = [...state.args];
    corrected[state.slot] = state.options[choice - 1];
    const { command } = state;
    clearCommandMenu();
    return handleUiCommand(command, corrected);
  }

  // --- Function menu ---
  if (state.kind === "function") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      // The typed equivalent of ESC. Nothing has been collected at this stage,
      // so leaving is the same as cancelling.
      if (choice === 6) {
        clearCommandMenu();
        return [{ actor: "Arturo", label: "Cancelled", body: "No problem — nothing was changed." }];
      }
      if (choice === 1) {
        commandMenu = { kind: "function", stage: "create-name" };
        return [
          {
            actor: "Arturo",
            label: "Name (eg 'Accounts', 'Product marketing'):",
            body: "",
          },
        ];
      }
      if (choice === 2) {
        const names = listBusinessFunctionDefinitions().map(
          (definition) => definition.label
        );
        if (names.length === 0) {
          clearCommandMenu();
          return [noFunctionYetEntry()];
        }
        if (names.length === 1) {
          clearCommandMenu();
          return [
            ...(await handleUiFunctionCommand([
              "start",
              names[0],
            ])),
          ];
        }
        commandMenu = { kind: "function", stage: "start-pick", names };
        return pickList("Which Function?", names);
      }
      if (choice === 3) {
        const names = listBusinessFunctionDefinitions().map(
          (definition) => definition.label
        );
        if (names.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No Functions yet",
              body: "You have no Functions yet. Run /function and choose 1 to add one.",
            },
          ];
        }
        if (names.length === 1) {
          clearCommandMenu();
          return [...(await handleUiFunctionInspectSubcommand([names[0]]))];
        }
        commandMenu = { kind: "function", stage: "inspect-pick", names };
        return pickList("Which Function?", names);
      }
      if (choice === 4) {
        const names = listBusinessFunctionDefinitions().map(
          (definition) => definition.label
        );
        if (names.length === 0) {
          clearCommandMenu();
          return [noFunctionYetEntry()];
        }
        if (names.length === 1) {
          commandMenu = { kind: "function", stage: "edit-field", name: names[0] };
          return [askFunctionEditField(names[0])];
        }
        commandMenu = { kind: "function", stage: "edit-pick", names };
        return pickList("Which Function?", names);
      }
      if (choice === 5) {
        clearCommandMenu();
        return [...(await handleUiFunctionListSubcommand([]))];
      }
      return [
        { actor: "Arturo", label: "Please select an option:", body: "Please reply 1 to 8, or ESC to go back." },
      ];
    }

    if (state.stage === "create-name") {
      if (!trimmed) {
        return [
          {
            actor: "Arturo",
            label: "Name (eg 'Accounts', 'Product marketing'):",
            body: "Please type a name for the Function, or ESC to go back.",
          },
        ];
      }
      commandMenu = { kind: "function", stage: "create-objective", name: trimmed };
      return [
        {
          actor: "Arturo",
          label: "Objective:",
          body: "",
        },
      ];
    }

    if (state.stage === "edit-pick") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.names.length) {
        return [
          { actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      const name = state.names[index - 1];
      commandMenu = { kind: "function", stage: "edit-field", name };
      return [askFunctionEditField(name)];
    }

    if (state.stage === "edit-field") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > FUNCTION_EDIT_FIELDS.length) {
        return [askFunctionEditField(state.name)];
      }
      const field = FUNCTION_EDIT_FIELDS[index - 1];
      commandMenu = { kind: "function", stage: "edit-value", name: state.name, field: field.flag };
      return [
        {
          actor: "Arturo",
          label: field.prompt,
          body: field.body(state.name),
        },
      ];
    }

    if (state.stage === "edit-value") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Nothing changed", body: "Please type the new value, or ESC to go back." },
        ];
      }
      const { name, field } = state;
      clearCommandMenu();
      return [
        ...(await handleUiFunctionCommand([
          "update",
          name,
          field,
          stripSurroundingQuotes(trimmed),
        ])),
      ];
    }

    if (state.stage === "create-objective") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Objective:", body: "Please describe what it should keep doing, or type skip to leave it blank." },
        ];
      }
      commandMenu = {
        kind: "function",
        stage: "create-description",
        name: state.name,
        objective: trimmed.toLowerCase() === "skip" ? "" : trimmed,
        enterpriseName: state.enterpriseName,
      };
      return [askFunctionDescription(state.name)];
    }

    if (state.stage === "create-description") {
      const { name, objective, enterpriseName } = state;
      // Enter on its own leaves it blank — see the Enterprise description.
      const description = !trimmed || trimmed.toLowerCase() === "skip" ? "" : trimmed;
      clearCommandMenu();
      return [
        ...(await handleUiFunctionCommand([
          "create",
          name,
          "--objective",
          objective,
          ...(description ? ["--description", description] : []),
          ...(enterpriseName ? ["--enterprise", enterpriseName] : []),
        ])),
      ];
    }

    if (state.stage === "create-enterprise-pick") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.names.length) {
        return [
          { actor: "Arturo", label: "Which business is this for?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      const { name } = state;
      const enterpriseName = state.names[index - 1];
      clearCommandMenu();
      return [
        ...(await handleUiFunctionCommand([
          "create",
          name,
          "--enterprise",
          enterpriseName,
        ])),
      ];
    }

    // function start-pick and inspect-pick: same question, different verb.
    const index = menuNumber(trimmed);
    if (!index || index < 1 || index > state.names.length) {
      return [
        { actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.names.length}.` },
      ];
    }
    const name = state.names[index - 1];
    const starting = state.stage === "start-pick";
    clearCommandMenu();
    return starting
      ? [
          ...(await handleUiFunctionCommand([
            "start",
            name,
          ])),
        ]
      : [...(await handleUiFunctionInspectSubcommand([name]))];
  }

  // --- Health picker ---
  if (state.kind === "health") {
    const choice = menuPick(trimmed, state.names);
    if (!choice) {
      return [
        {
          actor: "Arturo",
          label: "Which Function's health?",
          body: `Please reply with a number from 1 to ${state.names.length}, or the name on the row.`,
        },
      ];
    }
    const name = state.names[choice - 1];
    clearCommandMenu();
    return [handleUiHealthCommand([name])];
  }

  // --- Task menu ---
  if (state.kind === "task") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        commandMenu = { kind: "task", stage: "create-desc" };
        return [
          {
            actor: "Arturo",
            label: "Description:",
            body: "",
          },
        ];
      }
      if (choice === 2) {
        const tasks = listJobs();
        if (tasks.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No tasks yet",
              body: "You have no tasks yet. Run /task and choose 1 to create one.",
            },
          ];
        }
        if (tasks.length === 1) {
          clearCommandMenu();
          return [readJobDetailEntry(tasks[0].id)];
        }
        // The ids are captured now and the reply indexes into them. A row
        // number is not a stable handle — records change state between the
        // list being printed and the operator answering, and picking by
        // position would then open a different task than the one they read.
        commandMenu = {
          kind: "task",
          stage: "inspect-pick",
          ids: tasks.map((task) => task.id),
        };
        return pickList(
          "Which task?",
          tasks.map(describeTaskChoice)
        );
      }
      if (choice === 3) {
        clearCommandMenu();
        const tasks = listJobs();
        return [createNumberedJobsListEntry(tasks, tasks.length)];
      }
      return [
        { actor: "Arturo", label: "Please select an option:", body: "Please reply 1, 2, or 3 — or ESC to go back." },
      ];
    }

    if (state.stage === "inspect-pick") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.ids.length) {
        return [
          {
            actor: "Arturo",
            label: "Which task?",
            body: `Please reply with a number from 1 to ${state.ids.length}.`,
          },
        ];
      }
      const id = state.ids[index - 1];
      clearCommandMenu();
      return [readJobDetailEntry(id)];
    }

    if (state.stage === "create-desc") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Description:", body: "Please type what you want done, or ESC to go back." },
        ];
      }
      // "Description:" is also the label on the two optional fields an operator
      // has just met under /enterprise and /function, where skip is the way
      // past. Here it is the whole instruction, so taking the word literally
      // would queue a Task that reads "skip" and route it to a Worker.
      if (trimmed.toLowerCase() === "skip") {
        return [
          {
            actor: "Arturo",
            label: "Description:",
            body: "A task needs an instruction — this one cannot be skipped. Type what you want done, or ESC to go back.",
          },
        ];
      }
      const names = listBusinessFunctionDefinitions().map(
        (definition) => definition.label
      );
      if (names.length <= 1) {
        return askTaskEvidence(trimmed, undefined);
      }
      commandMenu = { kind: "task", stage: "create-fn-pick", request: trimmed, names };
      return pickList("Which Function should do this?", names);
    }

    if (state.stage === "create-fn-pick") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.names.length) {
        return [
          { actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      return askTaskEvidence(state.request, state.names[index - 1]);
    }

    if (state.stage === "create-evidence") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.options.length) {
        return [askTaskEvidenceEntry(state.options)];
      }
      const { request, functionName } = state;
      const picked = state.options[choice - 1];

      if (picked === "none") {
        clearCommandMenu();
        return createTaskFromAnswers(request, functionName, []);
      }

      if (picked === "follow-on") {
        const finished = completedWorkChoices();
        commandMenu = {
          kind: "task",
          stage: "create-follow-on",
          request,
          functionName,
          ids: finished.map((job) => job.id),
        };
        return pickList(
          "Which finished work should it continue from?",
          finished.map(
            (job) =>
              `${job.task.length <= 70 ? job.task : `${job.task.slice(0, 67)}...`} — ${job.id}`
          )
        );
      }

      if (picked === "file" || picked === "await-approval") {
        const references =
          picked === "file"
            ? taskInputArtefactReferences()
            : taskPendingArtefactReferences();
        commandMenu = {
          kind: "task",
          stage: "create-artefact",
          request,
          functionName,
          references,
          flag:
            picked === "file"
              ? "--input-artefact"
              : "--after-artefact-approval",
        };
        return pickList(
          picked === "file"
            ? "Which file should it work from?"
            : "Which file must be approved first?",
          references.map(artefactReferenceLabel)
        );
      }

      if (picked === "procedure") {
        const references = listProcedures().map((procedure) =>
          formatProcedureReference(procedure.document)
        );
        commandMenu = {
          kind: "task",
          stage: "create-procedure",
          request,
          functionName,
          references,
        };
        return pickList("Which Procedure should it follow?", references);
      }

      // search
      commandMenu = {
        kind: "task",
        stage: "create-search",
        request,
        functionName,
      };
      return [
        {
          actor: "Arturo",
          label: "What should it search for?",
          body: [
            "What should Arturo search the public web for before the work starts?",
            "",
            "The search only runs if the Worker is authorised for it and a provider is configured.",
          ].join("\n"),
        },
      ];
    }

    if (state.stage === "create-follow-on") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.ids.length) {
        return [
          {
            actor: "Arturo",
            label: "Which finished work should it continue from?",
            body: `Please reply with a number from 1 to ${state.ids.length}.`,
          },
        ];
      }
      const { request, functionName } = state;
      const sourceId = state.ids[index - 1];
      clearCommandMenu();
      return createTaskFromAnswers(request, functionName, ["--follows", sourceId]);
    }

    if (state.stage === "create-artefact") {
      const references = menuReferences(trimmed, state.references);
      if (!references) {
        return [
          {
            actor: "Arturo",
            label:
              state.flag === "--input-artefact"
                ? "Which file should it work from?"
                : "Which file must be approved first?",
            body: `Please reply with a number from 1 to ${state.references.length}, or the file's own reference. More than one is fine — separate them with commas.`,
          },
        ];
      }
      const { request, functionName, flag } = state;

      if (flag === "--input-artefact") {
        // The gate is about the files just chosen, which reads better than a
        // separate top-level option and is the only way to say both at once.
        const holdable = references.filter((reference) =>
          taskPendingArtefactReferences().includes(reference)
        );
        if (holdable.length > 0) {
          commandMenu = {
            kind: "task",
            stage: "create-gate",
            request,
            functionName,
            references,
            holdable,
          };
          return [
            {
              actor: "Arturo",
              label: "Should it wait for a decision first?",
              body: [
                "Some of those are not decided yet. The Task can be held until they are.",
                "",
                ...holdable.map(
                  (reference, index) => `  ${index + 1}. ${artefactReferenceLabel(reference)}`
                ),
                "",
                "Reply with a number, or skip to start as soon as it is approved to run.",
              ].join("\n"),
            },
          ];
        }
      }

      clearCommandMenu();
      return createTaskFromAnswers(request, functionName, [flag, references.join(",")]);
    }

    if (state.stage === "create-gate") {
      const { request, functionName, references, holdable } = state;
      if (isSkipReply(trimmed)) {
        clearCommandMenu();
        return createTaskFromAnswers(request, functionName, [
          "--input-artefact",
          references.join(","),
        ]);
      }
      const gated = menuReferences(trimmed, holdable);
      if (!gated) {
        return [
          {
            actor: "Arturo",
            label: "Should it wait for a decision first?",
            body: `Please reply with a number from 1 to ${holdable.length}, the file's own reference, or skip.`,
          },
        ];
      }
      clearCommandMenu();
      return createTaskFromAnswers(request, functionName, [
        "--input-artefact",
        references.join(","),
        "--after-artefact-approval",
        gated.join(","),
      ]);
    }

    if (state.stage === "create-procedure") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.references.length) {
        return [
          { actor: "Arturo", label: "Which Procedure should it follow?", body: `Please reply with a number from 1 to ${state.references.length}.` },
        ];
      }
      const { request, functionName } = state;
      const reference = state.references[choice - 1];
      clearCommandMenu();
      // The Procedure is resolved, integrity-checked, and capability-authorised
      // at execution; picking it here changes nothing about that.
      return createTaskFromAnswers(request, functionName, [
        "--procedure",
        reference,
      ]);
    }

    // task create-search
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "What should it search for?", body: "Please type what to search for, or ESC to go back." },
      ];
    }
    const { request, functionName } = state;
    clearCommandMenu();
    return createTaskFromAnswers(request, functionName, [
      "--search-query",
      stripSurroundingQuotes(trimmed),
    ]);
  }

  // --- Schedule menu ---
  if (state.kind === "schedule") {
  if (state.stage === "choose") {
    const choice = menuNumber(trimmed);
    if (choice === 1) {
      commandMenu = { kind: "schedule", stage: "add-desc" };
      return [
        {
          actor: "Arturo",
          label: "Schedule a task",
          body: "In one sentence, what should happen on a schedule? (For example: Prepare a weekly summary of work done.)",
        },
      ];
    }
    if (choice === 2) {
      clearCommandMenu();
      return [handleUiScheduleCommand(["list"])];
    }
    return [
      { actor: "Arturo", label: "Your schedules", body: "Please reply 1 or 2 — or ESC to go back." },
    ];
  }

  if (state.stage === "add-desc") {
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "Schedule a task", body: "Please type what should happen, or ESC to go back." },
      ];
    }
    commandMenu = { kind: "schedule", stage: "add-cadence", request: trimmed };
    return [
      askScheduleCadence(),
    ];
  }

  if (state.stage === "add-cadence") {
    const choice = menuNumber(trimmed);
    if (choice === 1) {
      commandMenu = { kind: "schedule", stage: "add-time", request: state.request, cadence: "daily" };
      return [askScheduleTime()];
    }
    if (choice === 2) {
      commandMenu = { kind: "schedule", stage: "add-day", request: state.request };
      return [
        {
          actor: "Arturo",
          label: "Which day?",
          body: [
            "Which day of the week?",
            "",
            ...WEEKDAY_NAMES.map((day, index) => `  ${index + 1}. ${capitalise(day)}`),
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }
    return [
      { actor: "Arturo", label: "How often?", body: "Please reply 1 (every day) or 2 (once a week)." },
    ];
  }

  if (state.stage === "add-day-for-args") {
    const choice = menuPick(trimmed, WEEKDAY_NAMES);
    if (!choice) {
      return [
        { actor: "Arturo", label: "Which day?", body: `Please reply with a number from 1 to ${WEEKDAY_NAMES.length}, or the day's name.` },
      ];
    }
    const filled = [...state.args];
    filled[state.everyIndex] = WEEKDAY_NAMES[choice - 1];
    clearCommandMenu();
    return [handleUiScheduleCommand(filled)];
  }

  if (state.stage === "add-day") {
    // The day is the one list where its own name is the obvious answer.
    const choice = menuPick(trimmed, WEEKDAY_NAMES);
    if (!choice) {
      return [
        { actor: "Arturo", label: "Which day?", body: `Please reply with a number from 1 to ${WEEKDAY_NAMES.length}, or the day's name.` },
      ];
    }
    commandMenu = { kind: "schedule", stage: "add-time", request: state.request, cadence: WEEKDAY_NAMES[choice - 1] };
    return [askScheduleTime()];
  }

  if (state.stage === "add-time") {
    if (!/^\d{1,2}:\d{2}$/.test(trimmed)) {
      return [
        { actor: "Arturo", label: "What time?", body: "Please give a time like 09:00 or 17:30 (24-hour), or ESC to go back." },
      ];
    }
    const names = listBusinessFunctionDefinitions().map(
      (definition) => definition.label
    );
    if (names.length === 0) {
      clearCommandMenu();
      return [
        {
          actor: "Arturo",
          label: "No Functions yet",
          body: "A scheduled task needs a Function to run it. Run /function to add one first, then /schedule.",
        },
      ];
    }
    if (names.length === 1) {
      clearCommandMenu();
      return createScheduleFromAnswers(state.request, state.cadence, trimmed);
    }
    commandMenu = {
      kind: "schedule",
      stage: "add-fn-pick",
      request: state.request,
      cadence: state.cadence,
      at: trimmed,
      names,
    };
    return pickList("Which Function should do this?", names);
  }

  // schedule add-fn-pick
  const index = menuPick(trimmed, state.names);
  if (!index) {
    return [
      { actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.names.length}.` },
    ];
  }
  const chosen = state.names[index - 1];
  const { request, cadence, at } = state;
  clearCommandMenu();
  return createScheduleFromAnswers(request, cadence, at, chosen);
  }

  // --- Add-AI-Worker flow ---
  if (state.kind === "aiworker") {
    if (state.stage === "name") {
      const name = stripSurroundingQuotes(trimmed);
      if (!name) {
        return [
          { actor: "Arturo", label: "Add an AI Worker", body: "Please type a name for the AI Worker, or ESC to go back." },
        ];
      }
      commandMenu = { kind: "aiworker", stage: "role", name };
      return [askAiWorkerRole(name)];
    }

    // aiworker role
    const roles = aiWorkerRoles();
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > roles.length) {
      return [
        { actor: "Arturo", label: "What is its role?", body: `Please reply with a number from 1 to ${roles.length}.` },
      ];
    }
    const { name } = state;
    clearCommandMenu();
    // Positional [name, archetype] keeps the model at the /model choice.
    return handleUiAddAiWorker([name, roles[choice - 1]]);
  }

  // --- Refine-Worker flow ---
  if (state.kind === "refine") {
    if (state.stage === "pick") {
      const choice = menuPick(trimmed, state.workers);
      if (!choice) {
        return [
          { actor: "Arturo", label: "Refine a Worker", body: `Please reply with a number from 1 to ${state.workers.length}.` },
        ];
      }
      commandMenu = { kind: "refine", stage: "text", workerName: state.workers[choice - 1] };
      return [
        {
          actor: "Arturo",
          label: `How should ${state.workers[choice - 1]} specialise?`,
          // Written in the second person, because that is what it becomes.
          // The refinement is appended to the Worker's prompt, so "You are an
          // expert in X" shapes how the model answers in a way that "focus on
          // X" does not — and the example is the only guidance an operator
          // gets about which of the two to write.
          body: [
            "Type your instructions, or ESC to go back.",
            "",
            "For example: You are a softball coach who specialises in coaching "
            + "softball for girls under 15. You have many years of experience "
            + "and have played at top levels.",
          ].join("\n"),
        },
      ];
    }

    // refine text
    if (!trimmed) {
      return [
        { actor: "Arturo", label: `How should ${state.workerName} specialise?`, body: "Please type the instructions, or ESC to go back." },
      ];
    }
    const { workerName } = state;
    clearCommandMenu();
    const worker = refineWorker(workerName, trimmed);
    return [
      worker
        ? createWorkerRefinedEntry(worker.name, worker.refinement)
        : { actor: "Arturo", label: "Worker not found", body: `worker not found: ${workerName}` },
    ];
  }

  // --- Suggest-work picker ---
  if (state.kind === "suggest") {
    const choice = menuPick(trimmed, state.labels);
    if (!choice) {
      return [
        { actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.labels.length}.` },
      ];
    }
    const label = state.labels[choice - 1];
    const { enterpriseReference } = state;
    clearCommandMenu();
    return [await handleUiSuggestCommand(label, enterpriseReference)];
  }

  // --- Workflow menu ---
  if (state.kind === "workflow") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        commandMenu = { kind: "workflow", stage: "describe" };
        return [
          {
            actor: "Arturo",
            label: "Describe the Workflow",
            body: [
              "In one or two sentences, what should this Workflow achieve, start to finish?",
              "",
              "Arturo will propose the steps. Nothing runs until you start it.",
            ].join("\n"),
          },
        ];
      }
      if (choice === 2) {
        const workers = listWorkers()
          .filter((worker) => !worker.system)
          .map((worker) => worker.displayName ?? worker.name);
        if (workers.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No Workers yet",
              body: "A Workflow's steps are performed by registered Workers, and there are none. Run /staff first.",
            },
          ];
        }
        commandMenu = { kind: "workflow", stage: "build-name" };
        return [
          {
            actor: "Arturo",
            label: "Name the Workflow",
            body: [
              "What should this Workflow be called?",
              "",
              "For example: Fast Fashion Production.",
            ].join("\n"),
          },
        ];
      }
      if (choice === 3) {
        clearCommandMenu();
        const saved = listWorkflows();
        return [
          {
            actor: "Arturo",
            label: "Workflows",
            body: saved.length
              ? [
                  "Saved Workflows",
                  "",
                  ...saved.map(
                    (workflow, index) =>
                      `  ${index + 1}. ${workflow.name} (${workflow.steps.length} steps)`
                  ),
                  "",
                  "Run one with /run.",
                ].join("\n")
              : "No Workflows saved yet.",
          },
        ];
      }
      return [
        { actor: "Arturo", label: "Workflows", body: "Please reply 1, 2, or 3 — or ESC to go back." },
      ];
    }

    if (state.stage === "describe") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Describe the Workflow", body: "Please describe what it should achieve, or ESC to go back." },
        ];
      }
      clearCommandMenu();
      try {
        return createGeneratedWorkflowEntries(
          await createGeneratedWorkflow([trimmed])
        );
      } catch (error) {
        return [createWorkflowFailedEntry(error)];
      }
    }

    if (state.stage === "build-name") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Name the Workflow", body: "Please type a name, or ESC to go back." },
        ];
      }
      commandMenu = {
        kind: "workflow",
        stage: "build-objective",
        name: stripSurroundingQuotes(trimmed),
      };
      return [askWorkflowObjective()];
    }

    if (state.stage === "build-objective") {
      const workers = listWorkers()
        .filter((worker) => !worker.system)
        .map((worker) => worker.displayName ?? worker.name);
      commandMenu = {
        kind: "workflow",
        stage: "build-step-worker",
        name: state.name,
        objective: trimmed.toLowerCase() === "skip" ? "" : trimmed,
        steps: [],
        workers,
      };
      return [askWorkflowStepWorker(workers, [])];
    }

    if (state.stage === "build-step-worker") {
      const choice = menuNumber(trimmed);
      const done = state.steps.length > 0 && choice === state.workers.length + 1;
      if (done) {
        const { name, objective, steps } = state;
        clearCommandMenu();
        return await createWorkflowFromAnswers(name, objective, steps);
      }
      if (!choice || choice < 1 || choice > state.workers.length) {
        return [askWorkflowStepWorker(state.workers, state.steps)];
      }
      const worker = state.workers[choice - 1];
      commandMenu = {
        kind: "workflow",
        stage: "build-step-instruction",
        name: state.name,
        objective: state.objective,
        steps: state.steps,
        workers: state.workers,
        worker,
      };
      return [
        {
          actor: "Arturo",
          label: "What does that step do?",
          body: [
            `What should ${worker} do at this step?`,
            "",
            "Each step is given the previous step's result as context.",
          ].join("\n"),
        },
      ];
    }

    // build-step-instruction
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "What does that step do?", body: "Please describe the step, or ESC to go back." },
      ];
    }
    const steps = [...state.steps, { worker: state.worker, instruction: trimmed }];
    commandMenu = {
      kind: "workflow",
      stage: "build-step-worker",
      name: state.name,
      objective: state.objective,
      steps,
      workers: state.workers,
    };
    return [askWorkflowStepWorker(state.workers, steps)];
  }

  // --- Run menu ---
  if (state.kind === "run") {
    if (state.stage === "pick") {
      const choice = menuPick(trimmed, state.names);
      if (!choice) {
        return [
          { actor: "Arturo", label: "Which Workflow should run?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      return askAfterRunWorkflowPicked(state.names[choice - 1]);
    }

    if (state.stage === "missing-workers") {
      const choice = menuNumber(trimmed);
      if (choice === 2) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "Nothing started",
            body: [
              "No Workflow was started and no Worker was created.",
              "Run /staff, or /add-ai-worker, to add the roles yourself, then /run again.",
            ].join("\n"),
          },
        ];
      }
      if (choice !== 1) {
        return [askRunMissingWorkers(state.name, state.archetypes)];
      }
      return askRunStartFile(state.name, true);
    }

    if (state.stage === "start-file") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        return askRunContext(state.name, state.autoWorkers, undefined);
      }
      if (!choice || choice < 2 || choice > state.references.length + 1) {
        return [askRunStartFileEntry(state.references)];
      }
      return askRunContext(
        state.name,
        state.autoWorkers,
        state.references[choice - 2]
      );
    }

    // run context
    const context = trimmed.toLowerCase() === "skip" ? "" : trimmed;
    const { name, autoWorkers, inputArtefact } = state;
    clearCommandMenu();
    try {
      return createPlannedWorkflowRunEntries(
        runPlannedWorkflowFromArgs([
          ...(autoWorkers ? ["--auto-workers"] : []),
          name,
          ...(context ? [context] : []),
          ...(inputArtefact ? ["--input-artefact", inputArtefact] : []),
        ])
      );
    } catch (error) {
      return [createPlannedWorkflowRunFailedEntry(error)];
    }
  }

  // --- Start-every-ready-Function confirmation ---
  if (state.kind === "startfunctions") {
    if (state.stage === "enterprise") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.names.length + 1) {
        return [
          { actor: "Arturo", label: "Which business?", body: `Please reply with a number from 1 to ${state.names.length + 1}.` },
        ];
      }
      const enterpriseName =
        choice <= state.names.length ? state.names[choice - 1] : undefined;
      commandMenu = { kind: "startfunctions", stage: "confirm", enterpriseName };
      return [askStartFunctionsConfirmation(enterpriseName)];
    }

    // confirm
    const choice = menuNumber(trimmed);
    if (choice === 2) {
      clearCommandMenu();
      return [
        { actor: "Arturo", label: "Nothing started", body: "No Function was started." },
      ];
    }
    if (choice !== 1) {
      return [askStartFunctionsConfirmation(state.enterpriseName)];
    }
    const { enterpriseName } = state;
    clearCommandMenu();
    return handleUiStartReadyFunctionsCommand([
      "--ready",
      ...(enterpriseName ? ["--enterprise", enterpriseName] : []),
    ]);
  }

  // --- Memory menu ---
  if (state.kind === "memory") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        commandMenu = { kind: "memory", stage: "add-text" };
        return [
          {
            actor: "Arturo",
            label: "Write something down",
            body: [
              "What should Arturo remember?",
              "",
              "For example: Our house style is short sentences and no jargon.",
            ].join("\n"),
          },
        ];
      }
      if (choice === 2) {
        clearCommandMenu();
        return [readOperationalMemoryEntry()];
      }
      if (choice === 3) {
        const entries = listAllOperationalMemory();
        if (entries.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "Nothing written down yet",
              body: "There are no notes to remove. Run /memory and choose 1 to write one.",
            },
          ];
        }
        commandMenu = {
          kind: "memory",
          stage: "remove-pick",
          ids: entries.map((entry) => entry.id),
        };
        return pickList(
          "Which note should go?",
          entries.map((entry) => entry.content)
        );
      }
      return [
        { actor: "Arturo", label: "What Arturo remembers", body: "Please reply 1, 2, or 3 — or ESC to go back." },
      ];
    }

    if (state.stage === "add-text") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Write something down", body: "Please type the note, or ESC to go back." },
        ];
      }
      const scopes = memoryScopeChoices();
      const content = stripSurroundingQuotes(trimmed);
      if (scopes.length === 1) {
        clearCommandMenu();
        return [handleUiMemoryCommand(["add", content, "--scope", scopes[0].reference])];
      }
      commandMenu = { kind: "memory", stage: "add-scope", content, scopes };
      return [
        {
          actor: "Arturo",
          label: "Where does it apply?",
          body: [
            "Which work should this note be used for?",
            "",
            ...scopes.map((scope, index) => `  ${index + 1}. ${scope.label}`),
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }

    if (state.stage === "add-scope") {
      const choice = menuPick(
        trimmed,
        state.scopes.map((scope) => scope.label)
      );
      if (!choice) {
        return [
          { actor: "Arturo", label: "Where does it apply?", body: `Please reply with a number from 1 to ${state.scopes.length}, or the name on the row.` },
        ];
      }
      const { content } = state;
      const scope = state.scopes[choice - 1].reference;
      clearCommandMenu();
      return [handleUiMemoryCommand(["add", content, "--scope", scope])];
    }

    // memory remove-pick
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.ids.length) {
      return [
        { actor: "Arturo", label: "Which note should go?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
      ];
    }
    const id = state.ids[choice - 1];
    clearCommandMenu();
    return [handleUiMemoryCommand(["remove", id])];
  }

  // --- Delegation menu ---
  if (state.kind === "delegation") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        const functions = eventFunctionChoices();
        if (functions.length < 2) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "Not enough Functions",
              body: [
                "Handing work over needs two Functions: one asking, one doing.",
                "Run /function and choose 1 to add another.",
              ].join("\n"),
            },
          ];
        }
        commandMenu = { kind: "delegation", stage: "request-from", functions };
        return pickList(
          "Which Function needs the help?",
          functions.map(eventFunctionLabel)
        );
      }
      if (choice === 2) {
        clearCommandMenu();
        return [handleUiDelegationCommand(["list"])];
      }
      if (choice === 3) {
        const requests = listDelegationRequests();
        if (requests.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No handovers yet",
              body: "Nothing has been handed between Functions. Run /delegation and choose 1 to do that.",
            },
          ];
        }
        commandMenu = {
          kind: "delegation",
          stage: "inspect-pick",
          ids: requests.map((request) => request.id),
        };
        return pickList(
          "Which handover?",
          requests.map((request) => request.work)
        );
      }
      return [
        { actor: "Arturo", label: "Handing work between Functions", body: "Please reply 1, 2, or 3 — or ESC to go back." },
      ];
    }

    if (state.stage === "request-from") {
      const choice = menuPick(
        trimmed,
        state.functions.map((candidate) => candidate.label)
      );
      if (!choice) {
        return [
          { actor: "Arturo", label: "Which Function needs the help?", body: `Please reply with a number from 1 to ${state.functions.length}.` },
        ];
      }
      const from = state.functions[choice - 1];
      // A Function cannot delegate to itself, and cross-Enterprise delegation is
      // not supported, so only offer what the runtime would actually accept.
      const sameBusiness = state.functions.filter(
        (candidate) =>
          candidate.label !== from.label &&
          candidate.enterpriseName === from.enterpriseName
      );
      if (sameBusiness.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "No other Function in this business",
            body: `${from.label} has no other Function in ${from.enterpriseName} to hand work to. Work is only handed within one business.`,
          },
        ];
      }
      // Only a started Function can take handed-over work, so don't offer one
      // that would be refused after the work is described.
      const receivers = sameBusiness.filter((candidate) => candidate.running);
      if (receivers.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "Nothing is running to take it",
            body: [
              `Work can only be handed to a Function that is running, and none of the others in ${from.enterpriseName} are.`,
              `Run /function start "${sameBusiness[0].label}" first, then /delegation again.`,
            ].join("\n"),
          },
        ];
      }
      commandMenu = {
        kind: "delegation",
        stage: "request-to",
        from,
        functions: receivers,
        work: state.work,
      };
      return pickList(
        `Which Function should do the work for ${from.label}?`,
        receivers.map(eventFunctionLabel)
      );
    }

    if (state.stage === "request-to") {
      const choice = menuPick(
        trimmed,
        state.functions.map((candidate) => candidate.label)
      );
      if (!choice) {
        return [
          { actor: "Arturo", label: "Which Function should do the work?", body: `Please reply with a number from 1 to ${state.functions.length}.` },
        ];
      }
      const receiver = state.functions[choice - 1];
      // The work was given up front (/delegation request "<work>"), so there is
      // nothing left to ask.
      if (state.work) {
        const { from, work } = state;
        clearCommandMenu();
        return [
          handleUiDelegationCommand([
            "request",
            work,
            "--from",
            from.label,
            "--to",
            receiver.label,
            "--enterprise",
            from.enterpriseName,
          ]),
        ];
      }
      commandMenu = {
        kind: "delegation",
        stage: "request-work",
        from: state.from,
        to: receiver,
      };
      return [
        {
          actor: "Arturo",
          label: "What is being handed over?",
          body: [
            `In one sentence, what should ${receiver.label} do for ${state.from.label}?`,
            "",
            "Keep it to one bounded piece of work with a clear stopping point.",
          ].join("\n"),
        },
      ];
    }

    if (state.stage === "request-work") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "What is being handed over?", body: "Please describe the work, or ESC to go back." },
        ];
      }
      const { from, to } = state;
      clearCommandMenu();
      return [
        handleUiDelegationCommand([
          "request",
          stripSurroundingQuotes(trimmed),
          "--from",
          from.label,
          "--to",
          to.label,
          "--enterprise",
          from.enterpriseName,
        ]),
      ];
    }

    // delegation inspect-pick
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.ids.length) {
      return [
        { actor: "Arturo", label: "Which handover?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
      ];
    }
    const id = state.ids[choice - 1];
    clearCommandMenu();
    return [handleUiDelegationCommand(["inspect", id])];
  }

  // --- Event menu ---
  if (state.kind === "event") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1 || choice === 2) {
        const functions = eventFunctionChoices();
        if (functions.length === 0) {
          return noEventFunctionsEntry();
        }
        if (choice === 1) {
          commandMenu = { kind: "event", stage: "publish-name", functions };
          return [
            {
              actor: "Arturo",
              label: "What happened?",
              body: [
                // "What should the announcement be called?" read as a request
                // for a title, and the examples for a slug. What Arturo wants
                // is the thing that happened, in the operator's own words.
                "Describe the event.",
                "",
                "For example: evidence is ready, or a design was submitted.",
              ].join("\n"),
            },
          ];
        }
        if (functions.length === 1) {
          commandMenu = { kind: "event", stage: "rule-publish", source: functions[0] };
          return [askEventRulePublishLabel(functions[0])];
        }
        commandMenu = { kind: "event", stage: "rule-function", functions };
        return pickList(
          "Whose finished work should trigger it?",
          functions.map(eventFunctionLabel)
        );
      }
      if (choice === 3) {
        clearCommandMenu();
        return [handleUiEventRuleCommand(["list"])];
      }
      if (choice === 4) {
        const rules = listJobCompletionEventRules();
        if (rules.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No automatic announcements",
              body: "There are none set up. Run /event and choose 2 to add one.",
            },
          ];
        }
        commandMenu = {
          kind: "event",
          stage: "rule-remove-pick",
          ids: rules.map((rule) => rule.id),
        };
        return pickList(
          "Which one should stop?",
          rules.map(
            (rule) =>
              `${rule.publishedEventLabel} — when ${
                getBusinessFunctionDefinition(rule.sourceBusinessFunctionId)?.label
                  ?? rule.sourceBusinessFunctionId
              } finishes work`
          )
        );
      }
      return [
        { actor: "Arturo", label: "Signals", body: "Please reply 1, 2, 3, or 4 — or ESC to go back." },
      ];
    }

    if (state.stage === "publish-name") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "What happened?", body: "Please describe what happened, or ESC to go back." },
        ];
      }
      const label = stripSurroundingQuotes(trimmed);
      if (state.functions.length === 1) {
        clearCommandMenu();
        return [await publishEventFromAnswers(label, state.functions[0])];
      }
      commandMenu = { kind: "event", stage: "publish-function", label, functions: state.functions };
      return pickList(
        "Which Function is this about?",
        state.functions.map(eventFunctionLabel)
      );
    }

    if (state.stage === "publish-function") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.functions.length) {
        return [
          { actor: "Arturo", label: "Which Function is this about?", body: `Please reply with a number from 1 to ${state.functions.length}.` },
        ];
      }
      const source = state.functions[choice - 1];
      const { label } = state;
      clearCommandMenu();
      return [await publishEventFromAnswers(label, source)];
    }

    if (state.stage === "rule-function") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.functions.length) {
        return [
          { actor: "Arturo", label: "Whose finished work should trigger it?", body: `Please reply with a number from 1 to ${state.functions.length}.` },
        ];
      }
      const source = state.functions[choice - 1];
      commandMenu = { kind: "event", stage: "rule-publish", source };
      return [askEventRulePublishLabel(source)];
    }

    if (state.stage === "rule-publish") {
      if (!trimmed) {
        return [askEventRulePublishLabel(state.source)];
      }
      commandMenu = {
        kind: "event",
        stage: "rule-capability",
        source: state.source,
        publishLabel: stripSurroundingQuotes(trimmed),
      };
      return [askEventRuleCapability()];
    }

    // rule-capability
    if (state.stage === "rule-capability") {
      const choices = governanceCapabilityChoices();
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > choices.length + 1) {
        return [askEventRuleCapability()];
      }
      const capability = choice === 1 ? undefined : choices[choice - 2];
      const { source, publishLabel } = state;
      clearCommandMenu();
      return [
        handleUiEventRuleCommand([
          "add",
          "--when",
          "task.completed",
          "--function",
          source.label,
          "--publish",
          publishLabel,
          ...(capability ? ["--capability", capability] : []),
          "--enterprise",
          source.enterpriseName,
        ]),
      ];
    }

    // rule-remove-pick
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.ids.length) {
      return [
        { actor: "Arturo", label: "Which one should stop?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
      ];
    }
    const id = state.ids[choice - 1];
    clearCommandMenu();
    return [handleUiEventRuleCommand(["remove", id])];
  }

  // --- Governance menu ---
  if (state.kind === "governance") {
    if (state.stage === "choose") {
      const choice = menuNumber(trimmed);
      if (choice === 1) {
        commandMenu = { kind: "governance", stage: "add-description" };
        return [
          {
            actor: "Arturo",
            label: "Add a rule",
            body: [
              "In one sentence, what is this rule for?",
              "",
              "For example: Anything that sends email needs my approval first.",
            ].join("\n"),
          },
        ];
      }
      if (choice === 2) {
        clearCommandMenu();
        return [handleUiGovernanceCommand(["policy", "list"])];
      }
      if (choice === 3) {
        const rules = loadPolicyRules();
        if (rules.length === 0) {
          clearCommandMenu();
          return [
            {
              actor: "Arturo",
              label: "No rules yet",
              body: "There are no Governance rules to remove. Run /governance and choose 1 to add one.",
            },
          ];
        }
        commandMenu = {
          kind: "governance",
          stage: "remove-pick",
          references: rules.map((rule) => rule.id),
        };
        return pickList(
          "Which rule should go?",
          rules.map((rule) => `${rule.description} — ${rule.effect}`)
        );
      }
      return [
        { actor: "Arturo", label: "Governance", body: "Please reply 1, 2, or 3 — or ESC to go back." },
      ];
    }

    if (state.stage === "add-description") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Add a rule", body: "Please describe the rule in one sentence, or ESC to go back." },
        ];
      }
      commandMenu = {
        kind: "governance",
        stage: "add-effect",
        description: stripSurroundingQuotes(trimmed),
      };
      return [askGovernanceEffect()];
    }

    if (state.stage === "add-effect") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > GOVERNANCE_EFFECTS.length) {
        return [
          { actor: "Arturo", label: "What should happen?", body: `Please reply with a number from 1 to ${GOVERNANCE_EFFECTS.length}.` },
        ];
      }
      commandMenu = {
        kind: "governance",
        stage: "add-capability",
        description: state.description,
        effect: GOVERNANCE_EFFECTS[choice - 1].effect,
      };
      return [askGovernanceCapability()];
    }

    if (state.stage === "add-capability") {
      const choices = governanceCapabilityChoices();
      const choice = menuPick(trimmed, choices);
      if (!choice) {
        return [askGovernanceCapability()];
      }
      commandMenu = {
        kind: "governance",
        stage: "add-risk",
        description: state.description,
        effect: state.effect,
        capability: choices[choice - 1],
      };
      return [
        {
          actor: "Arturo",
          label: "Only at a certain risk level?",
          body: [
            "Should the rule apply to every task of that kind, or only at one risk level?",
            "",
            "  1. Every task of that kind",
            "  2. Only low-risk tasks",
            "  3. Only medium-risk tasks",
            "  4. Only high-risk tasks",
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }

    if (state.stage === "add-risk") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > GOVERNANCE_RISKS.length) {
        return [
          { actor: "Arturo", label: "Only at a certain risk level?", body: `Please reply with a number from 1 to ${GOVERNANCE_RISKS.length}.` },
        ];
      }
      const risk = GOVERNANCE_RISKS[choice - 1];
      const names = listEnterprises().map((enterprise) => enterprise.name);
      if (names.length <= 1) {
        const { description, effect, capability } = state;
        clearCommandMenu();
        return createGovernancePolicyFromAnswers(
          description,
          effect,
          capability,
          risk,
          names[0]
        );
      }
      commandMenu = {
        kind: "governance",
        stage: "add-scope",
        description: state.description,
        effect: state.effect,
        capability: state.capability,
        risk,
        names,
      };
      return [
        {
          actor: "Arturo",
          label: "Which business?",
          body: [
            "Which business does this rule cover?",
            "",
            ...names.map((name, index) => `  ${index + 1}. ${name}`),
            `  ${names.length + 1}. Every business on this computer`,
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }

    if (state.stage === "add-scope") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.names.length + 1) {
        return [
          { actor: "Arturo", label: "Which business?", body: `Please reply with a number from 1 to ${state.names.length + 1}.` },
        ];
      }
      const { description, effect, capability, risk } = state;
      const enterpriseName =
        choice <= state.names.length ? state.names[choice - 1] : undefined;
      clearCommandMenu();
      return createGovernancePolicyFromAnswers(
        description,
        effect,
        capability,
        risk,
        enterpriseName
      );
    }

    // remove-pick
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.references.length) {
      return [
        { actor: "Arturo", label: "Which rule should go?", body: `Please reply with a number from 1 to ${state.references.length}.` },
      ];
    }
    const reference = state.references[choice - 1];
    clearCommandMenu();
    return [handleUiGovernanceCommand(["policy", "remove", reference])];
  }

  // --- Decisions (/approve, /reject) ---
  if (state.kind === "decision") {
    if (state.stage === "pick") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.ids.length) {
        return [
          { actor: "Arturo", label: "Which one?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
        ];
      }
      return continueDecisionMenu(state.action, state.ids[choice - 1]);
    }

    if (state.stage === "who") {
      const choice = menuPick(trimmed, state.names);
      if (!choice) {
        return [
          { actor: "Arturo", label: "Who is deciding?", body: `Please reply with a number from 1 to ${state.names.length}.` },
        ];
      }
      return finishDecisionMenu(state.action, state.id, state.names[choice - 1]);
    }

    // reason
    if (!trimmed) {
      return [
        {
          actor: "Arturo",
          label: "Why are you turning it down?",
          body: "A reason is required — it is kept with the decision. Type it, or ESC to go back.",
        },
      ];
    }
    const { id, as } = state;
    clearCommandMenu();
    return [
      captureUiCommandOutput("Rejection", () =>
        handleRejectCommand([id, trimmed, ...(as ? ["--as", as] : [])])
      ),
    ];
  }

  // --- Human Task flows (/create-human-task, /complete-human-task, /block-task, /revise-task) ---
  if (state.kind === "humantask") {
    // Two questions, not four. "Why does a person need to do it?" left a
    // Purpose reading "none" wherever the record was shown, and the separate
    // name asked the operator to say the same thing twice: /task takes a
    // description and nothing else, and a Human Task is the same kind of
    // request made of a person. --purpose still sets a purpose for the cases
    // where it is worth recording, and the flag form still takes a title.
    if (state.stage === "create-instructions") {
      if (!trimmed) {
        return [
          { actor: "Arturo", label: "Description:", body: "Please type what they should do, or ESC to go back." },
        ];
      }
      const instructions = stripSurroundingQuotes(trimmed);
      return askHumanTaskFollows(deriveHumanTaskTitle(instructions), instructions);
    }

    if (state.stage === "create-follows") {
      const index = menuNumber(trimmed);
      if (!index || index < 1 || index > state.ids.length + 1) {
        return [
          {
            actor: "Arturo",
            label: "Is there finished work they should act on?",
            body: `Please reply with a number from 1 to ${state.ids.length + 1}.`,
          },
        ];
      }
      const follows = index === 1 ? undefined : state.ids[index - 2];
      return askHumanTaskOwner(state.title, state.instructions, "", follows);
    }

    if (state.stage === "create-owner") {
      // The trailing "leave it unassigned" row has no name, so it is offered to
      // menuPick as one — a number still selects it, and nobody types it.
      const choice = menuPick(trimmed, [
        ...state.owners,
        "Leave it unassigned for now",
      ]);
      if (!choice) {
        return [
          { actor: "Arturo", label: "Worker:", body: `Please reply with a number from 1 to ${state.owners.length + 1}, or the person's name.` },
        ];
      }
      const owner = choice <= state.owners.length ? state.owners[choice - 1] : undefined;
      const { title, instructions, purpose, follows } = state;
      return askHumanTaskInputArtefact(title, instructions, purpose, follows, owner);
    }

    if (state.stage === "create-artefact") {
      const choice = menuNumber(trimmed);
      const { title, instructions, purpose, follows, owner } = state;
      const named = menuReferenceChoice(trimmed, state.references);
      if (!named && choice === 1) {
        clearCommandMenu();
        return createHumanTaskFromAnswers(title, instructions, purpose, follows, owner, undefined);
      }
      if (!named && (!choice || choice < 2 || choice > state.references.length + 1)) {
        return [askHumanTaskInputArtefactEntry(state.references)];
      }
      const reference = named ?? state.references[(choice as number) - 2];
      clearCommandMenu();
      return createHumanTaskFromAnswers(title, instructions, purpose, follows, owner, reference);
    }

    if (state.stage === "act-pick") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.ids.length) {
        return [
          { actor: "Arturo", label: "Which task?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
        ];
      }
      const id = state.ids[choice - 1];
      commandMenu = { kind: "humantask", stage: "act-text", action: state.action, id };
      return [askHumanTaskActionText(state.action, getHumanTask(id)?.title ?? id)];
    }

    if (state.stage === "act-text") {
      if (!trimmed) {
        return [askHumanTaskActionText(state.action, getHumanTask(state.id)?.title ?? state.id)];
      }
      if (state.action === "block") {
        const { id } = state;
        clearCommandMenu();
        return [captureUiCommandOutput("Human task blocked", () => handleBlockTaskCommand([id, trimmed]))];
      }
      if (state.action === "revise") {
        const { id } = state;
        clearCommandMenu();
        return [
          captureUiCommandOutput("Human task revision requested", () =>
            handleReviseTaskCommand([id, trimmed])
          ),
        ];
      }

      // Completing records who did it, so the attribution is not guessed. An
      // assigned task can only be completed by its owner, so don't offer a
      // choice that the command would then refuse.
      const assignedOwner = getHumanTask(state.id)?.owner;
      const owners = assignedOwner
        ? [assignedOwner]
        : availableHumanWorkerNames();
      if (owners.length <= 1) {
        return askHumanTaskOutputArtefact(state.id, trimmed, owners[0]);
      }
      commandMenu = { kind: "humantask", stage: "act-as", id: state.id, notes: trimmed, owners };
      return pickList("Who did it?", owners);
    }

    if (state.stage === "act-as") {
      const choice = menuNumber(trimmed);
      if (!choice || choice < 1 || choice > state.owners.length) {
        return [
          { actor: "Arturo", label: "Who did it?", body: `Please reply with a number from 1 to ${state.owners.length}.` },
        ];
      }
      return askHumanTaskOutputArtefact(
        state.id,
        state.notes,
        state.owners[choice - 1]
      );
    }

    if (state.stage === "act-artefact") {
    const choice = menuNumber(trimmed);
    const named = menuReferenceChoice(trimmed, state.references);
    if (!named && choice === 1) {
      const { id, notes, as } = state;
      clearCommandMenu();
      return [
        captureUiCommandOutput("Human task completed", () =>
          handleCompleteTaskCommand([id, notes, ...(as ? ["--as", as] : [])])
        ),
      ];
    }
    if (!named && (!choice || choice < 2 || choice > state.references.length + 1)) {
      return [askHumanTaskOutputArtefactEntry(state.references)];
    }
    const { id, notes, as } = state;
    const produced = named ?? state.references[(choice as number) - 2];
    clearCommandMenu();
    return [
      captureUiCommandOutput("Human task completed", () =>
        handleCompleteTaskCommand([
          id,
          notes,
          ...(as ? ["--as", as] : []),
          "--artefact",
          produced,
        ])
      ),
    ];
    }

    return [
      { actor: "Arturo", label: "Cancelled", body: "Nothing was changed." },
    ];
  }

  // --- Artefact menu: attach, submit for review, record a decision ---
  if (state.stage === "choose") {
    const choice = menuNumber(trimmed);
    if (choice === 1) {
      return startArtefactAdd();
    }
    if (choice === 8) {
      commandMenu = { kind: "artefact", stage: "watch-folder" };
      return [
        {
          actor: "Arturo",
          label: "Which folder?",
          body: [
            "Which folder should Arturo watch? Type its path, for example: ~/trend-drops",
            "",
            "Keep it for this purpose only. Anything that lands there is taken in, and Arturo reads it without anyone looking first.",
          ].join("\n"),
        },
      ];
    }
    if (choice === 2) {
      const ids = listArtefacts().map((artefact) => artefact.id);
      if (ids.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "Nothing to version",
            body: "No file has been attached yet. Run /artefact and choose 1 to attach one.",
          },
        ];
      }
      commandMenu = { kind: "artefact", stage: "version-pick", ids };
      return pickList(
        "Which file has a new version?",
        ids.map((id) => {
          const artefact = getArtefact(id);
          return artefact
            ? `${artefact.name} (${artefact.kind}) — currently at version ${artefact.versions.length}`
            : id;
        })
      );
    }
    if (choice === 3) {
      const references = artefactVersionReferences("draft");
      if (references.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "Nothing to send for review",
            body: "Every file version is either already out for review or decided. Run /artefact and choose 1 to attach one.",
          },
        ];
      }
      const reviewers = artefactReviewerNames();
      if (reviewers.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "No one to review it",
            body: [
              "A review is assigned to a registered person, and no one is registered as available.",
              "Run /add-human-worker to add the reviewer, then /artefact again.",
            ].join("\n"),
          },
        ];
      }
      commandMenu = { kind: "artefact", stage: "submit-pick", references };
      return pickList(
        "Which file version?",
        references.map(artefactReferenceLabel)
      );
    }
    if (choice === 4) {
      const references = artefactVersionReferences("awaiting_review");
      if (references.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "Nothing waiting on a review",
            body: "No file version is out for review. Run /artefact and choose 2 to send one.",
          },
        ];
      }
      const reviewers = artefactReviewerNames();
      if (reviewers.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "No one to record it against",
            body: [
              "A review decision is attributed to a registered person, and no one is registered as available.",
              "Run /add-human-worker first, then /artefact again.",
            ].join("\n"),
          },
        ];
      }
      commandMenu = { kind: "artefact", stage: "review-pick", references, reviewers };
      return pickList(
        "Which file version was reviewed?",
        references.map(artefactReferenceLabel)
      );
    }
    if (choice === 5) {
      clearCommandMenu();
      return [captureUiCommandOutput("Artefacts", () => handleArtefactsCommand([]))];
    }
    if (choice === 6 || choice === 7) {
      // inspect and verify had no guided path at all: an operator could only
      // reach them by typing an id, and verify needs the exact id@version.
      const artefacts = listArtefacts();
      if (artefacts.length === 0) {
        clearCommandMenu();
        return [
          {
            actor: "Arturo",
            label: "No files yet",
            body: "Nothing has been attached. Run /artefact and choose 1 to attach one.",
          },
        ];
      }
      if (choice === 6) {
        const ids = artefacts.map((artefact) => artefact.id);
        if (ids.length === 1) {
          clearCommandMenu();
          return [captureUiCommandOutput("Artefact", () => handleArtefactCommand(["inspect", ids[0]]))];
        }
        commandMenu = { kind: "artefact", stage: "inspect-pick", ids };
        return pickList(
          "Which file?",
          artefacts.map(
            (artefact) =>
              `${artefact.name} (${artefact.kind}) — ${artefact.id}, ${artefact.versions.length} version(s)`
          )
        );
      }
      const references = artefactVersionReferences();
      if (references.length === 1) {
        clearCommandMenu();
        return [
          captureUiCommandOutput("Artefact", () => handleArtefactCommand(["verify", references[0]])),
        ];
      }
      commandMenu = { kind: "artefact", stage: "verify-pick", references };
      return pickList("Which version should Arturo re-check?", references);
    }
    return [
      { actor: "Arturo", label: "Files", body: "Please reply with a number from 1 to 7 — or ESC to go back." },
    ];
  }

  if (state.stage === "version-pick") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.ids.length) {
      return [
        { actor: "Arturo", label: "Which file has a new version?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
      ];
    }
    commandMenu = {
      kind: "artefact",
      stage: "version-where",
      artefactId: state.ids[choice - 1],
    };
    return [
      {
        actor: "Arturo",
        label: "Where is the new version?",
        body: [
          "Where is the new version? Type either:",
          "  · a path to it on this computer (for example: ./contract-v2.pdf), or",
          "  · a https:// web address.",
          "",
          // A changed file is a new version precisely so it cannot inherit the
          // earlier version's approval; say so while it is being recorded.
          "It starts unreviewed — a new version never inherits the previous one's approval.",
        ].join("\n"),
      },
    ];
  }

  // --- Watch a folder, a question at a time ---
  // The one-line form has five switches and was called "a mouthful".
  if (state.stage === "watch-folder") {
    if (!trimmed) {
      return [{ actor: "Arturo", label: "Which folder?", body: "Please type the folder's path, or ESC to go back." }];
    }
    const functions = listBusinessFunctionDefinitions().flatMap((definition) => {
      const enterprise = getEnterprise(definition.enterpriseId);
      return enterprise ? [{ label: definition.label, enterprise: enterprise.name }] : [];
    });
    if (functions.length === 0) {
      clearCommandMenu();
      return [{ actor: "Arturo", label: "No Functions yet", body: "Files have to go to a Function. Create one with /function first." }];
    }
    commandMenu = { kind: "artefact", stage: "watch-function", folder: trimmed, functions };
    return pickList(
      "Which Function should each file go to?",
      functions.map((choice) => `${choice.label} — ${choice.enterprise}`)
    );
  }

  if (state.stage === "watch-function") {
    const choice = menuPick(trimmed, state.functions.map((option) => option.label));
    if (!choice) {
      return [{ actor: "Arturo", label: "Which Function?", body: `Please reply with a number from 1 to ${state.functions.length}.` }];
    }
    const picked = state.functions[choice - 1];
    commandMenu = { kind: "artefact", stage: "watch-task", folder: state.folder, functionLabel: picked.label, enterprise: picked.enterprise };
    return [
      {
        actor: "Arturo",
        label: "What should be done with each file?",
        body: [
          `What should ${picked.label} do with each file? Write it as you would a Task, for example:`,
          "  Write the content of one garment design brief from the supplied document. Use only the supplied document.",
          "",
          "Every file gets this same instruction.",
        ].join("\n"),
      },
    ];
  }

  if (state.stage === "watch-task") {
    if (!trimmed) {
      return [{ actor: "Arturo", label: "What should be done with each file?", body: "Please type the instruction, or ESC to go back." }];
    }
    const people = listWorkers()
      .filter((worker) => worker.kind === "human" && !worker.system)
      .map((worker) => worker.displayName ?? worker.name);
    if (people.length === 0) {
      clearCommandMenu();
      return [{ actor: "Arturo", label: "No one to set it up", body: "The person who sets up a watch is recorded as having supplied every file it takes in. Add yourself with /add-human-worker, then try again." }];
    }
    const next = { folder: state.folder, functionLabel: state.functionLabel, enterprise: state.enterprise, instruction: trimmed };
    if (people.length === 1) {
      commandMenu = { kind: "artefact", stage: "watch-each", ...next, person: people[0] };
      return [askWatchEach(people[0])];
    }
    commandMenu = { kind: "artefact", stage: "watch-person", ...next, people };
    return pickList("Who is setting this up?", people);
  }

  if (state.stage === "watch-person") {
    const choice = menuPick(trimmed, state.people);
    if (!choice) {
      return [{ actor: "Arturo", label: "Who is setting this up?", body: `Please reply with a number from 1 to ${state.people.length}.` }];
    }
    const { folder, functionLabel, enterprise, instruction } = state;
    commandMenu = { kind: "artefact", stage: "watch-each", folder, functionLabel, enterprise, instruction, person: state.people[choice - 1] };
    return [askWatchEach(state.people[choice - 1])];
  }

  if (state.stage === "watch-each") {
    const { folder, functionLabel, enterprise, instruction, person } = state;
    if (!trimmed) {
      clearCommandMenu();
      return [runWatchAdd(folder, functionLabel, enterprise, instruction, person)];
    }
    commandMenu = { kind: "artefact", stage: "watch-first", folder, functionLabel, enterprise, instruction, person, list: trimmed };
    return [
      {
        actor: "Arturo",
        label: "How many entries?",
        body: `How many entries of "${trimmed}" should each get a Task, from the top? Reply 1 to 5, or press Enter for 3.`,
      },
    ];
  }

  if (state.stage === "watch-first") {
    const first = trimmed ? menuNumber(trimmed) : 3;
    if (!first || first < 1 || first > 5) {
      return [{ actor: "Arturo", label: "How many entries?", body: "Please reply with a number from 1 to 5, or press Enter for 3." }];
    }
    const { folder, functionLabel, enterprise, instruction, person, list } = state;
    clearCommandMenu();
    return [runWatchAdd(folder, functionLabel, enterprise, instruction, person, list, first)];
  }

  if (state.stage === "version-where") {
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "Where is the new version?", body: "Please type a file path or a https:// address, or ESC to go back." },
      ];
    }
    const workers = listWorkers()
      .filter((worker) => !worker.system)
      .map((worker) => worker.displayName ?? worker.name);
    if (workers.length === 0) {
      clearCommandMenu();
      return [
        {
          actor: "Arturo",
          label: "No Workers yet",
          body: "A version must be attributed to whoever produced it. Run /staff or /add-human-worker first.",
        },
      ];
    }
    if (workers.length === 1) {
      return askArtefactVersionNote(state.artefactId, trimmed, workers[0]);
    }
    commandMenu = {
      kind: "artefact",
      stage: "version-worker",
      artefactId: state.artefactId,
      where: trimmed,
      workers,
    };
    return pickList("Who produced this version?", workers);
  }

  if (state.stage === "version-worker") {
    const choice = menuPick(trimmed, state.workers);
    if (!choice) {
      return [
        { actor: "Arturo", label: "Who produced this version?", body: `Please reply with a number from 1 to ${state.workers.length}.` },
      ];
    }
    const { artefactId, where } = state;
    const createdBy = state.workers[choice - 1];
    return askArtefactVersionNote(artefactId, where, createdBy);
  }

  if (state.stage === "submit-pick") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.references.length) {
      return [
        { actor: "Arturo", label: "Which file version?", body: `Please reply with a number from 1 to ${state.references.length}.` },
      ];
    }
    const reference = state.references[choice - 1];
    const reviewers = artefactReviewerNames();
    if (reviewers.length === 1) {
      return askArtefactSubmitNote(reference, reviewers[0]);
    }
    commandMenu = { kind: "artefact", stage: "submit-reviewer", reference, reviewers };
    return pickList("Who should review it?", reviewers);
  }

  if (state.stage === "submit-reviewer") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.reviewers.length) {
      return [
        { actor: "Arturo", label: "Who should review it?", body: `Please reply with a number from 1 to ${state.reviewers.length}.` },
      ];
    }
    return askArtefactSubmitNote(state.reference, state.reviewers[choice - 1]);
  }

  if (state.stage === "review-pick") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.references.length) {
      return [
        { actor: "Arturo", label: "Which file version was reviewed?", body: `Please reply with a number from 1 to ${state.references.length}.` },
      ];
    }
    const reference = state.references[choice - 1];
    // The decision is signed against the reviewer it was assigned to, so use
    // that person rather than asking again and having the command refuse it.
    const [artefactId, version] = reference.split("@");
    const assigned = getArtefactVersion({
      artefactId,
      version: Number(version),
    })?.reviewer;
    if (assigned) {
      commandMenu = { kind: "artefact", stage: "review-decision", reference, reviewer: assigned };
      return [askArtefactDecision(reference, assigned)];
    }
    if (state.reviewers.length === 1) {
      commandMenu = {
        kind: "artefact",
        stage: "review-decision",
        reference,
        reviewer: state.reviewers[0],
      };
      return [askArtefactDecision(reference, state.reviewers[0])];
    }
    commandMenu = {
      kind: "artefact",
      stage: "review-reviewer",
      reference,
      reviewers: state.reviewers,
    };
    return pickList("Who reviewed it?", state.reviewers);
  }

  if (state.stage === "review-reviewer") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.reviewers.length) {
      return [
        { actor: "Arturo", label: "Who reviewed it?", body: `Please reply with a number from 1 to ${state.reviewers.length}.` },
      ];
    }
    const reviewer = state.reviewers[choice - 1];
    commandMenu = {
      kind: "artefact",
      stage: "review-decision",
      reference: state.reference,
      reviewer,
    };
    return [askArtefactDecision(state.reference, reviewer)];
  }

  if (state.stage === "review-decision") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > ARTEFACT_DECISIONS.length) {
      return [askArtefactDecision(state.reference, state.reviewer)];
    }
    commandMenu = {
      kind: "artefact",
      stage: "review-notes",
      reference: state.reference,
      reviewer: state.reviewer,
      decision: ARTEFACT_DECISIONS[choice - 1].decision,
    };
    return [
      {
        actor: "Arturo",
        label: "Why?",
        body: [
          "In plain words, what is the reason for that decision?",
          "",
          "This is recorded with the decision and bound to this exact version.",
        ].join("\n"),
      },
    ];
  }

  if (state.stage === "review-notes") {
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "Why?", body: "Please give a reason, or ESC to go back. It is part of the durable record." },
      ];
    }
    const { reference, reviewer, decision } = state;
    clearCommandMenu();
    return [
      captureUiCommandOutput("Artefact", () =>
        handleArtefactCommand([
          "review",
          reference,
          "--decision",
          decision,
          "--as",
          reviewer,
          "--notes",
          trimmed,
        ])
      ),
    ];
  }

  // --- Artefact add wizard ---
  if (state.stage === "name") {
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "Attach a file", body: "Please type a name for the file, or ESC to go back." },
      ];
    }
    commandMenu = { kind: "artefact", stage: "kind", name: trimmed };
    return [askArtefactKind()];
  }

  if (state.stage === "kind") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > ARTEFACT_KINDS.length) {
      return [
        { actor: "Arturo", label: "What kind of file?", body: `Please reply with a number from 1 to ${ARTEFACT_KINDS.length}.` },
      ];
    }
    commandMenu = { kind: "artefact", stage: "where", name: state.name, artKind: ARTEFACT_KINDS[choice - 1] };
    return [
      {
        actor: "Arturo",
        label: "Where is the file?",
        body: [
          "Where is the file? Type either:",
          "  · a path to it on this computer (for example: ./contract.pdf), or",
          "  · a https:// web address.",
        ].join("\n"),
      },
    ];
  }

  if (state.stage === "where") {
    if (!trimmed) {
      return [
        { actor: "Arturo", label: "Where is the file?", body: "Please type a file path or a https:// address, or ESC to go back." },
      ];
    }
    const workers = listWorkers()
      .filter((worker) => !worker.system)
      .map((worker) => worker.displayName ?? worker.name);
    if (workers.length === 0) {
      clearCommandMenu();
      return [
        {
          actor: "Arturo",
          label: "No Workers yet",
          body: "A file must be attributed to a Worker who produced it. Run /staff to add Workers first, then /artefact.",
        },
      ];
    }
    if (workers.length === 1) {
      return artefactAfterWorker(state.name, state.artKind, trimmed, workers[0]);
    }
    commandMenu = { kind: "artefact", stage: "worker", name: state.name, artKind: state.artKind, where: trimmed, workers };
    return pickList("Who produced this file?", workers);
  }

  if (state.stage === "worker") {
    const choice = menuPick(trimmed, state.workers);
    if (!choice) {
      return [
        // menuPick takes the name as readily as the number, and an operator
        // reading a list of names types one. Saying "a number from 1 to N"
        // made a reply that works look like one that does not.
        { actor: "Arturo", label: "Who produced this file?", body: `Please reply with a number from 1 to ${state.workers.length}, or type the Worker's name.` },
      ];
    }
    return artefactAfterWorker(state.name, state.artKind, state.where, state.workers[choice - 1]);
  }

  if (state.stage === "link") {
    // "skip" is the common answer: most files are not an answer to a request.
    const choice = isSkipReply(trimmed) ? undefined : menuNumber(trimmed);
    if (!isSkipReply(trimmed) && (!choice || choice < 1 || choice > state.taskIds.length)) {
      return [
        {
          actor: "Arturo",
          label: "Is this what you asked someone for?",
          body: `Please reply with a number from 1 to ${state.taskIds.length}, or skip.`,
        },
      ];
    }
    return askArtefactNote({
      name: state.name,
      artKind: state.artKind,
      where: state.where,
      createdBy: state.createdBy,
      enterpriseName: state.enterpriseName,
      humanTask: choice ? state.taskIds[choice - 1] : undefined,
    });
  }

  if (state.stage === "note") {
    const note = isSkipReply(trimmed) ? undefined : trimmed || undefined;
    const { name, artKind, where, createdBy, enterpriseName, humanTask } = state;
    clearCommandMenu();
    return createArtefactFromAnswers(
      name,
      artKind,
      where,
      createdBy,
      enterpriseName,
      humanTask,
      note
    );
  }

  if (state.stage === "version-note") {
    const note = isSkipReply(trimmed) ? undefined : trimmed || undefined;
    const { artefactId, where, createdBy } = state;
    clearCommandMenu();
    return createArtefactVersionFromAnswers(artefactId, where, createdBy, note);
  }

  if (state.stage === "submit-note") {
    const note = isSkipReply(trimmed) ? undefined : trimmed || undefined;
    const { reference, reviewer } = state;
    clearCommandMenu();
    return [
      captureUiCommandOutput("Artefact", () =>
        handleArtefactCommand([
          "submit",
          reference,
          "--reviewer",
          reviewer,
          ...(note ? ["--notes", note] : []),
        ])
      ),
    ];
  }

  if (state.stage === "inspect-pick") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.ids.length) {
      return [
        { actor: "Arturo", label: "Which file?", body: `Please reply with a number from 1 to ${state.ids.length}.` },
      ];
    }
    const id = state.ids[choice - 1];
    clearCommandMenu();
    return [captureUiCommandOutput("Artefact", () => handleArtefactCommand(["inspect", id]))];
  }

  if (state.stage === "verify-pick") {
    const choice = menuNumber(trimmed);
    if (!choice || choice < 1 || choice > state.references.length) {
      return [
        { actor: "Arturo", label: "Which version?", body: `Please reply with a number from 1 to ${state.references.length}.` },
      ];
    }
    const reference = state.references[choice - 1];
    clearCommandMenu();
    return [captureUiCommandOutput("Artefact", () => handleArtefactCommand(["verify", reference]))];
  }

  // artefact enterprise pick
  const idx = menuNumber(trimmed);
  if (!idx || idx < 1 || idx > state.names.length) {
    return [
      { actor: "Arturo", label: "Which business?", body: `Please reply with a number from 1 to ${state.names.length}.` },
    ];
  }
  return artefactAfterEnterprise(
    state.name,
    state.artKind,
    state.where,
    state.createdBy,
    state.names[idx - 1]
  );
}

/**
 * Offers to record what a file answers, then asks for a note.
 *
 * Only asked when a person has actually been asked for something. The link is
 * what makes a returned document traceable to the request that produced it —
 * `--human-task` was previously reachable only by typing the id.
 */
function artefactAfterEnterprise(
  name: string,
  artKind: string,
  where: string,
  createdBy: string,
  enterpriseName: string
): readonly WorkStreamEntry[] {
  const open = listHumanTasks()
    .filter((task) => task.status === "open")
    .map((task) => task.id);

  if (open.length === 0) {
    return askArtefactNote({ name, artKind, where, createdBy, enterpriseName });
  }

  commandMenu = {
    kind: "artefact",
    stage: "link",
    name,
    artKind,
    where,
    createdBy,
    enterpriseName,
    taskIds: open,
  };
  return [
    {
      actor: "Arturo",
      label: "Is this what you asked someone for?",
      body: [
        "If this file came back from something you asked a person to do, say which.",
        "",
        ...open.map((id, index) => {
          const task = getHumanTask(id);
          return `  ${index + 1}. ${id} — ${task?.title ?? "(untitled)"}`;
        }),
        "",
        "Reply with a number, or skip.",
      ].join("\n"),
    },
  ];
}

/** Asks what changed in this version, then records it. Skippable. */
function askArtefactVersionNote(
  artefactId: string,
  where: string,
  createdBy: string
): readonly WorkStreamEntry[] {
  commandMenu = { kind: "artefact", stage: "version-note", artefactId, where, createdBy };
  return [
    {
      actor: "Arturo",
      label: "What changed in this version?",
      body: [
        "A short note kept with this exact version. The reviewer sees it beside the old one.",
        "",
        "Type it, or skip.",
      ].join("\n"),
    },
  ];
}

/** Asks what the reviewer should look at, then sends it. Skippable. */
function askArtefactSubmitNote(
  reference: string,
  reviewer: string
): readonly WorkStreamEntry[] {
  commandMenu = { kind: "artefact", stage: "submit-note", reference, reviewer };
  return [
    {
      actor: "Arturo",
      label: `What should ${reviewer} check?`,
      body: [
        "This goes to them with the file, so it is worth being specific about what matters.",
        "",
        "Type it, or skip.",
      ].join("\n"),
    },
  ];
}

/**
 * Reads "1", "1,3", or "1 3" as a set of menu choices.
 *
 * `--input-artefact` has always taken a comma-separated list, but the menu could
 * only offer one — so "work from the specification and the engineer's comments",
 * which is the ordinary case, could not be said without switches.
 *
 * PURE: No side effects.
 */
/**
 * Matches a reply against the exact `artefact-3@1` references on offer. PURE.
 *
 * A row number is the quick way in, but a file's number moves as its review
 * state changes — approved versions are listed above drafts — so a number that
 * was right a moment ago silently picks a *different* file rather than failing.
 * The reference is what the decision ends up bound to, so it is worth being
 * able to say it outright.
 */
export function menuReferenceChoice(
  reply: string,
  references: readonly string[]
): string | undefined {
  const wanted = reply.trim().toLowerCase();
  if (!wanted) return undefined;
  return references.find((reference) => reference.toLowerCase() === wanted);
}

/**
 * Resolves a picker reply to a 1-based row, by number or by the name on it.
 *
 * A row's number moves as records are added, removed, or change state, and a
 * stale number is a valid choice for a *different* record rather than an error.
 * That is how a scripted run came to hold a Task on the wrong document without
 * anything looking wrong. The name is what the operator means, so let them say
 * it — and let a plan say it, so it cannot drift.
 *
 * Rows written as "Name — what it means" match on the name alone. PURE.
 */
export function menuPick(
  reply: string,
  options: readonly string[]
): number | undefined {
  const wanted = reply.trim().toLowerCase();
  if (!wanted) return undefined;

  const numbered = menuNumber(reply);
  if (
    numbered !== undefined &&
    numbered >= 1 &&
    numbered <= options.length
  ) {
    return numbered;
  }

  const index = options.findIndex(
    (option) => {
      const label = option.trim().toLowerCase();
      return (
        label === wanted ||
        label.split(" — ")[0].trim() === wanted
      );
    }
  );
  return index >= 0 ? index + 1 : undefined;
}

/** menuNumbers, but each answer may also name its reference outright. PURE. */
export function menuReferences(
  value: string,
  references: readonly string[]
): readonly string[] | undefined {
  const parts = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const chosen: string[] = [];
  for (const part of parts) {
    const named = menuReferenceChoice(part, references);
    const choice = named ? undefined : menuNumber(part);
    const reference =
      named ??
      (choice !== undefined && choice >= 1 && choice <= references.length
        ? references[choice - 1]
        : undefined);
    if (!reference) return undefined;
    if (!chosen.includes(reference)) chosen.push(reference);
  }
  return chosen;
}

/** The house spelling of "leave it blank", used by every optional question. PURE. */
function isSkipReply(value: string): boolean {
  return value.trim().toLowerCase() === "skip";
}

/** Asks for the note that travels with the version. Skippable. */
function askArtefactNote(draft: {
  readonly name: string;
  readonly artKind: string;
  readonly where: string;
  readonly createdBy: string;
  readonly enterpriseName: string;
  readonly humanTask?: string;
}): readonly WorkStreamEntry[] {
  commandMenu = { kind: "artefact", stage: "note", ...draft };
  return [
    {
      actor: "Arturo",
      label: "Anything worth noting about it?",
      body: [
        "A short note kept with this exact version — where it came from, or what changed.",
        "",
        "Type it, or skip.",
      ].join("\n"),
    },
  ];
}

/**
 * After the artefact's Worker is known, resolves the Enterprise (sole one, or
 * a numbered pick) and creates the artefact.
 */
function artefactAfterWorker(
  name: string,
  artKind: string,
  where: string,
  createdBy: string
): readonly WorkStreamEntry[] {
  const names = listEnterprises().map((enterprise) => enterprise.name);
  if (names.length === 0) {
    clearCommandMenu();
    return [
      {
        actor: "Arturo",
        label: "Set up a business first",
        body: "A file belongs to a business. Run /enterprise to set one up first, then /artefact.",
      },
    ];
  }
  if (names.length === 1) {
    return artefactAfterEnterprise(name, artKind, where, createdBy, names[0]);
  }
  commandMenu = { kind: "artefact", stage: "enterprise", name, artKind, where, createdBy, names };
  return pickList("Which business does this belong to?", names);
}

/**
 * Purpose: Handles starting a business function from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for started function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function runtime state.
 */
export function handleUiStartFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  return handleUiFunctionLifecycleCommand(
    args,
    "Use /start-function <function-id>",
    "started",
    startBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles pausing a business function from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for paused function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function runtime state.
 */
export function handleUiPauseFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  return handleUiFunctionLifecycleCommand(
    args,
    "Use /pause-function <function-id>",
    "paused",
    pauseBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles resuming a business function from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for resumed function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function runtime state.
 */
export function handleUiResumeFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  return handleUiFunctionLifecycleCommand(
    args,
    "Use /resume-function <function-id>",
    "resumed",
    resumeBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles stopping a business function from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for stopped function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function runtime state.
 */
export function handleUiStopFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  return handleUiFunctionLifecycleCommand(
    args,
    "Use /stop-function <function-id>",
    "stopped",
    stopBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles failing a business function from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - Work stream entry for failed function, usage, or error.
 *
 * SIDE EFFECT:
 * - Mutates business function runtime state.
 */
export function handleUiFailFunctionCommand(
  args: readonly string[]
): readonly WorkStreamEntry[] {
  return handleUiFunctionLifecycleCommand(
    args,
    "Use /fail-function <function-id>",
    "failed",
    failBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles a business function lifecycle command from the terminal UI.
 *
 * Params:
 * - args: Command arguments.
 * - usage: Usage text.
 * - action: Lifecycle action label.
 * - transition: Runtime transition function.
 *
 * Returns:
 * - Work stream entries describing the result.
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 */
export function handleUiFunctionLifecycleCommand(
  args: readonly string[],
  usage: string,
  action: string,
  transition: (
    id: string
  ) => BusinessFunctionRuntime | undefined
): readonly WorkStreamEntry[] {
  const [
    id,
  ] = args;

  if (!id) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: usage,
      },
    ];
  }

  const businessFunction =
    transition(
      id
    );

  if (!businessFunction) {
    return [
      {
        actor: "Arturo",
        label: "Function not found",
        body: `function not found: ${id}`,
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: `Function ${action}`,
      body: [
        `id: ${businessFunction.id}`,
        `status: ${businessFunction.state}`,
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Handles a terminal UI command and returns work stream entries.
 *
 * Params:
 * - command: Parsed slash command.
 * - args: Parsed command arguments.
 *
 * Returns:
 * - Work stream entries generated by the command.
 *
 * SIDE EFFECT:
 * - May plan workflows.
 * - May run planned workflows.
 * - May read or mutate runtime state.
 * - May register or refine workers.
 */
export async function handleUiCommand(
  command: string,
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  if (!commandContinuesSetup(command, args) && isSetupFlowActive()) {
    clearSetupFlow();
  }

  if (command === "/chat") {
    return [await handleUiWorkerChatCommand(args)];
  }

  if (command === "/model-routing") {
    return [readModelRoutingEntry()];
  }

  if (command === "/models") {
    // Alias of /model: one interactive chooser, both spellings.
    return [...await handleUiModelCommand()];
  }

  if (command === "/web-search") {
    return [
      handleWebSearchCommand(args),
    ];
  }

  if (command === "/task-cap") {
    // Legacy alias, named after a --capability flag that no longer exists. It
    // is now exactly /task: bare opens the guided flow instead of silently
    // running /task create with no outcome, and arguments create a Task.
    return [
      ...(await handleUiCommand(
        "/task",
        args.length
          ? ["create", ...args]
          : []
      )),
    ];
  }

  if (command === "/task") {
    const [
      subcommand,
      ...subcommandArgs
    ] = args;

    if (subcommand === "create") {
      // --function/--job naming something that is not there: offer the real
      // Functions rather than refusing a fully-typed Task.
      for (const flag of ["--function", "--job"] as const) {
        const slot = args.indexOf(flag) + 1;
        if (slot <= 0 || slot >= args.length) continue;
        if (getBusinessFunctionDefinitionByIdOrLabel(args[slot])) continue;
        const offered = offerKnownValues({
          command: "/task",
          args,
          slot,
          options: listBusinessFunctionDefinitions().map((one) => one.label),
          label: "Which Function should do this?",
          typed: args[slot],
        });
        if (offered) return offered;
      }
      return [
        captureUiCommandOutput(
          "Task created",
          () => handleTaskCreateCommand(
            subcommandArgs
          )
        ),
      ];
    }

    if (subcommand === "retry") {
      return handleUiTaskRetryCommand(
        subcommandArgs[0]
      );
    }

    if (subcommand === "reply") {
      const taskId = subcommandArgs[0];
      const replyText = subcommandArgs[1];
      const askedBy = getUiFlagValue(subcommandArgs, "--as");
      if (!taskId || !replyText || taskId.startsWith("--") || replyText.startsWith("--")) {
        return [
          {
            actor: "Arturo",
            label: "Task reply",
            body: 'Usage: /task reply <task-id> "<your reply>" [--as "<your name>"]',
          },
        ];
      }
      const outcome = replyToTask({ taskId, reply: replyText, askedBy });
      return [
        {
          actor: "Arturo",
          label: outcome.created ? "Task created" : "Task reply",
          body: outcome.message,
        },
      ];
    }

    if (subcommand === "setaside") {
      const outcome = setAsideTaskResult(subcommandArgs);
      return [
        {
          actor: "Arturo",
          label: outcome.setAside ? "Result set aside" : "Result not set aside",
          body: outcome.message,
        },
      ];
    }

    if (subcommand === "stop-route") {
      const outcome = stopRoute({ taskId: subcommandArgs[0] ?? "", as: getUiFlagValue(subcommandArgs, "--as")?.trim() ?? "" });
      return [
        {
          actor: "Arturo",
          label: outcome.stopped ? "Route stopped" : "Route not stopped",
          body: subcommandArgs[0] && !subcommandArgs[0].startsWith("--") ? outcome.message : 'Usage: /task stop-route <task-id> --as "<your name>"',
        },
      ];
    }

    if (subcommand === "signoff") {
      const outcome = signOffTaskResult(subcommandArgs);
      return [
        {
          actor: "Arturo",
          label: outcome.signedOff ? "Result signed off" : "Result not signed off",
          body: outcome.message,
        },
      ];
    }

    const reference =
      subcommand === "inspect"
        ? subcommandArgs[0]
        : subcommand;

    // Bare /task: an interactive operator gets a guided menu.
    if (!reference && isInteractiveSession()) {
      return startTaskMenu();
    }

    return [
      reference
        ? readJobDetailEntry(
            reference
          )
        : {
            actor: "Arturo",
            label: "Usage",
            body: [
              'Use /task inspect "<task-id>"',
              'or /task create "<one-clear-outcome>" [--function "<function>"]',
            ].join("\n"),
          },
    ];
  }

  if (command === "/approve") {
    // Bare /approve: the operator should not have to know a Task id, nor to
    // remember --as the moment a second person could decide.
    if (args.length === 0 && isInteractiveSession()) {
      return startDecisionMenu("approve");
    }
    return [captureUiCommandOutput("Approval", () => handleApproveCommand(args))];
  }

  if (command === "/reject") {
    if (args.length === 0 && isInteractiveSession()) {
      return startDecisionMenu("reject");
    }
    return [captureUiCommandOutput("Rejection", () => handleRejectCommand(args))];
  }

  if (command === "/approval-status") {
    return [captureUiCommandOutput("Approval status", () => handleApprovalStatusCommand(args))];
  }

  if (command === "/create-human-task") {
    // Bare /create-human-task: an interactive operator gets the guided flow.
    if (args.length === 0 && isInteractiveSession()) {
      return startCreateHumanTaskMenu();
    }
    return [captureUiCommandOutput("Human task created", () => handleCreateTaskCommand(args))];
  }

  if (command === "/artefact") {
    // Bare /artefact: an interactive operator gets the guided menu — attach,
    // send for review, record a decision, or list. The id-based subcommands
    // (inspect/verify/submit/review) still take their arguments; only the empty
    // invocation opens the menu.
    if (args.length === 0 && isInteractiveSession()) {
      return startArtefactMenu();
    }
    // "add" plus a name and nothing else: continue the attach wizard from the
    // next thing it needs, rather than printing its switches.
    if (
      args[0] === "add" &&
      args.length === 2 &&
      !args[1].startsWith("--") &&
      isInteractiveSession()
    ) {
      commandMenu = {
        kind: "artefact",
        stage: "kind",
        name: stripSurroundingQuotes(args[1]),
      };
      return [askArtefactKind()];
    }
    return [
      captureUiCommandOutput(
        "Artefact",
        () =>
          handleArtefactCommand(
            args
          )
      ),
    ];
  }

  if (command === "/artefacts") {
    return [
      captureUiCommandOutput(
        "Artefacts",
        () =>
          handleArtefactsCommand(
            args
          )
      ),
    ];
  }

  if (command === "/human-task") {
    return [captureUiCommandOutput("Human task", () => handleHumanTaskCommand(args))];
  }

  if (command === "/complete-human-task") {
    if (args.length === 0 && isInteractiveSession()) {
      return startHumanTaskAction("complete");
    }
    // An id with nothing to say about it: ask, rather than printing usage.
    if (args.length === 1 && isInteractiveSession()) {
      const target = getHumanTask(args[0]);
      if (!target) {
        return [
          {
            actor: "Arturo",
            label: "Human task not found",
            body: `There is no Human Task with id ${args[0]}. Run /human-tasks to see them.`,
          },
        ];
      }
      commandMenu = { kind: "humantask", stage: "act-text", action: "complete", id: target.id };
      return [askHumanTaskActionText("complete", target.title)];
    }
    return [captureUiCommandOutput("Human task completed", () => handleCompleteTaskCommand(args))];
  }

  if (command === "/block-task") {
    if (args.length === 0 && isInteractiveSession()) {
      return startHumanTaskAction("block");
    }
    // An id with nothing to say about it: ask, rather than printing usage.
    if (args.length === 1 && isInteractiveSession()) {
      const target = getHumanTask(args[0]);
      if (!target) {
        return [
          {
            actor: "Arturo",
            label: "Human task not found",
            body: `There is no Human Task with id ${args[0]}. Run /human-tasks to see them.`,
          },
        ];
      }
      commandMenu = { kind: "humantask", stage: "act-text", action: "block", id: target.id };
      return [askHumanTaskActionText("block", target.title)];
    }
    return [captureUiCommandOutput("Human task blocked", () => handleBlockTaskCommand(args))];
  }

  if (command === "/revise-task") {
    if (args.length === 0 && isInteractiveSession()) {
      return startHumanTaskAction("revise");
    }
    // An id with nothing to say about it: ask, rather than printing usage.
    if (args.length === 1 && isInteractiveSession()) {
      const target = getHumanTask(args[0]);
      if (!target) {
        return [
          {
            actor: "Arturo",
            label: "Human task not found",
            body: `There is no Human Task with id ${args[0]}. Run /human-tasks to see them.`,
          },
        ];
      }
      commandMenu = { kind: "humantask", stage: "act-text", action: "revise", id: target.id };
      return [askHumanTaskActionText("revise", target.title)];
    }
    return [captureUiCommandOutput("Human task revision requested", () => handleReviseTaskCommand(args))];
  }

  if (command === "/overview") {
    return createUiOverviewEntries();
  }

  if (command === "/waiting") {
    return createWhatsWaitingEntries();
  }

  if (command === "/acceptances") {
    const enterprise = listEnterprises()[0];
    if (!enterprise) {
      return [{ actor: "Arturo", label: "Acceptances", body: "Set up a business first." }];
    }
    const asIndex = args.indexOf("--as");
    const as = asIndex >= 0 ? String(args[asIndex + 1] ?? "").trim() : "";
    if (as && !isOwner(enterprise.id, as)) {
      return [{ actor: "Arturo", label: "Acceptances", body: "Only the owner can see the weekly list of freelancer email acceptances." }];
    }
    return [{ actor: "Arturo", label: "Acceptances", body: formatWeeklyEmailAcceptances(enterprise.id) }];
  }

  if (command === "/ask") {
    if (args.length === 0) {
      return [
        createAskUsageEntry(),
      ];
    }

    // Checked before the model call. An empty installation cannot produce a
    // runnable workflow by construction, and the failure it produced instead
    // sent operators around the Enterprise → Functions → /staff path.
    const setupState = readSetupState();
    if (!isReadyForWork(setupState)) {
      return [
        {
          actor: "Arturo",
          label: "Set up the business first",
          body: formatSetupRequiredBody(
            setupState
          ),
        },
      ];
    }

    try {
      const result =
        await planAskWorkflow(
          args
        );

      return createAskWorkflowResultEntries(
        result
      );
    } catch (error) {
      return [
        createAskFailedEntry(
          error
        ),
      ];
    }
  }

  if (command === "/start") {
    return handleUiStartWorkflowCommand(
      args
    );
  }

  if (command === "/workflow") {
    const enterpriseFlagIndex = args.indexOf("--enterprise");
    const blocked = refuseTypedWorkSettingCommand(
      resolveEnterpriseIdForTypedWorkCheck(enterpriseFlagIndex >= 0 ? stripSurroundingQuotes(String(args[enterpriseFlagIndex + 1] ?? "")) : undefined),
      "workflow",
    );
    if (blocked) {
      return [
        {
          actor: "Arturo" as const,
          label: "Refused",
          body: blocked,
        },
      ];
    }
    // "create" plus a name: ask for the objective and then the ordered steps,
    // rather than refusing until --step pairs are supplied.
    if (
      args[0] === "create" &&
      args.length === 2 &&
      !args[1].startsWith("--") &&
      isInteractiveSession()
    ) {
      const workers = listWorkers()
        .filter((worker) => !worker.system)
        .map((worker) => worker.displayName ?? worker.name);
      if (workers.length === 0) {
        return [
          {
            actor: "Arturo",
            label: "No Workers yet",
            body: "A Workflow's steps are performed by registered Workers, and there are none. Run /staff first.",
          },
        ];
      }
      commandMenu = {
        kind: "workflow",
        stage: "build-objective",
        name: stripSurroundingQuotes(args[1]),
      };
      return [askWorkflowObjective()];
    }
    if (args.length === 0) {
      // Bare /workflow: an interactive operator gets a guided menu — describe
      // it, or set the ordered steps by number instead of repeating --step.
      if (isInteractiveSession()) {
        return startWorkflowMenu();
      }
      return [
        createWorkflowUsageEntry(),
      ];
    }

    try {
      const result =
        await createGeneratedWorkflow(
          args
        );

      return createGeneratedWorkflowEntries(
        result
      );
    } catch (error) {
      return [
        createWorkflowFailedEntry(
          error
        ),
      ];
    }
  }

  if (command === "/run") {
    const enterpriseFlagIndex = args.indexOf("--enterprise");
    const blocked = refuseTypedWorkSettingCommand(
      resolveEnterpriseIdForTypedWorkCheck(enterpriseFlagIndex >= 0 ? stripSurroundingQuotes(String(args[enterpriseFlagIndex + 1] ?? "")) : undefined),
      "run",
    );
    if (blocked) {
      return [
        {
          actor: "Arturo" as const,
          label: "Refused",
          body: blocked,
        },
      ];
    }
    if (args.length === 0) {
      // Bare /run: pick a saved Workflow by number rather than typing its name.
      if (isInteractiveSession()) {
        return startRunMenu();
      }
      return [
        createRunUsageEntry(),
      ];
    }

    try {
      const result =
        runPlannedWorkflowFromArgs(
          args
        );

      return createPlannedWorkflowRunEntries(
        result
      );
    } catch (error) {
      return [
        createPlannedWorkflowRunFailedEntry(
          error
        ),
      ];
    }
  }

  if (command === "/refine-worker") {
    const [
      name,
      ...refinementParts
    ] = args;

    const refinement =
      refinementParts
        .join(" ")
        .trim();

    // No arguments: an interactive operator picks a Worker from a list and
    // types the refinement in plain words. Headless runs keep the usage text.
    if (args.length === 0 && isInteractiveSession()) {
      return startRefineWorker();
    }

    // A Worker named but nothing to refine it with: ask for the instructions
    // rather than printing usage the operator has to translate back into a
    // command.
    if (name && refinement.length === 0 && isInteractiveSession()) {
      if (!getWorker(name)) {
        return [
          {
            actor: "Arturo",
            label: "Worker not found",
            body: `There is no Worker called "${name}". Run /workers to see the exact names.`,
          },
        ];
      }
      commandMenu = { kind: "refine", stage: "text", workerName: name };
      return [
        {
          actor: "Arturo",
          label: `How should ${name} specialise?`,
          // Second person, matching the guided flow — see the note there.
          body: [
            "Type your instructions, or ESC to go back.",
            "",
            "For example: You are a softball coach who specialises in coaching "
            + "softball for girls under 15. You have many years of experience "
            + "and have played at top levels.",
          ].join("\n"),
        },
      ];
    }

    if (!name || refinement.length === 0) {
      return [
        {
          actor: "Arturo",
          label: "Usage",
          body: '/refine-worker <worker-name> "<refinement instructions>"',
        },
      ];
    }

    const worker =
      refineWorker(
        name,
        refinement
      );

    return [
      worker
        ? createWorkerRefinedEntry(
            worker.name,
            worker.refinement
          )
        : {
            actor: "Arturo",
            label: "Worker not found",
            body: `worker not found: ${name}`,
          },
    ];
  }

  if (command === "/jobs") {
    return handleUiFunctionCommand(
      [
        "list",
        ...args,
      ]
    );
  }

if (command === "/memory") {
  // Bare /memory: an interactive operator gets a guided menu; the note's scope
  // is picked by number rather than typed as --scope.
  if (args.length === 0 && isInteractiveSession()) {
    return startMemoryMenu();
  }
  // A note with no scope: ask where it applies, rather than printing usage.
  if (
    args[0] === "add" &&
    args.length > 1 &&
    !args.includes("--scope") &&
    isInteractiveSession()
  ) {
    const content = args.slice(1).join(" ").trim();
    const scopes = memoryScopeChoices();
    if (content) {
      if (scopes.length === 1) {
        return [
          handleUiMemoryCommand(["add", content, "--scope", scopes[0].reference]),
        ];
      }
      commandMenu = { kind: "memory", stage: "add-scope", content, scopes };
      return [
        {
          actor: "Arturo",
          label: "Where does it apply?",
          body: [
            "Which work should this note be used for?",
            "",
            ...scopes.map((scope, index) => `  ${index + 1}. ${scope.label}`),
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }
  }
  return [
    handleUiMemoryCommand(
      args
    ),
  ];
}

  if (command === "/health") {
    // Bare /health: ask which Function rather than printing usage.
    if (args.length === 0 && isInteractiveSession()) {
      return startHealthMenu();
    }
    return [
      handleUiHealthCommand(
        args
      ),
    ];
  }
  
if (command === "/governance") {
  // Bare /governance: an interactive operator gets a guided menu instead of a
  // summary they cannot act on without the flag form.
  if (args.length === 0 && isInteractiveSession()) {
    return startGovernanceMenu();
  }
  // A rule described but not specified: ask for the rest. A policy decides
  // whether governed work may run, so an incomplete one must never be guessed
  // at — every remaining answer is asked for explicitly.
  if (
    args[0] === "policy" &&
    args[1] === "add" &&
    args.length === 3 &&
    !args[2].startsWith("--") &&
    isInteractiveSession()
  ) {
    commandMenu = {
      kind: "governance",
      stage: "add-effect",
      description: stripSurroundingQuotes(args[2]),
    };
    return [askGovernanceEffect()];
  }
  return [
    handleUiGovernanceCommand(
      args
    ),
  ];
}
  
  if (command === "/events") {
  return [
    readEventEntries(),
  ];
  }
  
  if (command === "/event") {
  // Bare /event: an interactive operator gets a guided menu rather than the
  // --source/--when/--publish usage block.
  if (args.length === 0 && isInteractiveSession()) {
    return startEventMenu();
  }
  // A rule keyed to a Function that is not there. The rule would never fire,
  // so the name is worth correcting before the rule is written, not after.
  if (args[0] === "rule") {
    for (const flag of ["--job", "--function", "--task", "--source"] as const) {
      const slot = args.indexOf(flag) + 1;
      if (slot <= 0 || slot >= args.length) continue;
      if (getBusinessFunctionDefinitionByIdOrLabel(args[slot])) continue;
      const offered = offerKnownValues({
        command: "/event",
        args,
        slot,
        options: listBusinessFunctionDefinitions().map((one) => one.label),
        label: "Which Function is this about?",
        typed: args[slot],
      });
      if (offered) return offered;
    }
  }
  // Named but not attributed: ask which Function it is about. The Enterprise
  // travels with that choice, so it is never asked for separately.
  if (
    args[0] === "publish" &&
    args.length === 2 &&
    !args[1].startsWith("--") &&
    isInteractiveSession()
  ) {
    const functions = eventFunctionChoices();
    if (functions.length === 0) {
      return noEventFunctionsEntry();
    }
    const label = stripSurroundingQuotes(args[1]);
    if (functions.length === 1) {
      return [await publishEventFromAnswers(label, functions[0])];
    }
    commandMenu = { kind: "event", stage: "publish-function", label, functions };
    return pickList(
      "Which Function is this about?",
      functions.map(eventFunctionLabel)
    );
  }
  return [
    await handleUiEventCommand(
      args
    ),
  ];
  }

  if (command === "/schedule") {
    // Bare /schedule: an interactive operator gets a guided menu.
    if (args.length === 0 && isInteractiveSession()) {
      return startScheduleMenu();
    }
    // "add" plus the outcome: ask the cadence and time it still needs.
    if (
      args[0] === "add" &&
      args.length === 2 &&
      !args[1].startsWith("--") &&
      isInteractiveSession()
    ) {
      commandMenu = {
        kind: "schedule",
        stage: "add-cadence",
        request: stripSurroundingQuotes(args[1]),
      };
      return [askScheduleCadence()];
    }
    // "--every weekly" is the word five separate scenarios reached for, and the
    // parser cannot use it: a weekly schedule needs a day. Ask for the day
    // instead of refusing the whole line.
    const everyIndex = args.findIndex((token) => token === "--every") + 1;
    if (
      everyIndex > 0 &&
      everyIndex < args.length &&
      WEEKLY_WITHOUT_A_DAY.has(stripSurroundingQuotes(args[everyIndex]).toLowerCase()) &&
      isInteractiveSession()
    ) {
      commandMenu = { kind: "schedule", stage: "add-day-for-args", args, everyIndex };
      return [
        {
          actor: "Arturo",
          label: "Which day?",
          body: [
            "A weekly schedule needs a day to land on.",
            "",
            ...WEEKDAY_NAMES.map((day, index) => `  ${index + 1}. ${capitalise(day)}`),
            "",
            "Reply with a number, or ESC to go back.",
          ].join("\n"),
        },
      ];
    }
    return [
      handleUiScheduleCommand(
        args
      ),
    ];
  }
  
  if (command === "/job") {
    const [
      subcommand,
      ...subcommandArgs
    ] = args;

    if (
      subcommand === "create" ||
      subcommand === "update" ||
      subcommand === "inspect" ||
      subcommand === "list"
    ) {
      return handleUiFunctionCommand(
        args
      );
    }

    if (subcommand === "start") {
      return handleUiRuntimeStartCommand(
        subcommandArgs
      );
    }

    return [
      subcommand
        ? readJobDetailEntry(
            subcommand
          )
        : {
            actor: "Arturo",
            label: "Usage",
            body: createFunctionUsageText(),
          },
    ];
  }

  if (command === "/tasks") {
    const tasks =
      listJobs();
    // "all" is a plain word rather than a switch; --all stays accepted so
    // existing scripts keep working.
    const showAll =
      args.includes("all") ||
      args.includes("--all");
    return [
      createNumberedJobsListEntry(
        tasks,
        showAll
          ? tasks.length
          : 8
      ),
    ];
  }

  if (command === "/functions") {
    // /functions is shorthand for /function list. Always prepend the "list"
    // subcommand so flags like --enterprise are parsed as options rather than
    // mistaken for the subcommand (/functions --enterprise "X" was erroring).
    return handleUiFunctionCommand(["list", ...args]);
  }

  if (command === "/task-detail") {
    return handleUiTaskDetailCommand(
      args
    );
  }

if (command === "/workers") {
  if (
    args[0] ===
    "remove"
  ) {
    const name =
      args[1];
    if (!name) {
      return [
        {
          actor:
            "Arturo",
          label:
            "Usage",
          body:
            'Use /workers remove "<worker-name>"',
        },
      ];
    }

    try {
      const result =
        safelyRemoveWorker(
          name
        );
      broadcastEvent(
        "worker.removed",
        "success",
        `Worker removed: ${result.worker.displayName ?? result.worker.name}`
      );

      return [
        {
          actor:
            "Arturo",
          label:
            "Worker removed",
          body:
            formatWorkerRemoval(
              result
            ),
        },
      ];
    } catch (error) {
      return [
        {
          actor:
            "Arturo",
          label:
            "Worker not removed",
          body:
            error instanceof Error
              ? error.message
              : String(
                  error
                ),
        },
      ];
    }
  }

  if (args[0] === "inspect") {
    return [
      readWorkerInspectionEntry(
        args.slice(1)
      ),
    ];
  }

  const capabilityFlagIndex =
    args.indexOf(
      "--capability"
    );

  if (capabilityFlagIndex >= 0) {
    const capabilityLabel =
      args[capabilityFlagIndex + 1];

    return [
      capabilityLabel
        ? readWorkersByCapabilityEntry(
            capabilityLabel
          )
        : {
            actor: "Arturo",
            label: "Usage",
            body: 'Use /workers --capability "<capability>"',
          },
    ];
  }

  return readWorkerEntries();
}

  if (command === "/archetypes") {
    return [
      readArchetypeEntry(
        args
      ),
    ];
  }

  if (command === "/capabilities") {
    return [
      readCapabilitiesEntry(
        args
      ),
    ];
  }

  if (command === "/human-tasks") {
    return readHumanTaskEntries();
  }

  if (command === "/approvals") {
    return readApprovalEntries();
  }

  if (command === "/timeline") {
    return readTimelineEntries(
      10
    );
  }

  if (command === "/setup") {
    if (isInteractiveSession()) return [...await startSetupFlow()];
    return [...runSetupScript(args)];
  }

  if (command === "/clients") {
    return [{ actor: "Arturo", label: "Clients", body: describeClients(args) }];
  }

  if (command === "/work") {
    const outcome = runWorkCommand(args);
    return [{ actor: "Arturo", label: outcome.refused ? REFUSED_LABEL : "Work", body: outcome.text }];
  }

  if (command === "/client") {
    if (args[0] !== "add") return [{ actor: "Arturo", label: "Client", body: CLIENT_ADD_USAGE }];
    const outcome = addClient(args.slice(1));
    return [{ actor: "Arturo", label: outcome.added ? "Client added" : "Client", body: outcome.message }];
  }

  if (command === "/assistant") {
    const enterprise = resolveEnterprise(flagValue(args, "--enterprise"));
    if ("refused" in enterprise) return [{ actor: "Arturo", label: "Assistant", body: enterprise.refused }];
    if (args[0] === "assign") {
      const person = args.slice(1).find((arg, index, rest) => !arg.startsWith("--") && !["--as", "--enterprise"].includes(rest[index - 1] ?? "")) ?? "";
      const outcome = assignClientDesk({ enterpriseId: enterprise.id, person, as: flagValue(args, "--as") ?? "" });
      return [{ actor: "Arturo", label: outcome.created ? "New clients assigned" : "Assistant", body: outcome.message }];
    }
    if (args[0] === "create") {
      const proposal = latestProposal(enterprise.id);
      if (!proposal) return [{ actor: "Arturo", label: "Assistant", body: "Run /assistant first to see what Arturo proposes." }];
      const outcome = createClientAssistant({ enterpriseId: enterprise.id, proposalId: proposal.id, as: flagValue(args, "--as") ?? "" });
      return [{ actor: "Arturo", label: outcome.created ? "Assistant set up" : "Assistant", body: outcome.message }];
    }
    const desk = findClientAssistant(enterprise.id);
    if (desk) {
      return [{ actor: "Arturo", label: "Assistant", body: `${desk.workerName} takes down new clients for ${enterprise.name}. It asks for: ${checklistFor(desk).map((item) => item.label).join(", ")}.\nTalk to it with /talk "<what you want to tell it>" --as "<your name>".` }];
    }
    const proposal = await proposeClientAssistant(enterprise.id);
    return [{ actor: "Arturo", label: "Assistant", body: "refused" in proposal ? proposal.refused : describeProposal(proposal) }];
  }

  if (command === "/talk") {
    const enterprise = resolveEnterprise(flagValue(args, "--enterprise"));
    if ("refused" in enterprise) return [{ actor: "Arturo", label: "Assistant", body: enterprise.refused }];
    const message = args.filter((arg, index) => !arg.startsWith("--") && !["--as", "--enterprise"].includes(args[index - 1])).join(" ");
    if (!message.trim()) return [{ actor: "Arturo", label: "Assistant", body: 'Usage: /talk "<what you want to tell your assistant>" --as "<your name>"' }];
    const outcome = await talkToAssistant({ enterpriseId: enterprise.id, as: flagValue(args, "--as") ?? "", message });
    const desk = findClientAssistant(enterprise.id);
    return [{ actor: outcome.replied && desk ? desk.workerName : "Arturo", label: outcome.replied ? "Assistant" : "Assistant", body: outcome.needsAssistant ? `${outcome.reply}\nRun /assistant to see what Arturo proposes.` : outcome.reply }];
  }

  if (command === "/enterprise") {
    return await handleUiEnterpriseCommand(
      args
    );
  }

  if (command === "/function") {
    return handleUiFunctionCommand(
      args
    );
  }

  if (command === "/add-ai-worker") {
    // No arguments: an interactive operator gets a guided name → role flow
    // rather than a switch-laden usage block. Headless runs keep the usage
    // text so nothing waits on a prompt that can't be answered.
    if (args.length === 0 && isInteractiveSession()) {
      return startAiWorkerAdd();
    }
    return handleUiAddAiWorker(
      args
    );
  }

  if (command === "/workflow-worker" || command === "/workflow-run" || command === "/worker-availability") {
    return [captureUiCommandOutput("Worker", () => handleWorkerLifecycleCommand(command, args))];
  }

  if (command === "/add-human-worker") {
    return handleUiAddHumanWorker(
      args
    );
  }

  if (command === "/reset") {
    return handleUiResetCommand();
  }

  if (command === "/help") {
    return [
      createUiHelpEntry(args),
    ];
  }

  if (command === "/add-function") {
    return handleUiAddFunctionCommand(
      args
    );
  }

  if (command === "/start-function") {
    return handleUiStartFunctionCommand(
      args
    );
  }

  if (command === "/pause-function") {
    return handleUiPauseFunctionCommand(
      args
    );
  }

  if (command === "/resume-function") {
    return handleUiResumeFunctionCommand(
      args
    );
  }

  if (command === "/stop-function") {
    return handleUiStopFunctionCommand(
      args
    );
  }

  if (command === "/fail-function") {
    return handleUiFailFunctionCommand(
      args
    );
  }

  if (command === "/delegation") {
  // Bare /delegation: an interactive operator gets a guided menu rather than
  // the --from/--to usage block.
  if (args.length === 0 && isInteractiveSession()) {
    return startDelegationMenu();
  }
  // The work described but not routed: ask who needs the help and who does it.
  if (
    args[0] === "request" &&
    args.length === 2 &&
    !args[1].startsWith("--") &&
    isInteractiveSession()
  ) {
    const functions = eventFunctionChoices();
    if (functions.length < 2) {
      return [
        {
          actor: "Arturo",
          label: "Not enough Functions",
          body: [
            "Handing work over needs two Functions: one asking, one doing.",
            "Run /function and choose 1 to add another.",
          ].join("\n"),
        },
      ];
    }
    commandMenu = {
      kind: "delegation",
      stage: "request-from",
      functions,
      work: stripSurroundingQuotes(args[1]),
    };
    return pickList(
      "Which Function needs the help?",
      functions.map(eventFunctionLabel)
    );
  }
  // --from/--to naming a Function that does not exist: offer the real ones
  // rather than refusing a line that is otherwise complete.
  if (args[0] === "request") {
    const labels = listBusinessFunctionDefinitions().map((one) => one.label);
    for (const flag of ["--from", "--to"] as const) {
      const slot = args.indexOf(flag) + 1;
      if (slot <= 0 || slot >= args.length) continue;
      if (getBusinessFunctionDefinitionByIdOrLabel(args[slot])) continue;
      const offered = offerKnownValues({
        command: "/delegation",
        args,
        slot,
        options: labels,
        label: flag === "--from" ? "Which Function needs the help?" : "Which Function should do it?",
        typed: args[slot],
      });
      if (offered) return offered;
    }
  }
  return [
    handleUiDelegationCommand(
      args
    ),
  ];
  }
  
if (command === "/next") {
  clearNextReview();
  const nextEntry = await handleUiNextCommand(args);

  // Interactive operators review the recommended Functions one at a time
  // instead of reading the whole block and answering one yes/no. The pending
  // confirmation handleUiNextCommand set carries the recommendations; hand
  // them to the review and drop the wall-of-text guidance entry. Headless/CI
  // (no TTY) keeps that entry and the single yes/no.
  const pendingNext = readPendingNextConfirmation();
  if (isInteractiveSession() && pendingNext && pendingNext.recommendations.length > 0) {
    clearPendingNextConfirmation();
    return startNextReview(
      pendingNext.enterpriseId,
      pendingNext.enterpriseName,
      pendingNext.recommendations
    );
  }

  return [nextEntry];
}

if (command === "/staff") {
  if (args[0] === "later" || args[0] === "menu" || args[0] === "change") {
    return startLaterStaffMenu({ as: undefined });
  }
  return await handleUiStaffCommand(args);
}

if (command === "/model") {
  return [...await handleUiModelCommand()];
}

if (command === "/suggest") {
  const suggestFunctionRef =
    getUiFlagValue(args, "--function") ?? getUiFlagValue(args, "--job");
  const suggestEnterpriseRef = getUiFlagValue(args, "--enterprise");

  // No Function named: an interactive operator with more than one Function
  // picks from a numbered list rather than a wall of copy-paste flag lines.
  // A single Function is inferred by handleUiSuggestCommand as before.
  if (!suggestFunctionRef && isInteractiveSession()) {
    const choices = suggestFunctionChoices(suggestEnterpriseRef);
    if (choices.length > 1) {
      return startSuggestMenu(choices, suggestEnterpriseRef);
    }
  }

  return [
    await handleUiSuggestCommand(
      suggestFunctionRef,
      suggestEnterpriseRef
    ),
  ];
}

if (command === "/start-functions") {
  // Bare /start-functions: ask for the go-ahead the --ready flag stood for.
  if (args.length === 0 && isInteractiveSession()) {
    return startFunctionsMenu();
  }
  return handleUiStartReadyFunctionsCommand(args);
}
  
if (command === "/worker") {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "inspect") {
    return [
      readWorkerInspectionEntry(
        subcommandArgs
      ),
    ];
  }

  

  return await handleUiWorkerCommand(
    args
  );
}

  return [
    createUnsupportedUiCommandEntry(
      command
    ),
  ];
}
