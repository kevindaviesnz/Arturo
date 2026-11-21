import {
  handleUiCommand,
  handleUiNextConfirmation,
  handleUiResetConfirmation,
  abandonCommandMenu,
  isCommandMenuActive,
  handleCommandMenuReply,
  isNextReviewActive,
  handleNextReviewReply,
  clearNextReview,
} from "./uiCommandHandlers";
import { clearStaffReview, handleUiStaffConfirmation, isStaffReviewActive, handleStaffReviewReply } from "./uiStaffingEntries";
import { handleUiSuggestConfirmation } from "./uiSuggestEntries";
import { clearPendingModelState, handleUiModelReply, isModelMenuActive } from "./uiModelEntries";
import { abandonAddHumanWorkerFlow, handleAddHumanWorkerReply, isAddHumanWorkerFlowActive } from "./uiAddHumanWorkerFlow";
import { captureUiCommandOutput } from "./uiConsoleCapture";
import { handleTaskCreateCommand } from "../repl/taskRoutingCommands";
import { parseUiInput, type ParsedUiInput, type WorkStreamEntry } from "./uiState";
import { createUnhandledInputEntry } from "./uiUnhandledInput";
import { handleUiWorkerChatContinuation } from "./uiWorkerChatEntries";
import { handleUiAdviseContinuation } from "./uiAdviseEntries";

/**
 * How a submitted line was consumed.
 *
 * The terminal does not need this — it prints the entries either way. A driver
 * does: a scripted reply that lands on "unhandled" means the script and the
 * product have drifted apart, and that is worth saying out loud rather than
 * leaving as a "Not a command" entry scrolling past.
 */
export type UiLineRoute =
  | "guided-flow"
  | "confirmation"
  | "model-continuation"
  | "advise-continuation"
  | "worker-chat"
  | "command"
  | "unhandled";

export type UiLineRouteResult = {
  readonly entries: readonly WorkStreamEntry[];
  readonly route: UiLineRoute;
};

/** The lines the interface handles itself, before any routing. PURE. */
export type UiLineControl = "empty" | "exit" | "clear" | "route";

/**
 * Classifies a submitted line.
 *
 * PURE: No side effects.
 */
export function classifyUiLine(
  submitted: string
): UiLineControl {
  const trimmed = submitted.trim();
  if (!trimmed) return "empty";
  if (trimmed === "/exit" || trimmed === "/quit") return "exit";
  if (trimmed === "/clear") return "clear";
  return "route";
}

/**
 * Ends every half-answered question, because a command answered none of them.
 *
 * Each flow in the precedence chain above can be left open by a command and
 * then claim the *next* plain line, which belongs to something else entirely.
 * That is not hypothetical: a half-added person outlived `/staff` and answered
 * the "yes" confirming the staffing plan, so the Workers were never applied and
 * a Task failed several steps later for having nobody to do it.
 *
 * Chat and advise are deliberately absent. They are conversations rather than
 * half-finished forms — plain text is their content, and they have their own
 * way out (`/chat end`), so a command typed during one is not an abandonment.
 *
 * Returns what was open, or undefined so the caller adds no noise.
 *
 * SIDE EFFECT: Clears whichever flow state was set.
 */
function endOpenQuestion(): string | undefined {
  const open =
    abandonCommandMenu() ??
    abandonAddHumanWorkerFlow() ??
    (isStaffReviewActive() ? "reviewing the suggested team" : undefined) ??
    (isNextReviewActive() ? "reviewing the suggested Functions" : undefined) ??
    (isModelMenuActive() ? "choosing a model" : undefined);
  // Cleared unconditionally: naming the first one open is for the operator,
  // but leaving a second one set would reintroduce the same bug behind it.
  clearStaffReview();
  clearNextReview();
  clearPendingModelState();
  return open;
}

/**
 * The words that answer an open question rather than starting something: the
 * menu's own exits, the yes/no confirmations, and a numbered pick.
 *
 * None of them is a command. Typing one with a leading slash is a slip an
 * operator makes constantly, because every other line they type has one.
 */
const SLASH_PREFIXED_REPLY =
  /^\/(?:skip|cancel|yes|no|y|n|\d+)$/i;

/** Whether some flow is waiting on the operator's next plain reply. */
export function isGuidedFlowOpen(): boolean {
  return (
    isAddHumanWorkerFlowActive() ||
    isCommandMenuActive() ||
    isModelMenuActive() ||
    isStaffReviewActive() ||
    isNextReviewActive()
  );
}

/**
 * Classifies a submitted line, forgiving a slash typed in front of an answer.
 *
 * `parseUiInput` treats a leading slash as a command unconditionally, so during
 * an open menu `/skip` was routed to the command branch: the flow was abandoned,
 * every answer already collected was discarded along with staff review, next
 * review and pending model state, and the operator was told "The terminal UI
 * does not handle /skip yet." The whole slash namespace behaved that way —
 * `/cancel`, `/yes`, `/1` all destroyed work in progress.
 *
 * Only the fixed reply words above are forgiven, and only while something is
 * actually waiting for an answer. A real command still ends the flow as before,
 * which is the behaviour the operator means when they type one.
 *
 * PURE: Reads flow state; does not mutate it.
 */
function readSubmittedLine(
  submitted: string
): ParsedUiInput {
  const parsed =
    parseUiInput(submitted);

  // Enter on its own, with a question open, is an empty answer rather than
  // nothing at all. parseUiInput calls it "empty", which the precedence chain
  // below skips because it only routes an "ask" — so the prompts that stopped
  // advertising "or type skip" had no way past them at all.
  if (
    parsed.kind === "empty" &&
    isGuidedFlowOpen()
  ) {
    return {
      kind: "ask",
      request: "",
    };
  }

  if (
    parsed.kind === "command" &&
    parsed.args.length === 0 &&
    SLASH_PREFIXED_REPLY.test(parsed.command) &&
    isGuidedFlowOpen()
  ) {
    return {
      kind: "ask",
      request: parsed.command.slice(1),
    };
  }

  return parsed;
}

/**
 * Routes one submitted line through the precedence chain the terminal uses.
 *
 * This lived inside the readline callback and was reachable nowhere else, which
 * meant anything driving Arturo programmatically could only call
 * `handleUiCommand` — enough to type a command, but not enough to answer a
 * single guided-menu question. Sharing one chain is what keeps a bot-driven
 * session and a person's session identical.
 *
 * The order is load-bearing and is preserved exactly: an open guided flow owns
 * the next plain-text reply ahead of any stale yes/no confirmation, because it
 * is the most specific thing the operator is answering.
 *
 * SIDE EFFECT: Runs the command and mutates whichever flow state claims it.
 */
export async function routeUiLine(
  submitted: string
): Promise<UiLineRouteResult> {
  const parsed = readSubmittedLine(submitted);

  const guidedFlow = parsed.kind === "ask" && isAddHumanWorkerFlowActive()
    ? handleAddHumanWorkerReply(parsed.request)
    : parsed.kind === "ask" && isCommandMenuActive()
      ? await handleCommandMenuReply(parsed.request)
      : parsed.kind === "ask" && isModelMenuActive()
        ? await handleUiModelReply(parsed.request)
        : parsed.kind === "ask" && isStaffReviewActive()
          ? await handleStaffReviewReply(parsed.request)
          : parsed.kind === "ask" && isNextReviewActive()
            ? handleNextReviewReply(parsed.request)
            : undefined;
  const confirmation = parsed.kind === "ask" && !guidedFlow
    ? handleUiResetConfirmation(parsed.request)
      ?? handleUiNextConfirmation(parsed.request)
      ?? handleUiStaffConfirmation(parsed.request)
      ?? handleUiSuggestConfirmation(
        parsed.request,
        (taskArgs) => captureUiCommandOutput(
          "Task created",
          () => handleTaskCreateCommand(taskArgs)
        )
      )
    : undefined;
  const modelContinuation = parsed.kind === "ask" && !guidedFlow && !confirmation
    ? await handleUiModelReply(parsed.request)
    : undefined;
  const adviseContinuation = parsed.kind === "ask" && !guidedFlow && !confirmation && !modelContinuation
    ? await handleUiAdviseContinuation(parsed.request)
    : undefined;
  const chatContinuation = parsed.kind === "ask" && !guidedFlow && !confirmation && !modelContinuation && !adviseContinuation
    ? await handleUiWorkerChatContinuation(parsed.request)
    : undefined;

  if (parsed.kind === "command") {
    // A command answers nothing that was asked, so the open flow ends here.
    // It always did; it just used to end in silence.
    //
    // Both flows, not just the menu. The add-human-worker flow sits first in
    // the precedence chain above, so one left open outlives the command and
    // then captures the next plain reply meant for something else: a half-added
    // person swallowed the "yes" confirming a staffing plan, the staffing was
    // never applied, and the Task that needed those Workers failed several
    // steps later with "no Worker assigned to it".
    const abandoned = endOpenQuestion();
    const entries = await handleUiCommand(parsed.command, parsed.args);
    return {
      entries: abandoned
        ? [
            {
              actor: "Arturo",
              label: "Stopped part-way",
              body: `You were ${abandoned}. That is not saved — nothing was created.`,
            },
            ...entries,
          ]
        : entries,
      route: "command",
    };
  }
  if (guidedFlow) return { entries: guidedFlow, route: "guided-flow" };
  if (confirmation) return { entries: confirmation, route: "confirmation" };
  if (modelContinuation) {
    return { entries: modelContinuation, route: "model-continuation" };
  }
  if (adviseContinuation) {
    return { entries: adviseContinuation, route: "advise-continuation" };
  }
  if (chatContinuation) {
    return { entries: [chatContinuation], route: "worker-chat" };
  }
  return {
    entries: [
      createUnhandledInputEntry(
        parsed.kind === "ask" ? parsed.request : ""
      ),
    ],
    route: "unhandled",
  };
}
