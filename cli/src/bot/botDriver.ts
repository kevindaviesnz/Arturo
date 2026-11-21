import type { WorkStreamEntry } from "../ui/uiState";
import type { BotRunMode } from "./botArgs";
import type { BotTerminal } from "./botTerminal";

import {
  attributeBotApproval,
  BOT_OPERATOR_NAME,
  ensureBotOperatorRegistered,
  isBotOperatorRegistered,
  isResultSignOffLine,
} from "./botOperator";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  hasWorkInFlight,
} from "../runtime/jobQueue";

/** One thing the bot does on a turn. */
export type BotAction =
  | { readonly kind: "line"; readonly line: string }
  | { readonly kind: "staff"; readonly line: string }
  | { readonly kind: "wait"; readonly seconds: number }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "stop"; readonly reason: string };

export type BotTurn = {
  readonly line: string;
  readonly entries: readonly WorkStreamEntry[];
  readonly failed: boolean;
};

export type BotTurnContext = {
  readonly turn: number;
  readonly history: readonly BotTurn[];
  readonly last?: BotTurn;
};

export type BotInputSource = {
  /** One line describing what is driving this run, for the banner. */
  readonly describe: string;
  /** The next action, or undefined when the source is finished. */
  next(context: BotTurnContext): Promise<BotAction | undefined>;
};

export type BotSessionSummary = {
  readonly turns: number;
  readonly failures: number;
  readonly stopReason: string;
};

/**
 * Commands the bot is never allowed to run from a model.
 *
 * A scripted plan is something the operator chose and can read; a model's next
 * guess is not. `/reset` is the sharp one — an autonomous run that erases the
 * installation because the model thought it would be a tidy way to start would
 * be unforgivable, and no goal is worth that risk.
 */
const AUTO_DENIED = [
  "/reset",
  "/workers remove",
  "/memory remove",
  "/function remove",
];

/** Whether a model-proposed line is refused outright. PURE. */
export function isDeniedAutoLine(
  line: string
): string | undefined {
  const normalised = line.trim().toLowerCase();
  const denied = AUTO_DENIED.find((command) => normalised.startsWith(command));
  return denied ? `The bot is not allowed to run ${denied}.` : undefined;
}

/**
 * Whether an approve or reject line is refused because the run may not sign.
 *
 * Applied to **every** line the bot submits, from a plan as much as from a
 * model. This was an auto-mode-only check, and the hole it left was the exact
 * failure the whole arrangement exists to prevent: scenario 001 contains
 * `/approve {{TASK_ID}}`, so a scripted run without `--approve` typed it bare,
 * `resolveApprovalCommandIdentity` auto-selected the sole eligible human, and
 * the record read `Approved by Publication Reviewer` — a script signing as a
 * named person, inside the HMAC — while the closing summary said nothing had
 * been approved.
 *
 * PURE: No side effects.
 */
export function refuseUnauthorisedApproval(
  line: string,
  mayApprove: boolean
): string | undefined {
  if (mayApprove || !isApprovalLine(line)) return undefined;
  return [
    "This run was not started with --approve, so it is not allowed to sign work off.",
    "Nothing was typed. Had it been, the sign-off would have been saved under the",
    "name of the one person here who is allowed to approve — as though they had",
    "made the decision themselves.",
  ].join("\n");
}

/** Whether an entry reads as a refusal or failure. PURE. */
export function turnFailed(
  entries: readonly WorkStreamEntry[]
): boolean {
  return entries.some(
    (entry) =>
      /\b(refused|not created|not found|not added|not changed|failed|error|unknown option|no Worker assigned)\b/i
        .test(entry.label) ||
      /^Usage$/i.test(entry.label.trim())
  );
}

function noteEntry(label: string, body: string): WorkStreamEntry {
  return { actor: "Arturo", label, body };
}

/**
 * Whether a line asks Arturo to decide a governed Task.
 *
 * The whole first token, not a prefix: `/approvals` and `/approval-status` both
 * begin with `/approve` and are harmless reads.
 *
 * PURE: No side effects.
 */
function isApprovalLine(line: string): boolean {
  const command = line.trim().split(/\s+/)[0]?.toLowerCase();
  return (
    command === "/approve" ||
    command === "/reject" ||
    isResultSignOffLine(line)
  );
}

const sleepFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** How often a wait checks whether the work has finished. */
const SETTLE_POLL_MS = 250;

/**
 * How long a wait gives the work to appear before deciding there is none.
 *
 * A Task is queued by the command that created it, so in practice it is in
 * flight the moment `submit` resolves. This covers the case where it is not
 * yet — without it, a wait would look once, see nothing, and type the next
 * line into a screen that is about to fill up.
 */
const SETTLE_START_WINDOW_MS = 2000;

/**
 * How long after the last job settles before the run carries on.
 *
 * The status changes fractionally before the result is rendered, and typing
 * over the top of a result that is still arriving reads as a glitch.
 */
const SETTLE_GRACE_MS = 600;

/**
 * Waits for Arturo to finish what it is doing, up to a ceiling.
 *
 * A plan's `@wait 240` used to be 240 seconds of a still screen whatever the
 * model did — the number had to cover the slowest case, so every run paid the
 * worst case. It is a **ceiling** now: the wait ends as soon as nothing is
 * queued or running.
 *
 * Both loops are bounded by a **count of polls** rather than by the clock. A
 * test injects an instant `sleep`, and a wall-clock bound would then spin for
 * the whole window burning real seconds; against a real sleep the two are the
 * same thing.
 *
 * SIDE EFFECT: Sleeps. Reads job state through the injected predicate.
 */
export async function waitForWorkToSettle(input: {
  readonly ceilingMs: number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly isWorkInFlight: () => boolean;
  readonly pollMs?: number;
  readonly startWindowMs?: number;
  readonly graceMs?: number;
}): Promise<{ readonly polls: number; readonly hitCeiling: boolean }> {
  const pollMs = Math.max(1, input.pollMs ?? SETTLE_POLL_MS);
  const startWindowMs = input.startWindowMs ?? SETTLE_START_WINDOW_MS;
  const graceMs = input.graceMs ?? SETTLE_GRACE_MS;
  const ceilingPolls = Math.ceil(input.ceilingMs / pollMs);
  const startPolls = Math.min(Math.ceil(startWindowMs / pollMs), ceilingPolls);
  let polls = 0;

  // Wait for the work to show up, but not for long: if nothing starts, there
  // was nothing to wait for and the run should carry straight on.
  while (!input.isWorkInFlight() && polls < startPolls) {
    await input.sleep(pollMs);
    polls += 1;
  }

  // The grace period is re-checked rather than trusted, because a Task can
  // queue the next one as it finishes. Blueprint 1 is exactly that shape — the
  // triage completes and the reply is queued off the back of it — and a wait
  // that stopped at the gap between them would type over the second one.
  for (;;) {
    while (input.isWorkInFlight()) {
      if (polls >= ceilingPolls) {
        return { polls, hitCeiling: true };
      }
      await input.sleep(pollMs);
      polls += 1;
    }

    await input.sleep(graceMs);
    if (!input.isWorkInFlight()) {
      return { polls, hitCeiling: false };
    }
    if (polls >= ceilingPolls) {
      return { polls, hitCeiling: true };
    }
  }
}

/**
 * Runs a bot session: fetch an action, type it, read the result, repeat.
 *
 * SIDE EFFECT: Types into the terminal, which runs commands and mutates state.
 */
export async function runBotSession(input: {
  readonly source: BotInputSource;
  readonly terminal: BotTerminal;
  readonly mode: Extract<BotRunMode, { kind: "scripted" | "auto" }>;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Whether a Task is queued or running. Injected so tests do not need one. */
  readonly isWorkInFlight?: () => boolean;
  readonly isFlowOpen?: () => boolean;
  /** The line that closes whatever is currently open. Defaults to "cancel". */
  readonly closeOpenFlowLine?: () => string;
  /** Records the run in the timeline. Injected so tests do not write events. */
  readonly emit?: (type: string, message: string) => void;
  /** Registers the approver. Injected so tests do not write the registry. */
  readonly ensureApprover?: () => void;
}): Promise<BotSessionSummary> {
  const sleep = input.sleep ?? sleepFor;
  const isWorkInFlight = input.isWorkInFlight ?? hasWorkInFlight;
  const emit =
    input.emit ?? ((type: string, message: string) => broadcastEvent(type, "warn", message));
  const ensureApprover =
    input.ensureApprover ??
    (() => {
      if (!isBotOperatorRegistered()) {
        ensureBotOperatorRegistered({ staffAllFunctions: true });
      }
    });
  const history: BotTurn[] = [];
  let failures = 0;
  // Consecutive, not cumulative. Counting every refusal a run ever had ends a
  // 25-turn session on its third bad guess, however much it got right in
  // between — and reports it as "three in a row", which it was not.
  let consecutiveFailures = 0;
  let refusedApprovals = 0;
  // Counted, not inferred from the flag: --approve says the bot *may* sign, not
  // that it did. A script whose every approve line names a person — which is how
  // the scenario plans are written — signs nothing itself.
  let botSignedApprovals = 0;
  let stopReason = "the script finished";
  const startedAt = Date.now();

  emit(
    "bot.session_started",
    `Bot session started — ${input.source.describe}. Nothing in this session was typed by a person.`
  );

  for (let turn = 1; ; turn += 1) {
    if (input.terminal.stopRequested()) {
      stopReason = "you stopped it";
      break;
    }
    await input.terminal.waitWhilePaused();
    if (input.terminal.stopRequested()) {
      stopReason = "you stopped it";
      break;
    }

    if (input.mode.kind === "auto") {
      if (turn > input.mode.maxTurns) {
        stopReason = `it hit its limit of ${input.mode.maxTurns} turns`;
        break;
      }
      if (Date.now() - startedAt > input.mode.maxMinutes * 60_000) {
        stopReason = `it hit its limit of ${input.mode.maxMinutes} minutes`;
        break;
      }
      if (consecutiveFailures >= 3) {
        stopReason = "its last three suggestions were all turned down";
        break;
      }
    }

    const action = await input.source.next({
      turn,
      history,
      last: history[history.length - 1],
    });
    if (!action) break;

    if (action.kind === "stop") {
      stopReason = action.reason;
      break;
    }
    if (action.kind === "note") {
      if (!input.mode.quiet) {
        input.terminal.note(noteEntry("Bot", action.text));
      }
      continue;
    }
    if (action.kind === "wait") {
      input.terminal.note(
        noteEntry("Waiting", "Giving Arturo time to get on with the work.")
      );
      const settled = await waitForWorkToSettle({
        ceilingMs: action.seconds * 1000,
        sleep,
        isWorkInFlight,
      });
      if (settled.hitCeiling) {
        input.terminal.note(
          noteEntry(
            "Still working",
            `Arturo was still going after ${action.seconds}s, which is as long as this step waits. Carrying on.`
          )
        );
      }
      continue;
    }

    const proposed = action.line;

    // Refused whatever proposed it. A plan is something the operator chose and
    // can read, which is why /reset is allowed from one — but signing off
    // governed work is not a matter of where the line came from.
    const refusal =
      refuseUnauthorisedApproval(proposed, input.mode.mayApprove) ??
      (input.mode.kind === "auto" ? isDeniedAutoLine(proposed) : undefined);
    if (refusal) {
      if (isApprovalLine(proposed)) refusedApprovals += 1;
      input.terminal.note(
        noteEntry(
          "Bot line turned down",
          [`It was about to type: ${proposed}`, refusal].join("\n")
        )
      );
      failures += 1;
      consecutiveFailures += 1;
      continue;
    }

    // Every approve/reject the bot submits names the bot, from a plan or from a
    // model alike, and unconditionally: gating this on the same flag as the
    // refusal above would let the two drift apart, and the consequence of that
    // is a person's name on a script's decision.
    const line = attributeBotApproval(proposed);

    // Register just before it is first needed, rather than at startup: most
    // plans open with /reset, which deletes the Worker registry — so an
    // operator registered up front signs nothing, and the approval is refused
    // with "No registered Worker named …". Registering here also means the
    // Functions exist, so the approver can actually be designated on them.
    if (input.mode.mayApprove && line !== proposed) {
      ensureApprover();
      botSignedApprovals += 1;
    }

    // No pause here: the terminal owns the whole rhythm of a line — thinking,
    // typing, then a beat before Return — so pausing again would stack two
    // waits and, worse, put this event a full pause before the typing starts.
    emit("bot.input", `Bot submitted: ${line}`);
    const entries = await input.terminal.submit(line);
    const failed = turnFailed(entries);
    if (failed) failures += 1;
    consecutiveFailures = failed ? consecutiveFailures + 1 : 0;
    history.push({ line, entries, failed });

    // A staff review asks once per proposed Worker and the count is
    // model-generated. In-process the answer is a fact rather than a guess, so
    // the driver answers until the review is actually over.
    if (action.kind === "staff" && input.isFlowOpen) {
      for (let reply = 0; reply < 20 && input.isFlowOpen(); reply += 1) {
        const replyEntries = await input.terminal.submit("yes");
        history.push({ line: "yes", entries: replyEntries, failed: false });
      }
    }
  }

  // Never hand the terminal back in the middle of a question — but close what is
  // actually open. A worker chat leaves through `/chat end`; "cancel" is just
  // another message to it, and one that costs a model call to answer. Sending it
  // five times took a finished run from 4,000 to 12,000 tokens and printed four
  // near-identical walls of text after "Bot finished" should have been the end.
  if (input.isFlowOpen) {
    let previousLine: string | undefined;
    for (let attempt = 0; attempt < 5 && input.isFlowOpen(); attempt += 1) {
      const closeLine = input.closeOpenFlowLine?.() ?? "cancel";
      // The last attempt did not close it and there is nothing new to try, so
      // stop rather than repeating something that has been shown not to work.
      if (closeLine === previousLine) {
        input.terminal.note(
          noteEntry(
            "Left a question open",
            [
              `Arturo is still waiting for an answer, and "${closeLine}" did not get rid of the question.`,
              "The terminal is yours, mid-question. Answer it, or type cancel.",
            ].join("\n")
          )
        );
        break;
      }
      previousLine = closeLine;
      await input.terminal.submit(closeLine);
    }
  }

  const summary: BotSessionSummary = {
    turns: history.length,
    failures,
    stopReason,
  };
  emit(
    "bot.session_finished",
    `Bot session finished after ${summary.turns} turns — ${stopReason}.`
  );
  if (!input.mode.quiet) {
  input.terminal.note(
    noteEntry(
      "Bot finished",
      [
        `${summary.turns} ${
          summary.turns === 1 ? "line" : "lines"
        } typed, ${summary.failures} turned down — ${stopReason}.`,
        // Said from what happened, not from the flag. Reading it off
        // mayApprove alone is how this line came to claim nothing had been
        // approved in a run that had just recorded an approval.
        input.mode.mayApprove && botSignedApprovals > 0
          ? [
              `${botSignedApprovals} ${
                botSignedApprovals === 1 ? "decision" : "decisions"
              } in this run ${
                botSignedApprovals === 1 ? "was" : "were"
              } signed off by ${BOT_OPERATOR_NAME}, not by a person.`,
              // It stays registered on purpose. Removing it would leave the
              // signed decisions pointing at an approver who no longer exists,
              // which is a worse record than an obviously-named bot in /workers.
              `It is still on your team, and shows up in /workers, so those decisions still say who made them.`,
            ].join("\n")
          : input.mode.mayApprove
            ? "The bot signed nothing off — every decision in this script named a real person."
            : refusedApprovals > 0
            ? `${refusedApprovals} sign-off ${
                refusedApprovals === 1 ? "line" : "lines"
              } in the script ${
                refusedApprovals === 1 ? "was" : "were"
              } turned down, because the run was not started with --approve. That work is still waiting for someone to approve it.`
            : "Nothing was signed off — the run was not started with --approve.",
        "The keyboard is yours again.",
      ].join("\n")
    )
  );
  }
  return summary;
}
