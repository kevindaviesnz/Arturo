import { join } from "node:path";

/**
 * How fast the bot works.
 *
 * Three beats to a line, because a line that appears at machine speed and
 * submits itself on the same tick reads as a machine however slowly it was
 * typed:
 *
 * 1. `betweenTurnsMs` — reading the last result and deciding what to do.
 * 2. `perCharacterMs` — typing it.
 * 3. A shorter beat before Return, checking it over.
 *
 * All three are varied by ±40% per use. Model-backed steps (/staff, a Task
 * running) already take far longer than any of them, so this mainly paces the
 * quick navigation commands.
 *
 * `perCharacterMs: 0` drops the performance entirely and pastes each line.
 */
export type BotPacing = {
  readonly betweenTurnsMs: number;
  readonly perCharacterMs: number;
};

export const DEFAULT_PACING: BotPacing = {
  betweenTurnsMs: 2200,
  // ~100 words per minute: a brisk, competent typist. 30ms was ~400wpm, which
  // reads as a machine however the rest of the rhythm is arranged. Scenario
  // 001's task instruction is about 330 characters, so it is on screen for
  // roughly 40 seconds — the substance of that demonstration, not dead time.
  perCharacterMs: 120,
};

/** The pause before Return, as a share of the time one keystroke takes. */
export const RETURN_BEAT_CHARACTERS = 8;

/** How far either side of the nominal delay each pause may land. */
export const PACING_VARIATION = 0.4;

/**
 * Time added to the thinking beat per character of the previous result.
 *
 * ~6ms is about 170 characters a second: skimming, not reading every word. The
 * point is that a one-line acknowledgement and a full `/timeline` should not be
 * followed by the same pause — the second has something to take in.
 */
export const READING_MS_PER_CHARACTER = 6;

/**
 * The longest the thinking beat may grow, as a multiple of its base.
 *
 * A long enough result would otherwise stall the run for a minute, and past a
 * point nobody is still reading — they are waiting.
 */
export const MAX_THINKING_MULTIPLE = 4;

/** Where the bot's next line comes from. */
export type BotRunMode =
  | { readonly kind: "human" }
  | {
      readonly kind: "scripted";
      readonly planPath: string;
      readonly pacing: BotPacing;
      readonly mayApprove: boolean;
      readonly assumeYes: boolean;
      readonly mayUsePaidModel: boolean;
      readonly quiet: boolean;
    }
  | {
      readonly kind: "auto";
      readonly goal: string;
      readonly pacing: BotPacing;
      readonly maxTurns: number;
      readonly maxMinutes: number;
      readonly mayApprove: boolean;
      readonly mayUsePaidModel: boolean;
      readonly quiet: boolean;
    };

export type BotArgumentsResult =
  | { readonly ok: true; readonly mode: BotRunMode }
  | { readonly ok: false; readonly error: string };

/** Scenario 001: set up, staff, one Task, approve, read the result. */
export const DEFAULT_BOT_PLAN = "001";

const PLANS_DIRECTORY = join(
  __dirname,
  "..",
  "..",
  "scenario_harness",
  "plans"
);

/** Resolves a plan reference — "001", "001.plan", or a path — to a file path. */
export function resolveBotPlanPath(
  reference: string
): string {
  if (reference.includes("/") || reference.includes("\\")) {
    return reference;
  }
  const name = reference.endsWith(".plan")
    ? reference
    : `${reference}.plan`;
  return join(PLANS_DIRECTORY, name);
}

export const BOT_USAGE = [
  "Usage:",
  "  npm run ui bot                     replay scenario 001",
  "  npm run ui bot 025                 replay any scenario plan by number",
  "  npm run ui bot auto \"<goal>\"       let the model choose each command",
  "",
  "Options (after --, because npm keeps flags for itself):",
  "  npm run ui bot -- --pace 3000      milliseconds thinking before each line",
  "  npm run ui bot -- --type-pace 60   milliseconds per keystroke (0 pastes)",
  "  npm run ui bot -- --approve        let the bot sign off work needing approval",
  "  npm run ui bot -- --paid           let the run spend money on a paid model",
  "  npm run ui bot -- --quiet          no banners or closing summary (for filming)",
  "  npm run ui bot -- --yes            skip the confirmation for a plan that resets",
  "  npm run ui bot auto \"<goal>\" -- --max-turns 40",
].join("\n");

/** Flags that are followed by a value, rather than standing alone. */
const VALUED_FLAGS = new Set(["pace", "type-pace", "plan", "max-turns", "max-minutes"]);

/**
 * Parses the arguments after the program name.
 *
 * npm forwards positional arguments but keeps `-`-prefixed ones for itself,
 * which is why the modes are words rather than flags: `npm run ui bot auto` has
 * to work as typed, without the operator having to know about `--`.
 *
 * PURE: Returns an error rather than throwing or exiting, so it is testable.
 */
export function parseBotArguments(
  argv: readonly string[]
): BotArgumentsResult {
  // A flag's value is not a positional. Missing this swept `--max-turns 40`
  // into the autonomous goal, which the model then read as part of the brief.
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    if (VALUED_FLAGS.has(arg.slice(2))) index += 1;
  }

  const flagValue = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  const hasFlag = (name: string): boolean => argv.includes(`--${name}`);

  if (positional[0] !== "bot") {
    return { ok: true, mode: { kind: "human" } };
  }

  const paceRaw = flagValue("pace");
  const pace = paceRaw === undefined ? DEFAULT_PACING.betweenTurnsMs : Number(paceRaw);
  if (!Number.isFinite(pace) || pace < 0) {
    return { ok: false, error: `--pace needs a number of milliseconds, not "${paceRaw}".` };
  }
  const typePaceRaw = flagValue("type-pace");
  const typePace =
    typePaceRaw === undefined ? DEFAULT_PACING.perCharacterMs : Number(typePaceRaw);
  if (!Number.isFinite(typePace) || typePace < 0) {
    return {
      ok: false,
      error: `--type-pace needs a number of milliseconds, not "${typePaceRaw}". Use 0 to paste each line whole.`,
    };
  }
  const pacing: BotPacing = {
    betweenTurnsMs: pace,
    perCharacterMs: typePace,
  };
  const mayApprove = hasFlag("approve");
  const mayUsePaidModel = hasFlag("paid");
  const quiet = hasFlag("quiet");

  if (positional[1] === "auto") {
    const goal = positional.slice(2).join(" ").trim();
    if (!goal) {
      return {
        ok: false,
        error: 'Autonomous mode needs a goal: npm run ui bot auto "grow a small legal practice".',
      };
    }
    const maxTurnsRaw = flagValue("max-turns");
    const maxTurns = maxTurnsRaw === undefined ? 25 : Number(maxTurnsRaw);
    if (!Number.isInteger(maxTurns) || maxTurns < 1) {
      return { ok: false, error: `--max-turns needs a whole number, not "${maxTurnsRaw}".` };
    }
    const maxMinutesRaw = flagValue("max-minutes");
    const maxMinutes = maxMinutesRaw === undefined ? 15 : Number(maxMinutesRaw);
    if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) {
      return { ok: false, error: `--max-minutes needs a number, not "${maxMinutesRaw}".` };
    }
    return {
      ok: true,
      mode: { kind: "auto", goal, pacing, maxTurns, maxMinutes, mayApprove, mayUsePaidModel, quiet },
    };
  }

  const planReference = positional[1] ?? flagValue("plan") ?? DEFAULT_BOT_PLAN;
  return {
    ok: true,
    mode: {
      kind: "scripted",
      planPath: resolveBotPlanPath(planReference),
      pacing,
      mayApprove,
      mayUsePaidModel,
      quiet,
      assumeYes: hasFlag("yes"),
    },
  };
}
