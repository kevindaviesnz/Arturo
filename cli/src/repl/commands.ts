import { handleWorkerLifecycleCommand } from "./workerLifecycleCommands";
import readline from "readline";

import { Kernel } from "../kernel/kernel";

import {
  handleAskCommand,
} from "./askCommand";

import {
  handleHelpCommand,
} from "./helpCommands";

import {
  handleSetupUserCommand,
} from "./userCommands";

import {
  handleKernelBlogCommand,
  handleRunWorkflowDefinitionCommand,
} from "./kernelWorkflowCommands";

import {
  handleWorkflowDefinitionCommand,
} from "./workflowDefinitionCommands";

import {
  handleKernelClearSnapshotCommand,
  handleKernelLoadCommand,
  handleKernelSaveCommand,
  handleKernelSnapshotStatusCommand,
} from "./kernelSnapshotCommands";

import {
  handleResetCommand,
} from "./resetCommands";

import {
  handleStartWorkflowCommand,
} from "./startWorkflowCommands";

import {
  handleEnterpriseCommand,
} from "./enterpriseCommands";

import {
  handleAddFunctionCommand,
  handleFailFunctionCommand,
  handleFunctionCommand,
  handlePauseFunctionCommand,
  handleResumeFunctionCommand,
  handleStartFunctionCommand,
  handleStopFunctionCommand,
} from "./businessFunctionCommands";

import {
  handleGovernanceCommand,
} from "./governanceCommands";

export {
  resetApplicationState,
} from "./resetCommands";

import {
  handleAddWorkerCommand,
  handlePsCommand,
  handleSpawnCommand,
  handleSpawnReceiverCommand,
  handleSpawnSenderCommand,
  handleTickCommand,
} from "./kernelProcessCommands";

import {
  handleGeneratedWorkflowCommand,
} from "./generatedWorkflowCommand";

import {
  handleKernelDispatchableCallsCommand,
  handleKernelDispatchCommand,
  handleKernelPendingCallsCommand,
  handleKernelResolveCommand,
  handleProcessResultCommand,
} from "./kernelDispatchCommands";

import {
  handleDemoCommand,
  handleRunLogCommand,
  handleRunsCommand,
} from "./runHistoryCommands";

import {
  handleRunCapCommand,
  handleRunCommand,
  handleWorkflowCapCommand,
} from "./manualWorkflowCommands";

import {
  handleWorkerInspectCommand,
  handleWorkersCommand,
} from "./workerInspectionCommands";

import {
  handleJobCommand,
  handleJobOutputCommand,
  handleJobRawCommand,
  handleJobsCommand,
} from "./jobCommands";

import {
  handleTaskCapCommand,
  handleTaskCreateCommand,
} from "./taskRoutingCommands";

import {
  handlePlannerPlanCommand,
  handleTimelineCommand,
  handleWorkflowRunCommand,
  handleWorkflowRunsCommand,
} from "./workflowInspectionCommands";

import {
  handleBlockTaskCommand,
  handleCompleteTaskCommand,
  handleCreateTaskCommand,
  handleHumanTaskCommand,
  handleHumanTasksCommand,
  handleReviseTaskCommand,
} from "./humanTaskCommands";

import {
  handleArtefactCommand,
  handleArtefactsCommand,
} from "./artefactCommands";

import {
  clearBackgroundOutputRepl,
  registerBackgroundOutputRepl,
} from "./backgroundOutput";

import {
  handleRefineWorkerCommand,
} from "./workerRefinementCommands";

import {
  formatUnknownCommandMessage,
  listKnownCommands,
} from "./helpText";

import {
  handleReplayCheckpointCommand,
  handleReplayEventsCommand,
  handleReplayHistoryCommand,
  handleReplayStateCommand,
  handleReplayVerifyCheckpointCommand,
} from "./replayCommands";

import {
  handleMemoryCommand,
} from "./memoryCommands";

import {
  handleEventCommand,
  handleEventsCommand,
} from "./eventCommands";

import {
  handleScheduleCommand,
} from "./scheduleCommands";

import {
  handleHealthCommand,
} from "./healthCommands";

import {
  handleNextCommand,
} from "./nextCommands";

import {
  handleDelegationCommand,
} from "./delegationCommands";

import {
  readModelRoutingEntry,
  readModelsEntry,
} from "../ui/uiModelRoutingEntries";

import {
  readCapabilitiesEntry,
} from "../ui/uiCapabilityEntries";

import {
  handleWebSearchCommand,
} from "../ui/uiWebSearchEntries";
import { runOffTerminalCommand } from "../offterminal/offTerminalCommands";

export {
  formatReplayCheckpointSummary,
  formatReplayCheckpointVerification,
  formatReplayCount,
  formatReplayHistorySummary,
  formatReplayStateSummary,
} from "./replayCommands";

export {
  createDefaultHelpText,
  createFullHelpText,
  findMissingSlashSuggestion,
  formatHelpGroups,
  formatUnknownCommandMessage,
  listKnownCommands,
} from "./helpText";

import {
  handleNotificationCommand,
  handleNotificationsCommand,
} from "./notificationCommands";

import {
  handleAddAiWorkerCommand,
  handleAddHumanWorkerCommand,
} from "./workerRegistrationCommands";

import {
  handleArchetypeCommand,
  handleArchetypesCommand,
} from "./archetypeCommands";

import {
  handleApprovalStatusCommand,
  handleApproveCommand,
  handleRejectCommand,
} from "./approvalCommands";

import {
  handleTaskDetailCommand,
} from "./taskDetailCommands";

import {
  handleRuntimeCommand,
} from "./runtimeCommands";

import {
  handleWorkerCommand,
} from "./workerRegistrationCommands";

/**
 * Starts the REPL.
 *
 * @param kernel Runtime kernel.
 * @returns void
 *
 * SIDE EFFECT: Opens readline prompt and handles user commands.
 */
export function startRepl(
  kernel: Kernel
): void {
  const rl =
    readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "arturo> ",
    });

  registerBackgroundOutputRepl(
    rl,
    process.stdout
  );

  console.log("🧠  shell");
  console.log("Type /help\n");

  rl.prompt();

  rl.on(
    "line",
    async (input: string) => {
      const trimmed =
        input.trim();

      if (!trimmed) {
        rl.prompt();

        return;
      }

      if (trimmed === "/exit") {
        rl.close();

        return;
      }

      try {
        await handleCommand(
          trimmed,
          kernel
        );
      } catch (err) {
        console.log(
          `❌ ${err instanceof Error ? err.message : String(err)}`
        );
      }

      rl.prompt();
    }
  );

  rl.on("close", () => {
    clearBackgroundOutputRepl();

    console.log("\n👋 Exiting ");

    process.exit(0);
  });
}

/**
 * Splits command input into shell-like tokens with quote support.
 *
 * Supports both straight quotes and smart quotes so commands copied
 * from rich text sources still parse correctly.
 *
 * @param input Raw command input.
 * @returns Parsed command tokens.
 *
 * PURE: No side effects.
 */
function parseCommandTokens(
  input: string
): string[] {
  const normalized =
    input
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");

  const matches =
    normalized.match(
      /"([^"]*)"|'([^']*)'|\S+/g
    ) ?? [];

  return matches.map((token) =>
    token.replace(
      /^["']|["']$/g,
      ""
    )
  );
}

/**
 * Handles a single REPL command.
 *
 * @param input Raw REPL command input.
 * @param kernel Runtime kernel.
 * @returns void
 *
 * SIDE EFFECT: May mutate runtime state, kernel state, and broadcast runtime events.
 */
export async function handleCommand(
  input: string,
  kernel: Kernel
): Promise<void> {
  const [cmd, ...args] =
    parseCommandTokens(input);

  switch (cmd) {
    case "/help": {
      handleHelpCommand(
        args
      );

      break;
    }

    case "/models": {
      console.log(
        readModelsEntry().body
      );

      break;
    }

    case "/capabilities": {
      console.log(
        readCapabilitiesEntry(
          args
        ).body
      );

      break;
    }

    case "/model-routing": {
      console.log(
        readModelRoutingEntry().body
      );

      break;
    }

    case "/web-search": {
      console.log(
        handleWebSearchCommand(args).body
      );

      break;
    }

    case "/off-terminal": {
      const outcome = await runOffTerminalCommand(args);
      console.log(outcome.text);
      break;
    }

    case "/kernel-blog": {
      handleKernelBlogCommand(
        kernel,
        args
      );

      break;
    }

    case "/run-workflow-definition": {
      handleRunWorkflowDefinitionCommand(
        kernel,
        args
      );

      break;
    }

    case "/setup-user": {
      handleSetupUserCommand(
        args
      );

      break;
    }

    case "/add-ai-worker": {
      handleAddAiWorkerCommand(
        args
      );

      break;
    }

    case "/workflow-run":
    case "/workflow-worker":
    case "/worker-availability": {
      handleWorkerLifecycleCommand(cmd, args);
      break;
    }

    case "/add-human-worker": {
      handleAddHumanWorkerCommand(
        args
      );

      break;
    }

    case "/ask": {
      await handleAskCommand(
        args
      );

      break;
    }

    case "/workflow": {
      await handleGeneratedWorkflowCommand(
        args
      );

      break;
    }

    case "/job-raw": {
      handleJobRawCommand(
        args
      );

      break;
    }

    case "/jobs": {
      handleFunctionCommand(
        [
          "list",
          ...args,
        ]
      );

      break;
    }

    case "/job": {
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
        handleFunctionCommand(
          args
        );
      } else if (subcommand === "start") {
        handleRuntimeCommand(
          [
            "start",
            ...subcommandArgs,
          ]
        );
      } else {
        handleJobCommand(
          args
        );
      }

      break;
    }

    case "/task": {
      const [
        subcommand,
        ...subcommandArgs
      ] = args;

      if (subcommand === "create") {
        handleTaskCreateCommand(
          subcommandArgs
        );
      } else {
        handleJobCommand(
          subcommand === "inspect"
            ? subcommandArgs
            : args
        );
      }

      break;
    }

    case "/job-output": {
      handleJobOutputCommand(
        args
      );

      break;
    }
      
    case "/approve": {
      handleApproveCommand(
        args
      );

      break;
    }

    case "/tasks": {
      handleJobsCommand(
        args
      );

      break;
    }

    case "/functions": {
      handleFunctionCommand(
        [
          "list",
          ...args,
        ]
      );

      break;
    }

case "/memory": {
  handleMemoryCommand(
    args
  );

  break;
    }
      
      case "/events": {
  handleEventsCommand();

  break;
    }
      
      case "/event": {
  await handleEventCommand(
    args
  );

  break;
}

      case "/schedule": {
  handleScheduleCommand(
    args
  );

  break;
}
      
      case "/health": {
  handleHealthCommand(
    args
  );

  break;
}
      
      
case "/governance": {
  handleGovernanceCommand(
    args
  );

  break;
    }
      
    case "/task-detail": {
      handleTaskDetailCommand(
        args
      );

      break;
    }

    case "/reject": {
      handleRejectCommand(
        args
      );

      break;
    }

    case "/notifications": {
      handleNotificationsCommand();

      break;
    }

    case "/notification": {
      handleNotificationCommand(
        args
      );

      break;
    }

    case "/reset": {
      handleResetCommand();

      break;
    }

    case "/add-worker": {
      handleAddWorkerCommand(
        args
      );

      break;
    }

    case "/spawn": {
      handleSpawnCommand(
        kernel,
        args
      );

      break;
    }

    case "/spawn-receiver": {
      handleSpawnReceiverCommand(
        kernel
      );

      break;
    }

    case "/spawn-sender": {
      handleSpawnSenderCommand(
        kernel
      );

      break;
    }

    case "/tick": {
      handleTickCommand(
        kernel
      );

      break;
    }

    case "/ps": {
      handlePsCommand(
        kernel
      );

      break;
    }

case "/workers": {
  handleWorkersCommand(
    args
  );

  break;
}

case "/next": {
  await handleNextCommand(
    args
  );

  break;
}
      
    case "/workflow-cap": {
      handleWorkflowCapCommand(
        args
      );

      break;
    }

    case "/run-cap": {
      handleRunCapCommand(
        args
      );

      break;
    }

    case "/run": {
      handleRunCommand(
        args
      );

      break;
    }

    case "/demo": {
      handleDemoCommand();

      break;
    }

    case "/runs": {
      handleRunsCommand();

      break;
    }

    case "/run-log": {
      handleRunLogCommand(
        args
      );

      break;
    }

    case "/kernel-resolve": {
      handleKernelResolveCommand(
        kernel,
        args
      );

      break;
    }

    case "/kernel-pending-calls": {
      handleKernelPendingCallsCommand(
        kernel
      );

      break;
    }

    case "/kernel-dispatchable-calls": {
      handleKernelDispatchableCallsCommand(
        kernel
      );

      break;
    }

    case "/kernel-dispatch": {
      handleKernelDispatchCommand(
        kernel,
        args
      );

      break;
    }

    case "/enterprise": {
      handleEnterpriseCommand(
        args
      );

      break;
    }

    case "/function": {
      handleFunctionCommand(
        args
      );

      break;
    }

    case "/process-result": {
      handleProcessResultCommand(
        kernel,
        args
      );

      break;
    }

    case "/workflow-definition": {
      handleWorkflowDefinitionCommand(
        args
      );

      break;
    }

    case "/kernel-save": {
      handleKernelSaveCommand(
        kernel
      );

      break;
    }

    case "/kernel-load": {
      handleKernelLoadCommand(
        kernel
      );

      break;
    }

    case "/kernel-clear-snapshot": {
      handleKernelClearSnapshotCommand(
        kernel
      );

      break;
    }

    case "/kernel-snapshot-status": {
      handleKernelSnapshotStatusCommand(
        kernel
      );

      break;
    }

    case "/approval-status": {
      handleApprovalStatusCommand(
        args
      );

      break;
    }

    case "/replay-events": {
      handleReplayEventsCommand();

      break;
    }

    case "/replay-state": {
      handleReplayStateCommand();

      break;
    }

    case "/replay-checkpoint": {
      handleReplayCheckpointCommand();

      break;
    }

    case "/replay-verify-checkpoint": {
      handleReplayVerifyCheckpointCommand();

      break;
    }

    case "/replay-history": {
      handleReplayHistoryCommand();

      break;
    }

    case "/archetypes": {
      handleArchetypesCommand();

      break;
    }

    case "/archetype": {
      handleArchetypeCommand(
        args
      );

      break;
    }

    case "/workflow-runs": {
      handleWorkflowRunsCommand();

      break;
    }

    case "/workflow-run": {
      handleWorkflowRunCommand(
        args
      );

      break;
    }

    case "/planner-plan": {
      handlePlannerPlanCommand(
        args
      );

      break;
    }

    case "/timeline": {
      handleTimelineCommand(
        args
      );

      break;
    }

    case "/create-human-task": {
      handleCreateTaskCommand(
        args
      );

      break;
    }

    case "/artefact": {
      handleArtefactCommand(
        args
      );

      break;
    }

    case "/artefacts": {
      handleArtefactsCommand(
        args
      );

      break;
    }

    case "/human-tasks": {
      handleHumanTasksCommand();

      break;
    }

    case "/human-task": {
      handleHumanTaskCommand(
        args
      );

      break;
    }

    case "/complete-human-task": {
      handleCompleteTaskCommand(
        args
      );

      break;
    }

    case "/block-task": {
      handleBlockTaskCommand(
        args
      );

      break;
    }

    case "/revise-task": {
      handleReviseTaskCommand(
        args
      );

      break;
    }

    case "/refine-worker": {
      handleRefineWorkerCommand(
        args
      );

      break;
    }

    case "/start": {
      handleStartWorkflowCommand(
        args
      );

      break;
    }

    case "/add-function": {
      handleAddFunctionCommand(
        args
      );

      break;
    }

    case "/start-function": {
      handleStartFunctionCommand(
        args
      );

      break;
    }

    case "/pause-function": {
      handlePauseFunctionCommand(
        args
      );

      break;
    }

    case "/resume-function": {
      handleResumeFunctionCommand(
        args
      );

      break;
    }

    case "/stop-function": {
      handleStopFunctionCommand(
        args
      );

      break;
    }

    case "/fail-function": {
      handleFailFunctionCommand(
        args
      );

      break;
    }

      case "/worker": {
  handleWorkerCommand(
    args
  );
  
  break;
    }
      
      case "/delegation": {
  handleDelegationCommand(
    args
  );

  break;
}
    default: {
      console.log(
        formatUnknownCommandMessage(
          cmd,
          listKnownCommands()
        )
      );
    }
  }
}
