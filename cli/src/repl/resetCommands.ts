import { clearSignIn } from "../identity/companySignIn";
import { clearWebSearchSwitches } from "../runtime/webSearchSwitch";
import { clearPassOns } from "../runtime/passOnRules";
import { clearResultSetAsides } from "../runtime/resultSetAside";
import { clearClients } from "../clients/clientStore";
import { clearWork } from "../work/workStore";
import { clearPracticeSettings } from "../work/practiceSetting";
import { clearWorkSends } from "../work/workSendLog";
import { clearNextActions } from "../runtime/nextActions";
import { clearProviderSends } from "../runtime/providerSendLog";
import { clearHandOffs } from "../runtime/handOff";
import { clearFunctionChecks } from "../business/functionChecks";
import { clearFunctionOrigins } from "../business/functionOrigin";
import {
  clearPolicyRules,
} from "../storage/policyRepository";

import {
  clearWorkflows,
} from "../control/workflows";

import {
  clearWorkers,
  initializeDefaultWorkers,
} from "../control/workers";

import {
  clearRuns,
} from "../control/runStore";

import {
  clearWorkflowRuns,
} from "../runtime/workflowRunStore";

import {
  clearJobs,
} from "../runtime/jobQueue";

import {
  clearApprovalChains,
} from "../runtime/approvalChainStore";

import {
  clearResultSignOffs,
} from "../runtime/resultSignOff";

import {
  clearWatchedFolders,
} from "../intake/watchedFolderRuntime";

import {
  clearEvents,
} from "../control/eventStore";

import {
  clearNotifications,
} from "../runtime/notificationStore";

import {
  clearHumanTasks,
} from "../runtime/humanTaskStore";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  clearEnterprises,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  clearOperationalMemory,
} from "../memory/operationalMemoryStore";
import { clearRuntimeEventStore } from "../runtime/runtimeEventStore";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import { clearAllWorkerChatMessages } from "../storage/workerChatRepository";
import { endWorkerChat } from "../chat/workerChat";
import { resetModelRoutingUsage } from "../llm/modelRouting";
import { clearDelegationRequests } from "../delegation/delegationStore";
import { clearArtefacts } from "../artefacts/artefactStore";
import { resetWebSearchSessionUsage } from "../integrations/webSearch";
import { clearJobCompletionEventRules } from "../events/jobCompletionEventRuleStore";
import { clearEventSchedules } from "../scheduling/eventScheduleStore";
import { clearOffTerminalLinks } from "../offterminal/offTerminalLinks";
import { clearOffTerminalPath } from "../offterminal/offTerminalPathState";
import { clearVerifiedEmails } from "../offterminal/verifiedEmail";
import { clearPasskeys } from "../offterminal/passkeys";
import { clearSignOffSessions } from "../offterminal/signOffPages";
import { clearRealPersonTest } from "../offterminal/realPersonTest";

/**
 * Resets application-level runtime state to initial first-use state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears runtime stores.
 * - Clears human tasks.
 * - Restores the default operator worker.
 */
export function resetApplicationState(): void {
  clearWorkers();
  initializeDefaultWorkers();
clearOperationalMemory();
  clearWorkflows();
  clearRuns();
  clearWorkflowRuns();
  clearEnterprises();
clearBusinessFunctionDefinitions();
clearBusinessFunctions();
  clearStaffingAssignments();
  clearJobs();
  clearApprovalChains();
  clearResultSignOffs();
  clearResultSetAsides();
  clearWatchedFolders();
  clearHandOffs();
  clearFunctionChecks();
  clearFunctionOrigins();
  clearPassOns();
  clearSignIn();
  clearEvents();
  clearNotifications();
  clearHumanTasks();
  clearRuntimeEventStore();
  clearAllWorkerChatMessages();
  endWorkerChat();
  resetModelRoutingUsage();
  resetWebSearchSessionUsage();
  clearJobCompletionEventRules();
  clearEventSchedules();
  clearDelegationRequests();
  clearArtefacts();
  // Governance rules are stored separately from the runtime database. Leaving
  // them behind meant a "first-use state" reset silently kept every previously
  // defined allow, deny, and require-approval rule.
  clearPolicyRules();
  clearClients();
  clearWork();
  clearPracticeSettings();
  clearWebSearchSwitches();
  clearWorkSends();
  clearProviderSends();
  clearNextActions();
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearVerifiedEmails();
  clearPasskeys();
  clearSignOffSessions();
  clearRealPersonTest();
}

/**
 * Handles the /reset command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Resets application runtime state.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleResetCommand(): void {
  resetApplicationState();

  console.log(
    "application reset to initial state"
  );

  broadcastEvent(
    "runtime.reset",
    "success",
    "Application reset to initial state"
  );
}
