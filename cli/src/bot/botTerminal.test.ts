import { describe, expect, it } from "vitest";

import { createReadlineBotTerminal, thinkingDelayMs } from "./botTerminal";
import { MAX_THINKING_MULTIPLE } from "./botArgs";
import type { WorkStreamEntry } from "../ui/uiState";

function harness(
  options: { readonly perCharacterMs?: number; readonly thinkingMs?: number } = {}
) {
  const written: string[] = [];
  const typed: (string | null)[] = [];
  const keys: string[] = [];
  const keystrokes: (() => void)[] = [];
  const delays: number[] = [];
  const rl = {
    write(value: string | null, key?: { name?: string; ctrl?: boolean }) {
      typed.push(value);
      if (value === null && key?.name) keys.push(key.ctrl ? `ctrl-${key.name}` : key.name);
    },
  } as unknown as Parameters<typeof createReadlineBotTerminal>[0]["rl"];
  const output = {
    write(value: string) {
      written.push(value);
      return true;
    },
  } as unknown as NodeJS.WriteStream;

  const terminal = createReadlineBotTerminal({
    rl,
    output,
    formatEntry: (entry: WorkStreamEntry) => `${entry.label}\n${entry.body}`,
    pacing:
      options.perCharacterMs === undefined
        ? undefined
        : {
            perCharacterMs: options.perCharacterMs,
            // Off by default so a test steps only through keystrokes; the
            // thinking beat has its own tests.
            betweenTurnsMs: options.thinkingMs ?? 0,
          },
    // No variation, so a step count is a fact rather than a distribution.
    random: () => 0.5,
    // The pace is for a viewer, so no real waiting — but each keystroke has to
    // be individually releasable, or the whole line is typed before a test can
    // interrupt it.
    sleep: (ms) => {
      delays.push(ms);
      return new Promise<void>((release) => {
        keystrokes.push(release);
      });
    },
  });

  /**
   * Releases one keystroke's pause and lets the loop run on.
   *
   * Waits for the pause to exist first: after a resume the loop needs a turn of
   * the event loop to write its next character and pause again, and releasing
   * before then silently does nothing.
   */
  const step = async (times = 1): Promise<void> => {
    for (let count = 0; count < times; count += 1) {
      for (let spin = 0; spin < 50 && keystrokes.length === 0; spin += 1) {
        await new Promise((tick) => setImmediate(tick));
      }
      keystrokes.shift()?.();
      await new Promise((tick) => setImmediate(tick));
    }
  };

  return { terminal, written, typed, keys, step, delays };
}

/** What was typed as text, ignoring the key events. */
function textOf(typed: readonly (string | null)[]): string {
  return typed.filter((value): value is string => value !== null).join("");
}

const done: readonly WorkStreamEntry[] = [{ actor: "Arturo", label: "Done", body: "" }];

describe("typing into the interface", () => {
  it("puts the line in whole when there is no typing pace", async () => {
    const { terminal, typed } = harness();
    const pending = terminal.submit("/overview");
    await new Promise((tick) => setImmediate(tick));

    expect(typed[0]).toBe("/overview");
    // The second write is the Return keypress, not text.
    expect(typed[1]).toBeNull();

    terminal.notifyTurnComplete("/overview", done);
    await expect(pending).resolves.toEqual(done);
  });

  it("types one character at a time when given a pace", async () => {
    const { terminal, typed, keys, step } = harness({ perCharacterMs: 30 });
    const pending = terminal.submit("/tasks");
    await new Promise((tick) => setImmediate(tick));

    // One character is on screen and it is waiting before the next.
    expect(typed).toEqual(["/"]);
    expect(keys).toEqual([]);

    await step(6);
    expect(textOf(typed)).toBe("/tasks");
    // Typed in full, but not committed to yet: one more beat first.
    expect(keys).toEqual([]);

    await step();
    expect(keys).toEqual(["return"]);

    terminal.notifyTurnComplete("/tasks", done);
    await expect(pending).resolves.toEqual(done);
  });

  it("thinks before it starts typing", async () => {
    const { terminal, typed, step } = harness({ perCharacterMs: 30, thinkingMs: 2200 });
    void terminal.submit("/tasks");
    await new Promise((tick) => setImmediate(tick));

    // Nothing on screen yet: it is reading the last result and deciding.
    expect(typed).toEqual([]);

    await step();
    expect(typed).toEqual(["/"]);
  });

  it("can be interrupted while it is still thinking", async () => {
    // The longest of the three beats, so the one most likely to be broken into.
    const { terminal, typed, keys, step } = harness({
      perCharacterMs: 30,
      thinkingMs: 2200,
    });
    const pending = terminal.submit("/reset");
    await new Promise((tick) => setImmediate(tick));

    terminal.requestStop();
    void step();

    await expect(pending).resolves.toEqual([]);
    expect(typed).toEqual([]);
    // Nothing was typed, so there is nothing to clear and nothing to submit.
    expect(keys).toEqual([]);
  });

  it("keeps the pauses irregular", async () => {
    // A metronome is what read as a machine even at a human average speed.
    const delays: number[] = [];
    let seed = 0;
    const terminal = createReadlineBotTerminal({
      rl: { write: () => undefined } as unknown as Parameters<
        typeof createReadlineBotTerminal
      >[0]["rl"],
      output: { write: () => true } as unknown as NodeJS.WriteStream,
      formatEntry: (entry: WorkStreamEntry) => entry.label,
      pacing: { perCharacterMs: 100, betweenTurnsMs: 0 },
      random: () => {
        seed += 0.37;
        return seed % 1;
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    void terminal.submit("abcdef");
    await new Promise((tick) => setImmediate(tick));

    const keystrokeDelays = delays.slice(0, 6);
    expect(new Set(keystrokeDelays).size).toBeGreaterThan(1);
    // Still recognisably the requested pace: ±40%.
    for (const delay of keystrokeDelays) {
      expect(delay).toBeGreaterThanOrEqual(60);
      expect(delay).toBeLessThanOrEqual(140);
    }
    // The beat before Return is longer than a keystroke.
    expect(delays[6]).toBeGreaterThan(Math.max(...keystrokeDelays));
  });

  it("prints a note itself, because a note is not a command", () => {
    const { terminal, written } = harness();
    terminal.note({ actor: "Arturo", label: "Waiting", body: "20s" });
    expect(written.join("")).toContain("Waiting");
  });
});

describe("handing the terminal over", () => {
  it("does not pause itself by typing", async () => {
    // Every keypress the interface reports is a person's: rl.write drives
    // readline's tty layer directly and emits no stdin keypress events at all
    // (measured). This is the consequence worth guarding — a bot that paused on
    // its own keystrokes would stop dead on its first character.
    const { terminal, written, step } = harness({ perCharacterMs: 30 });
    const pending = terminal.submit("/tasks");
    await step(7);
    terminal.notifyTurnComplete("/tasks", done);
    await pending;

    // Not paused: waiting returns rather than blocking, and nothing was said.
    await terminal.waitWhilePaused();
    expect(written).toEqual([]);
  });

  it("pauses on a keypress and says how to get the bot back", async () => {
    const { terminal, written } = harness();
    terminal.notifyHumanActivity();
    expect(written.join("")).toContain("Space, or Enter on an empty line");

    let resumed = false;
    const waiting = terminal.waitWhilePaused().then(() => {
      resumed = true;
    });
    await new Promise((tick) => setImmediate(tick));
    expect(resumed).toBe(false);

    terminal.resume();
    await waiting;
    expect(resumed).toBe(true);
  });

  it("says it once, not on every keystroke", () => {
    const { terminal, written } = harness();
    terminal.notifyHumanActivity();
    terminal.notifyHumanActivity();
    terminal.notifyHumanActivity();
    expect(written).toHaveLength(1);
  });

  it("releases a paused run when the operator stops it", async () => {
    const { terminal } = harness();
    terminal.notifyHumanActivity();
    const waiting = terminal.waitWhilePaused();
    terminal.requestStop();
    await waiting;
    expect(terminal.stopRequested()).toBe(true);
  });

  it("ignores a keypress once the run has been stopped", () => {
    const { terminal, written } = harness();
    terminal.requestStop();
    terminal.notifyHumanActivity();
    expect(written).toEqual([]);
  });

  it("ignores a keypress once the run is over", () => {
    // The terminal is the operator's again, so there is nothing to pause — and
    // their own typing was announcing "Bot paused" back at them.
    const { terminal, written } = harness();
    terminal.finish();
    terminal.notifyHumanActivity();
    expect(written).toEqual([]);
  });
});

describe("how long it thinks for", () => {
  it("pauses for the base time when there was nothing to read", () => {
    expect(thinkingDelayMs(2200, 0)).toBe(2200);
  });

  it("pauses for longer after a longer result", () => {
    // "Task created" and a screen of /timeline should not be followed by the
    // same pause: only one of them has something to take in.
    const short = thinkingDelayMs(2200, 60);
    const long = thinkingDelayMs(2200, 900);
    expect(long).toBeGreaterThan(short);
    expect(short).toBeGreaterThan(2200);
  });

  it("caps, so a very long result does not stall the run", () => {
    expect(thinkingDelayMs(2200, 100_000)).toBe(2200 * MAX_THINKING_MULTIPLE);
  });

  it("stays off when there is no thinking beat at all", () => {
    expect(thinkingDelayMs(0, 5000)).toBe(0);
  });

  it("reads the result Arturo actually printed", async () => {
    const { terminal, step, delays } = harness({
      perCharacterMs: 30,
      thinkingMs: 1000,
    });

    // First line: nothing has been shown yet, so just the base pause.
    const first = terminal.submit("/tasks");
    await new Promise((tick) => setImmediate(tick));
    expect(delays[0]).toBe(1000);
    await step(8);
    terminal.notifyTurnComplete("/tasks", [
      { actor: "Arturo", label: "Tasks", body: "x".repeat(400) },
    ]);
    await first;

    // Second line: it has 400-odd characters to read first.
    delays.length = 0;
    void terminal.submit("/overview");
    await new Promise((tick) => setImmediate(tick));
    expect(delays[0]).toBeGreaterThan(1000);
  });
});

describe("telling the bot's typing from the operator's", () => {
  it("reports typing only while a line is part-way in", async () => {
    // The interface uses this to decide whether a space is a control press or
    // part of something the operator is writing. A half-typed bot line in the
    // buffer must not be mistaken for the operator's own text.
    const { terminal, step } = harness({ perCharacterMs: 30 });
    expect(terminal.isTyping()).toBe(false);

    const pending = terminal.submit("/tasks");
    await new Promise((tick) => setImmediate(tick));
    expect(terminal.isTyping()).toBe(true);

    await step(7);
    // Submitted, so the buffer is readline's again.
    expect(terminal.isTyping()).toBe(false);

    terminal.notifyTurnComplete("/tasks", done);
    await pending;
  });

  it("stops reporting typing once an interrupted line is discarded", async () => {
    const { terminal, step } = harness({ perCharacterMs: 30 });
    void terminal.submit("/reset");
    await new Promise((tick) => setImmediate(tick));
    expect(terminal.isTyping()).toBe(true);

    terminal.notifyHumanActivity();
    await step();
    expect(terminal.isTyping()).toBe(false);
  });
});

describe("interrupting a line as it is typed", () => {
  it("throws the half-typed line away rather than submitting it", async () => {
    // The operator's keystrokes go into the same readline. Left alone, theirs
    // would be interleaved into the bot's command and the pair submitted as one
    // mangled line — with the bot's Return.
    const { terminal, typed, keys, step } = harness({ perCharacterMs: 30 });
    const pending = terminal.submit("/reset");
    await new Promise((tick) => setImmediate(tick));
    expect(typed).toEqual(["/"]);

    terminal.notifyHumanActivity();
    await step();

    expect(keys).toEqual(["ctrl-u"]);
    expect(keys).not.toContain("return");

    // Retyped from the start once the operator hands it back, so what is on
    // screen is the whole command it is about to run.
    terminal.resume();
    await step(7);
    expect(textOf(typed)).toBe("//reset");
    expect(keys).toContain("return");

    terminal.notifyTurnComplete("/reset", done);
    await pending;
  });

  it("submits nothing at all when the operator stops it mid-line", async () => {
    const { terminal, keys, step } = harness({ perCharacterMs: 30 });
    const pending = terminal.submit("/reset");
    await new Promise((tick) => setImmediate(tick));
    terminal.requestStop();
    void step();

    await expect(pending).resolves.toEqual([]);
    expect(keys).toEqual(["ctrl-u"]);
  });

  it("types nothing once the run has already been stopped", async () => {
    const { terminal, typed } = harness({ perCharacterMs: 30 });
    terminal.requestStop();
    await expect(terminal.submit("/reset")).resolves.toEqual([]);
    expect(typed).toEqual([]);
  });
});

describe("printing a note", () => {
  it("leaves the two blank lines the prompt redraw eats", () => {
    // The prompt is three rows, so readline rewinds two and clears to the end
    // of the screen. With one trailing newline the last two lines of the note
    // are erased — the pre-flight warning lost the two commands it was asking
    // the operator to choose between.
    const { terminal, written } = harness();
    terminal.note({
      actor: "Arturo",
      label: "Choose",
      body: ["first option", "second option"].join("\n"),
    });
    expect(written[0].endsWith("second option\n\n\n")).toBe(true);
  });
});

describe("a turn that never completes", () => {
  it("resolves whatever the interface reports, including an error", async () => {
    // The interface notifies on its error path too. Notifying only on success
    // would leave the run waiting for ever on the first command that throws.
    const { terminal } = harness();
    const pending = terminal.submit("/broken");
    await new Promise((tick) => setImmediate(tick));
    const failure: readonly WorkStreamEntry[] = [
      { actor: "Arturo", label: "Error", body: "Task not found: task-1" },
    ];
    terminal.notifyTurnComplete("/broken", failure);
    await expect(pending).resolves.toEqual(failure);
  });

  it("does nothing when nothing is waiting", () => {
    const { terminal } = harness();
    expect(() => terminal.notifyTurnComplete("/overview", done)).not.toThrow();
  });
});
