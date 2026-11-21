import { readFileSync } from "node:fs";

import type { BotRunMode } from "./botArgs";
import type { ReadlineBotTerminal } from "./botTerminal";
import type { WorkStreamEntry } from "../ui/uiState";

import {
  parseBotPlan,
  planResetsState,
} from "./botPlanSource";

import {
  createBotScriptedSource,
} from "./botScriptedSource";

import {
  createBotAutoSource,
} from "./botAutoSource";

import {
  generateWithConfiguredLlm,
} from "../llm/llmClient";

import {
  getModelRoutingStatus,
} from "../llm/modelRouting";

import {
  getSelectedModel,
} from "../llm/modelSelection";

import {
  readSetupState,
} from "../ui/uiSetupProgress";

import {
  runBotSession,
} from "./botDriver";

import {
  BOT_OPERATOR_NAME,
} from "./botOperator";

import {
  isAddHumanWorkerFlowActive,
} from "../ui/uiAddHumanWorkerFlow";

import {
  isCommandMenuActive,
  isNextReviewActive,
} from "../ui/uiCommandHandlers";

import {
  isStaffReviewActive,
} from "../ui/uiStaffingEntries";

import {
  isModelMenuActive,
} from "../ui/uiModelEntries";

import {
  getActiveAdviseSession,
} from "../ui/uiAdviseEntries";

import {
  getActiveWorkerChat,
} from "../chat/workerChat";

/**
 * Whether Arturo is currently waiting for an answer rather than a command.
 *
 * This is the list `routeUiLine` consults, in the same order. Missing one is
 * not cosmetic: the autonomous source chooses its whole vocabulary from this
 * answer, so a flow left out here means it types a command at a question. The
 * first live run did exactly that — `/enterprise` opened a guided conversation,
 * the advise session was not on this list, and every answer the model gave was
 * refused with "A command has to start with /".
 */
export function isAnyFlowOpen(): boolean {
  return (
    isAddHumanWorkerFlowActive() ||
    isCommandMenuActive() ||
    isModelMenuActive() ||
    isStaffReviewActive() ||
    isNextReviewActive() ||
    getActiveAdviseSession() !== undefined ||
    getActiveWorkerChat() !== undefined
  );
}

/**
 * The line that closes whatever Arturo is currently waiting on.
 *
 * The guided menus and reviews all take "cancel". A worker chat does not — it
 * takes plain text as a message and leaves through `/chat end`, so "cancel" is
 * a question put to the model, answered at the cost of a model call.
 */
export function closeOpenFlowLine(): string {
  return getActiveWorkerChat() ? "/chat end" : "cancel";
}

function entry(label: string, body: string): WorkStreamEntry {
  return { actor: "Arturo", label, body };
}

/** Said before the first line of any run that may sign off governed work. */
function approvalWarning(): string {
  return [
    // "may", not "will": a script whose approve lines name a person — which is
    // how the scenario plans are written — signs nothing itself, and the closing
    // note says which of the two actually happened.
    `${BOT_OPERATOR_NAME} may sign off work in this run.`,
    "",
    "Normally a person has to approve that work. Here a script does it",
    "instead, so nobody has actually checked it. The record says so: this",
    "name — not a person's — is the one saved with the decision, and it is",
    "what you will see in /approvals, /approval-status and /timeline.",
    "It is added to your team the moment it is first needed, not now: most",
    "runs open with /reset, which would delete it again.",
  ].join("\n");
}

/**
 * Refuses a run that would spend money without being asked to.
 *
 * Unconditional across both modes, for the same reason the approval guard is:
 * a guard that applied to autonomous runs only was how a script came to sign a
 * decision under a real person's name. A scripted plan is no cheaper than an
 * autonomous one — every model-backed step in it bills the same.
 *
 * The cost is not theoretical and not capped. `generateWithConfiguredLlm`
 * dispatches on the `/model` selection before it looks at the model it was
 * handed, so a paid selection reaches the bot's own line-choosing as well as
 * the Tasks it creates; and an explicit selection is deliberately exempt from
 * `maxPaidCallsPerSession`, which caps only *automatic* escalation. That
 * exemption assumes a person typing commands and watching what they cost. A bot
 * is neither.
 *
 * PURE: reads the persisted selection; no side effects of its own.
 */
export function refusePaidModelRun(
  mayUsePaidModel: boolean
): string | undefined {
  const selected = getSelectedModel();
  if (!selected || selected.provider === "ollama") return undefined;
  if (mayUsePaidModel) return undefined;
  return [
    `Your model is set to ${selected.model}, which is paid and runs online.`,
    "",
    "A bot run makes model calls on its own, as fast as it can, for as long as",
    "it lasts — and a model you picked yourself is not covered by Arturo's cap",
    "on automatic paid use. Nothing would stop the spend.",
    "",
    "Nothing has been typed. Either:",
    "  · run /model and choose a free model that runs on this computer, or",
    "  · start again with --paid if you meant to spend money on this run.",
  ].join("\n");
}

/** Said before the first line of a run that was allowed to spend money. */
function paidModelWarning(model: string): string {
  return [
    `This run is using ${model}, a paid model, and will spend money.`,
    "",
    "Every line the bot types that needs the model is a billed call, and so is",
    "every Task it creates. Arturo's cap on automatic paid use does not apply",
    "to a model you chose yourself. Watch it, or stop it with Ctrl+C.",
  ].join("\n");
}

/**
 * Starts a bot run against an already-open interface.
 *
 * SIDE EFFECT: Types into the terminal, which runs commands and mutates state.
 */
export async function startBotRun(
  mode: Extract<BotRunMode, { kind: "scripted" | "auto" }>,
  terminal: ReadlineBotTerminal,
  handBack: () => void,
  formatLineInterfaceDisplayEntry: (entry: WorkStreamEntry) => string
): Promise<void> {
  try {
    const paidRefusal = refusePaidModelRun(mode.mayUsePaidModel);
    if (paidRefusal) {
      terminal.note(entry("This run would spend money", paidRefusal));
      return;
    }
    const paidSelection = getSelectedModel();
    if (paidSelection && paidSelection.provider !== "ollama" && !mode.quiet) {
      terminal.note(
        entry("This run spends money", paidModelWarning(paidSelection.model))
      );
    }
    if (mode.kind === "auto") {
      terminal.note(
        entry(
          "Bot mode — autonomous",
          [
            `What it is trying to do: ${mode.goal}`,
            "",
            "Arturo is picking its own commands, using the model you chose with",
            "/model. This is a demonstration of Arturo driving itself, not a test",
            "of how good it is: a small model on your own computer will sometimes",
            "choose badly, and you will watch it get itself back on track. When a",
            "suggestion is turned down, you see that too.",
            "",
            `It stops after ${mode.maxTurns} turns, or ${mode.maxMinutes} minutes.`,
            "It will never run /reset or delete anything, whatever it suggests —",
            "but everything else it does is real and stays here afterwards. To keep",
            "it out of your own work, run npm run ui:bot:isolated instead.",
            "",
            "Press any key to pause, Ctrl+C to stop.",
          ].join("\n")
        )
      );
      if (mode.mayApprove && !mode.quiet) {
        terminal.note(entry("This run may approve its own work", approvalWarning()));
      }

      await runBotSession({
        source: createBotAutoSource({
          goal: mode.goal,
          dependencies: {
            async generate(prompt) {
              const { response } = await generateWithConfiguredLlm({
                model: getModelRoutingStatus().localModel,
                prompt,
              });
              return response;
            },
            readState: readSetupState,
            isFlowOpen: isAnyFlowOpen,
            note: (label, body) => terminal.note(entry(label, body)),
          },
        }),
        terminal,
        mode,
        isFlowOpen: isAnyFlowOpen,
        closeOpenFlowLine,
      });
      return;
    }

    const planText = readFileSync(mode.planPath, "utf8");
    const directives = parseBotPlan(planText);

    if (planResetsState(directives) && !mode.assumeYes) {
      terminal.note(
        entry(
          "This script erases local Arturo state",
          [
            `${mode.planPath} starts with /reset, which deletes everything you`,
            "have here — businesses, Functions, Workers, Tasks, approvals, the lot.",
            "",
            "Nothing has happened yet. Stop with Ctrl+C, or start again with:",
            "  npm run ui:bot:isolated      use a throwaway data directory",
            "  npm run ui bot -- --yes      go ahead against this installation",
          ].join("\n")
        )
      );
      return;
    }

    if (mode.mayApprove && !mode.quiet) {
      terminal.note(entry("This run may approve its own work", approvalWarning()));
    }

    if (!mode.quiet) {
    terminal.note(
      entry(
        "Bot mode — scripted",
        [
          `Arturo is following the script in ${mode.planPath}.`,
          "Nothing you see typed here was typed by a person.",
          "Press any key to pause, Ctrl+C to stop.",
        ].join("\n")
      )
    );
    }

    await runBotSession({
      source: createBotScriptedSource(
        directives,
        mode.planPath,
        // Capture from what the operator reads: the plans' patterns were all
        // written against the rendered columns.
        formatLineInterfaceDisplayEntry
      ),
      terminal,
      mode,
      isFlowOpen: isAnyFlowOpen,
      closeOpenFlowLine,
    });
  } catch (error) {
    terminal.note(
      entry(
        "Bot stopped",
        error instanceof Error ? error.message : String(error)
      )
    );
  } finally {
    handBack();
  }
}
