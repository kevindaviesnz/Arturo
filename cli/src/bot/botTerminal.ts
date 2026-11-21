import type readline from "node:readline";

import type { WorkStreamEntry } from "../ui/uiState";
import {
  MAX_THINKING_MULTIPLE,
  PACING_VARIATION,
  READING_MS_PER_CHARACTER,
  RETURN_BEAT_CHARACTERS,
  type BotPacing,
} from "./botArgs";

/**
 * How long to pause before typing, given what there is to read first.
 *
 * A fixed pause after every result is wrong in both directions: too long after
 * "Task created", far too short after a screen of `/timeline`. This scales with
 * the length of what Arturo just printed, and caps so that a very long result
 * does not stall the run.
 *
 * PURE: No side effects.
 */
export function thinkingDelayMs(
  baseMs: number,
  previousResultCharacters: number
): number {
  if (baseMs <= 0) return 0;
  return Math.min(
    baseMs + previousResultCharacters * READING_MS_PER_CHARACTER,
    baseMs * MAX_THINKING_MULTIPLE
  );
}

/**
 * What the driver needs from a terminal.
 *
 * Kept behind an interface so the driver can be tested without a real one: the
 * fake records what was typed and returns canned entries.
 */
export type BotTerminal = {
  /** Types the line and submits it; resolves with what Arturo replied. */
  submit(line: string): Promise<readonly WorkStreamEntry[]>;
  /** Writes an annotation that is not a command — notes, waits, refusals. */
  note(entry: WorkStreamEntry): void;
  /** Resolves once the operator resumes; immediately when not paused. */
  waitWhilePaused(): Promise<void>;
  /** True once the operator has asked the run to stop. */
  stopRequested(): boolean;
};

/**
 * The hooks `startLineInterface` calls to hand results back to the driver.
 *
 * The bot does not print anything itself: it types into the same readline, the
 * ordinary `rl.on("line")` handler runs, and the result comes back here. One
 * output path, so a bot session and a person's session cannot drift.
 */
export type BotDriverHooks = {
  notifyTurnComplete(
    submitted: string,
    entries: readonly WorkStreamEntry[]
  ): void;
};

/**
 * How many rows readline reclaims when it redraws the prompt.
 *
 * The prompt string is three rows — a blank, the status line, and `arturo ›` —
 * and readline rewinds over all but the one it is writing.
 */
const PROMPT_REDRAW_ROWS = 2;

export type ReadlineBotTerminal = BotTerminal & BotDriverHooks & {
  /** Called by the interface when the operator asks to stop. */
  requestStop(): void;
  /** Called by the interface on a human keypress. */
  notifyHumanActivity(): void;
  /** Called by the interface when the operator hands the terminal back. */
  resume(): void;
  /** Called by the interface once the run is over and the terminal is a person's. */
  finish(): void;
  /** Whether the run is currently waiting for the operator to hand it back. */
  isPaused(): boolean;
  /** Whether a line is part-typed, so what is in the buffer is the bot's. */
  isTyping(): boolean;
};

export function createReadlineBotTerminal(input: {
  readonly rl: readline.Interface;
  readonly output: NodeJS.WriteStream;
  readonly formatEntry: (entry: WorkStreamEntry) => string;
  /** Thinking and typing delays. Omitted, the line is pasted with no pauses. */
  readonly pacing?: BotPacing;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Supplies the variation between pauses. Injected so tests are exact. */
  readonly random?: () => number;
}): ReadlineBotTerminal {
  const perCharacterMs = input.pacing?.perCharacterMs ?? 0;
  const thinkingMs = input.pacing?.betweenTurnsMs ?? 0;
  const sleep =
    input.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const random = input.random ?? Math.random;

  /**
   * One pause, varied so the rhythm is not metronomic.
   *
   * Uniform delays are what made the first version read as a machine even at a
   * human average speed.
   */
  const vary = (ms: number): number =>
    Math.round(ms * (1 - PACING_VARIATION + random() * PACING_VARIATION * 2));
  let pendingTurn:
    | { resolve: (entries: readonly WorkStreamEntry[]) => void }
    | undefined;
  let paused = false;
  let stopped = false;
  let finished = false;
  let resumeWaiters: (() => void)[] = [];
  // What the operator has just been shown, and so has to read before the next
  // line makes sense. Zero before the first command: nothing to catch up on.
  let lastResultCharacters = 0;
  // Whether the buffer currently holds a line the bot is part-way through, so
  // the interface can tell the bot's text apart from the operator's.
  let typing = false;

  /** Discards a half-typed line, so nothing partial can be submitted. */
  const clearTypedLine = (): void => {
    typing = false;
    input.rl.write(null, { ctrl: true, name: "u" } as never);
  };

  /**
   * Types the line, a keystroke at a time, and says whether it got to the end.
   *
   * Interruptible on purpose. A line of scenario 001's task instruction is
   * about 330 characters, so at a readable pace it is on screen for ten
   * seconds — long enough that the operator has to be able to break in, and
   * long enough that if they start typing their characters would otherwise be
   * interleaved into the bot's command and submitted as one mangled line.
   */
  const typeLine = async (line: string): Promise<boolean> => {
    if (perCharacterMs === 0) {
      input.rl.write(line);
      return true;
    }
    // Reading the previous result and deciding, so it lasts as long as there was
    // something to read. Interruptible like the typing: this is the longest
    // beat, so it is the one most likely to be broken into.
    const thinking = thinkingDelayMs(thinkingMs, lastResultCharacters);
    if (thinking > 0) {
      await sleep(vary(thinking));
      if (stopped || paused) return false;
    }
    for (const character of line) {
      if (stopped || paused) {
        clearTypedLine();
        return false;
      }
      typing = true;
      input.rl.write(character);
      await sleep(vary(perCharacterMs));
    }
    // Checking it over before committing to it. Without this the line lands and
    // runs on the same tick, which is the tell however slowly it was typed.
    await sleep(vary(perCharacterMs * RETURN_BEAT_CHARACTERS));
    if (stopped || paused) {
      clearTypedLine();
      return false;
    }
    return true;
  };

  const waitForResume = async (): Promise<void> => {
    if (!paused) return;
    await new Promise<void>((resolve) => {
      resumeWaiters.push(resolve);
    });
  };

  return {
    async submit(line) {
      // Retyped from the start after a pause, rather than resumed mid-word: the
      // buffer was cleared, and half a command left on screen would misrepresent
      // what the bot is about to run.
      for (;;) {
        if (stopped) return [];
        const complete = await typeLine(line);
        if (complete) break;
        if (stopped) return [];
        await waitForResume();
      }

      return new Promise<readonly WorkStreamEntry[]>((resolve) => {
        pendingTurn = { resolve };
        typing = false;
        input.rl.write(null, { name: "return" } as never);
      });
    },

    note(entry) {
      // The status line and prompt occupy three rows, so when readline redraws
      // them it moves the cursor up two rows *from wherever it now is* and
      // clears to the end of the screen. Anything printed since is inside that
      // range unless the cursor has been pushed far enough past it, so the note
      // is followed by two rows the redraw is welcome to eat.
      //
      // Measured, not guessed: with one trailing newline the last two lines of
      // a note are erased, with two the last one is. The pre-flight warning
      // lost the commands it was asking the operator to choose between.
      input.output.write(`\n${input.formatEntry(entry)}\n${"\n".repeat(PROMPT_REDRAW_ROWS)}`);
    },

    waitWhilePaused: waitForResume,

    stopRequested() {
      return stopped;
    },

    notifyTurnComplete(_submitted, entries) {
      // Measured as rendered, not as raw bodies: what sizes the next pause is
      // what is on the operator's screen, which is what the formatter produced.
      lastResultCharacters = entries.reduce(
        (total, entry) => total + input.formatEntry(entry).length,
        0
      );
      const turn = pendingTurn;
      pendingTurn = undefined;
      turn?.resolve(entries);
    },

    requestStop() {
      stopped = true;
      paused = false;
      const waiters = resumeWaiters;
      resumeWaiters = [];
      for (const resume of waiters) resume();
    },

    finish() {
      finished = true;
    },

    isPaused() {
      return paused;
    },

    isTyping() {
      return typing;
    },

    notifyHumanActivity() {
      // Every keypress the listener sees is the operator's: `rl.write()` drives
      // readline's tty layer directly and emits no stdin keypress events at all
      // (measured, not assumed), so the bot's own typing cannot land here.
      //
      // Once the run is over there is nothing to pause, and the operator's own
      // typing was announcing "Bot paused" at them.
      if (stopped || paused || finished) return;
      paused = true;
      // Said once, on the transition, because the handler runs on every
      // keystroke. Without it a pause is a dead end: the operator has no way
      // back other than killing the run.
      input.output.write(
        `\n${input.formatEntry({
          actor: "Arturo",
          label: "Bot paused",
          body: [
            "The terminal is yours — the bot stops where it is.",
            "Space, or Enter on an empty line, hands it back. Ctrl+C stops it.",
          ].join("\n"),
        })}\n`
      );
    },

    resume() {
      if (!paused || stopped) return;
      paused = false;
      const waiters = resumeWaiters;
      resumeWaiters = [];
      for (const resumeWaiter of waiters) resumeWaiter();
    },
  };
}

/** A terminal that records what the bot typed, for tests. */
export function createRecordingBotTerminal(
  reply: (line: string) => readonly WorkStreamEntry[]
): BotTerminal & { readonly submitted: string[]; readonly notes: WorkStreamEntry[] } {
  const submitted: string[] = [];
  const notes: WorkStreamEntry[] = [];
  return {
    submitted,
    notes,
    async submit(line) {
      submitted.push(line);
      return reply(line);
    },
    note(entry) {
      notes.push(entry);
    },
    async waitWhilePaused() {
      // Never paused.
    },
    stopRequested() {
      return false;
    },
  };
}
