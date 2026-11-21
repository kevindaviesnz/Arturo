import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import type { BotAction, BotInputSource, BotTurn, BotTurnContext } from "./botDriver";
import type { SetupState } from "../ui/uiSetupProgress";
import type { WorkStreamEntry } from "../ui/uiState";

import { describeNextSetupStep } from "../ui/uiSetupProgress";
import { UI_PRIMARY_COMMANDS } from "../ui/uiCommandHelp";
import { stripAnsi } from "./botPlanSource";

/**
 * The model choosing Arturo's next line.
 *
 * A scripted run replays something a person wrote and can read beforehand. This
 * does not: every line is a fresh guess, so the work here is mostly refusing
 * bad ones. A small local model will propose prose, invent commands, type a
 * command at a menu and repeat itself, and each of those has to fail visibly
 * and recoverably rather than being typed into a live installation.
 */

/** How much of the previous result the model is shown. */
const LAST_RESULT_LIMIT = 2500;

/** How many earlier lines it is reminded of, to notice its own loops. */
const RECENT_LINE_LIMIT = 8;

/** How far back a repeat counts as a loop. */
const LOOP_WINDOW = 4;

/** Attempts at one turn before falling back to something deterministic. */
const ATTEMPTS_PER_TURN = 3;

/** How long one generate call may take before the turn is given up on. */
const GENERATE_TIMEOUT_MS = 90_000;

export type BotAutoDependencies = {
  /** Calls the model chosen by /model. */
  generate(prompt: string): Promise<string>;
  /** How far the installation has been set up. */
  readState(): SetupState;
  /** Whether Arturo is waiting for an answer to a question. */
  isFlowOpen(): boolean;
  /** Shows a refused suggestion. A hidden retry looks like a hung run. */
  note(label: string, body: string): void;
};

export type BotAutoRegime = "answer" | "command";

/**
 * Salvages one submittable line from a model's reply.
 *
 * llama3.2 does not reliably answer with a bare line: it fences the reply, adds
 * "Sure — here's the next command:", echoes the prompt, or trails a comment.
 * Rewriting is not attempted beyond stripping that packaging, because a
 * rewriter that "fixes" a correct line corrupts it.
 *
 * PURE: No side effects.
 */
export function parseBotAutoReply(
  raw: string
): string | undefined {
  const lines = stripAnsi(raw)
    .replace(/```[a-z]*/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const candidate = line
      .replace(/^arturo\s*›\s*/i, "")
      .replace(/^[-*]\s+/, "")
      .replace(/^\d+[).]\s+/, "")
      .replace(/^`+|`+$/g, "")
      .replace(/\s+(#|\/\/)\s.*$/, "")
      .trim();
    if (!candidate) continue;
    // Prose is discarded rather than typed: a sentence submitted at a prompt is
    // an unhandled input, and at a menu it is an answer nobody meant to give.
    if (candidate.startsWith("/")) return candidate;
    if (/^(yes|no|skip|cancel|done)$/i.test(candidate)) return candidate;
    if (/^\d+$/.test(candidate)) return candidate;
    if (lines.length === 1 && candidate.length <= 80) return candidate;
  }

  return undefined;
}

/** The highest option number a menu offered, if it offered any. PURE. */
export function readMenuOptionCount(
  entries: readonly WorkStreamEntry[]
): number | undefined {
  let highest = 0;
  for (const entry of entries) {
    for (const line of stripAnsi(entry.body).split("\n")) {
      const match = /^\s*(\d+)[).]\s+\S/.exec(line);
      if (match) highest = Math.max(highest, Number(match[1]));
    }
  }
  return highest > 0 ? highest : undefined;
}

/**
 * Why a proposed line will not be submitted, if it will not.
 *
 * The reason is fed back to the model on the next attempt and shown to the
 * operator, so a refused line is a visible correction rather than a silent
 * retry.
 *
 * PURE: No side effects.
 */
export function refuseBotAutoLine(input: {
  readonly line: string;
  readonly regime: BotAutoRegime;
  readonly recentLines: readonly string[];
  readonly menuOptionCount?: number;
}): string | undefined {
  const line = input.line.trim();
  if (!line) return "It said nothing at all.";

  // Only commands. A review asks the same question about each of several
  // proposals, so answering "yes" three times running is the correct thing to
  // do — the first live run was pushed off "yes" onto "skip" and then "cancel"
  // by a loop guard that did not know the difference.
  if (
    input.regime === "command" &&
    input.recentLines
      .slice(-LOOP_WINDOW)
      .some((earlier) => earlier.toLowerCase() === line.toLowerCase())
  ) {
    return `It has just run "${line}". Repeating it will not change anything.`;
  }

  if (input.regime === "answer") {
    if (line.startsWith("/")) {
      return "Arturo is waiting for an answer to a question, not a command.";
    }
    if (input.menuOptionCount !== undefined) {
      if (/^\d+$/.test(line)) {
        const chosen = Number(line);
        if (chosen < 1 || chosen > input.menuOptionCount) {
          return `The list only goes up to ${input.menuOptionCount}.`;
        }
        return undefined;
      }
      if (!/^(yes|no|skip|cancel|done)$/i.test(line)) {
        // Free text at a numbered menu is not an answer to the question that
        // was asked. Several flows record whatever they are given as a name.
        return `That is a numbered list: reply with a number from 1 to ${input.menuOptionCount}, or cancel.`;
      }
    }
    return undefined;
  }

  if (!line.startsWith("/")) {
    return "A command has to start with a /.";
  }

  const command = line.split(/\s+/)[0].toLowerCase();
  if (!UI_PRIMARY_COMMANDS.includes(command)) {
    return `Arturo has no command called ${command}.`;
  }

  const tokens = line.split(/\s+/);
  if (tokens.length > 2 && !line.includes('"')) {
    // "/enterprise create Harbour Youth Trust" reaches the handler as four
    // separate arguments and creates something called "Harbour". Rejected
    // rather than re-quoted: guessing where the quotes go is how a correct
    // line gets corrupted.
    return "Anything longer than one word has to go inside double quotes.";
  }

  return undefined;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n…(trimmed)`;
}

function describeLastTurn(last: BotTurn | undefined): string {
  if (!last) return "Nothing has been run yet.";
  const body = last.entries
    .map((entry) => `${entry.label}\n${entry.body}`)
    .join("\n\n");
  return truncate(`It ran: ${last.line}\n\nArturo replied:\n${stripAnsi(body)}`, LAST_RESULT_LIMIT);
}

/**
 * Builds the prompt for one turn.
 *
 * Only the previous turn is included, not the whole session: a long transcript
 * makes a small model parrot commands it already ran. The setup state comes
 * from `describeNextSetupStep`, which returns literal command lines — so on an
 * empty installation the model has something to copy rather than invent.
 *
 * PURE: No side effects.
 */
export function buildBotAutoPrompt(input: {
  readonly goal: string;
  readonly state: SetupState;
  readonly regime: BotAutoRegime;
  readonly last?: BotTurn;
  readonly recentLines: readonly string[];
  readonly refusal?: string;
}): string {
  const nextStep = describeNextSetupStep(input.state);

  const vocabulary =
    input.regime === "answer"
      ? [
          "Arturo has asked a question and is waiting for the answer.",
          "Reply with one of:",
          "  a number, to choose from a numbered list",
          "  yes or no",
          "  skip, to leave an optional value empty",
          "  cancel, to abandon the question",
          "  one short line of text, when it asked for a name or a description",
          // The model is answering as the operator, and what it types is kept:
          // a name or an objective written in consultancy prose is read back by
          // every later reader of this installation.
          "When you type text of your own, write it in plain, everyday English.",
          "Short words, short sentences, no jargon and no buzzwords — say the",
          "thing the way you would say it out loud to a colleague.",
          "Do NOT reply with a command: it will be read as the answer.",
        ]
      : [
          "Arturo is at the prompt and is waiting for a command.",
          `The commands that exist: ${UI_PRIMARY_COMMANDS.join(" ")}`,
          "Commands ask for their values through questions, so most are typed bare.",
          "Any value of more than one word must be in double quotes.",
        ];

  return renderEnterprisePrompt("Terminal Setup Next Action", {
    GOAL: input.goal,
    ENTERPRISE_NAME: input.state.enterpriseName ?? "none yet",
    FUNCTION_COUNT: input.state.functionCount,
    WORKER_COUNT: input.state.workerCount,
    NEXT_SETUP_STEP: (nextStep.length > 0
      ? ["", "The next thing it needs, exactly as typed:", ...nextStep]
      : []),
    ALLOWED_REPLIES: vocabulary,
    RECENT_COMMANDS: input.recentLines.length > 0
      ? `Already run, most recent last: ${input.recentLines.slice(-RECENT_LINE_LIMIT).join(" | ")}`
      : "Nothing has been run yet.",
    LAST_TURN: describeLastTurn(input.last),
    REFUSAL: (input.refusal
      ? ["", `Your last suggestion was refused: ${input.refusal}`, "Suggest something different."]
      : [])
  });
}

/** The command `describeNextSetupStep` recommends, if it recommends one. PURE. */
export function fallbackBotAutoLine(
  state: SetupState
): string {
  const [step] = describeNextSetupStep(state);
  if (!step) return "/overview";
  // The step reads "  /next \"Acme\"    Arturo recommends …": the command is
  // everything before the run of spaces that separates it from the gloss.
  return step.trim().split(/\s{2,}/)[0];
}

async function withTimeout(
  work: Promise<string>,
  ms: number
): Promise<string | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A source that asks the model for each line.
 *
 * Everything it proposes still goes through the driver's deny-list and, when
 * the run may approve, through `attributeBotApproval`. This chooses what to
 * suggest; it does not decide what is allowed.
 */
export function createBotAutoSource(input: {
  readonly goal: string;
  readonly dependencies: BotAutoDependencies;
  readonly timeoutMs?: number;
}): BotInputSource {
  const submitted: string[] = [];

  return {
    describe: `the model, working towards: ${input.goal}`,

    async next(context: BotTurnContext): Promise<BotAction | undefined> {
      const state = input.dependencies.readState();
      const regime: BotAutoRegime = input.dependencies.isFlowOpen()
        ? "answer"
        : "command";
      const menuOptionCount = context.last
        ? readMenuOptionCount(context.last.entries)
        : undefined;

      let refusal: string | undefined;

      for (let attempt = 1; attempt <= ATTEMPTS_PER_TURN; attempt += 1) {
        const prompt = buildBotAutoPrompt({
          goal: input.goal,
          state,
          regime,
          last: context.last,
          recentLines: submitted,
          refusal,
        });

        let raw: string | undefined;
        try {
          raw = await withTimeout(
            input.dependencies.generate(prompt),
            input.timeoutMs ?? GENERATE_TIMEOUT_MS
          );
        } catch (error) {
          return {
            kind: "stop",
            reason: `it could not reach the model (${
              error instanceof Error ? error.message : String(error)
            })`,
          };
        }

        if (raw === undefined) {
          refusal = "It took too long to answer.";
          input.dependencies.note("Bot suggestion turned down", refusal);
          continue;
        }

        const candidate = parseBotAutoReply(raw);
        if (!candidate) {
          refusal = "It wrote a sentence, not a line to type.";
          input.dependencies.note(
            "Bot suggestion turned down",
            [`It said: ${truncate(raw.trim(), 300)}`, refusal].join("\n")
          );
          continue;
        }

        const refused = refuseBotAutoLine({
          line: candidate,
          regime,
          recentLines: submitted,
          menuOptionCount,
        });
        if (refused) {
          refusal = refused;
          input.dependencies.note(
            "Bot suggestion turned down",
            [`It wanted to type: ${candidate}`, refused, "Nothing was typed."].join("\n")
          );
          continue;
        }

        submitted.push(candidate);
        return { kind: "line", line: candidate };
      }

      // Three refusals in a row. Rather than stopping the demonstration, fall
      // back to the step the installation deterministically needs — the same
      // line Arturo itself would recommend — and say that is what happened.
      const fallback = fallbackBotAutoLine(state);
      if (
        regime === "answer" ||
        submitted.slice(-LOOP_WINDOW).includes(fallback)
      ) {
        return {
          kind: "stop",
          reason: `it could not come up with anything usable (${refusal ?? "no reason recorded"})`,
        };
      }
      input.dependencies.note(
        "Trying the obvious step instead",
        [
          `Its last three suggestions were all turned down (${refusal ?? "no reason recorded"}).`,
          `Typing ${fallback} instead — the step Arturo itself recommends from here.`,
        ].join("\n")
      );
      submitted.push(fallback);
      return { kind: "line", line: fallback };
    },
  };
}
