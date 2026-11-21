import { describe, expect, it } from "vitest";

import {
  isDeniedAutoLine,
  refuseUnauthorisedApproval,
  runBotSession,
  turnFailed,
  waitForWorkToSettle,
  type BotAction,
  type BotInputSource,
} from "./botDriver";

import { createRecordingBotTerminal, type BotTerminal } from "./botTerminal";
import { BOT_OPERATOR_NAME } from "./botOperator";
import { DEFAULT_PACING, type BotRunMode } from "./botArgs";
import type { WorkStreamEntry } from "../ui/uiState";

const scripted: Extract<BotRunMode, { kind: "scripted" }> = {
  kind: "scripted",
  planPath: "test.plan",
  pacing: DEFAULT_PACING,
  mayApprove: false,
  assumeYes: true,
  mayUsePaidModel: false,
  quiet: false,
};

const auto: Extract<BotRunMode, { kind: "auto" }> = {
  kind: "auto",
  goal: "test",
  pacing: DEFAULT_PACING,
  maxTurns: 25,
  maxMinutes: 15,
  mayApprove: false,
  mayUsePaidModel: false,
  quiet: false,
};

function sourceOf(actions: readonly BotAction[]): BotInputSource {
  let index = 0;
  return {
    describe: "test",
    async next() {
      return actions[index++];
    },
  };
}

const ok = (label: string): readonly WorkStreamEntry[] => [
  { actor: "Arturo", label, body: "" },
];

/** No real waiting: the pacing is for a viewer, not for the test. */
const noSleep = async (): Promise<void> => undefined;

function run(input: {
  readonly actions: readonly BotAction[];
  readonly mode?: BotRunMode & { kind: "scripted" | "auto" };
  readonly terminal?: BotTerminal;
  readonly isFlowOpen?: () => boolean;
  readonly closeOpenFlowLine?: () => string;
  readonly ensureApprover?: () => void;
  readonly isWorkInFlight?: () => boolean;
  readonly events?: string[];
}) {
  const terminal = input.terminal ?? createRecordingBotTerminal(() => ok("Done"));
  return {
    terminal,
    summary: runBotSession({
      source: sourceOf(input.actions),
      terminal,
      mode: input.mode ?? scripted,
      sleep: noSleep,
      // Nothing queued unless a test says so, so a wait does not reach for the
      // real job queue.
      isWorkInFlight: input.isWorkInFlight ?? (() => false),
      isFlowOpen: input.isFlowOpen,
      closeOpenFlowLine: input.closeOpenFlowLine,
      ensureApprover: input.ensureApprover ?? (() => undefined),
      emit: (type, message) => input.events?.push(`${type}: ${message}`),
    }),
  };
}

describe("running a session", () => {
  it("types each line and stops when the source runs out", async () => {
    const events: string[] = [];
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    const result = await run({
      actions: [
        { kind: "line", line: "/overview" },
        { kind: "line", line: "/tasks" },
      ],
      terminal,
      events,
    }).summary;

    expect(terminal.submitted).toEqual(["/overview", "/tasks"]);
    expect(result).toEqual({ turns: 2, failures: 0, stopReason: "the script finished" });
    expect(events).toEqual([
      expect.stringContaining("bot.session_started"),
      "bot.input: Bot submitted: /overview",
      "bot.input: Bot submitted: /tasks",
      expect.stringContaining("bot.session_finished"),
    ]);
  });

  it("says out loud that nothing was typed by a person", async () => {
    const events: string[] = [];
    await run({ actions: [], events }).summary;
    expect(events[0]).toContain("Nothing in this session was typed by a person.");
  });

  it("counts a refusal without abandoning the script", async () => {
    const terminal = createRecordingBotTerminal((line) =>
      line === "/task create" ? ok("Refused") : ok("Done")
    );
    const result = await run({
      actions: [
        { kind: "line", line: "/task create" },
        { kind: "line", line: "/overview" },
      ],
      terminal,
    }).summary;

    expect(terminal.submitted).toHaveLength(2);
    expect(result.failures).toBe(1);
  });

  it("shows a wait rather than going quiet", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({ actions: [{ kind: "wait", seconds: 20 }], terminal }).summary;
    expect(terminal.submitted).toEqual([]);
    expect(terminal.notes[0].body).toContain("get on with the work");
  });

  it("says so when the work outlasts the ceiling", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({
      actions: [{ kind: "wait", seconds: 20 }],
      terminal,
      isWorkInFlight: () => true,
    }).summary;
    expect(terminal.notes.map((note) => note.label)).toContain("Still working");
  });

  it("does not announce a ceiling the work finished inside", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({ actions: [{ kind: "wait", seconds: 20 }], terminal }).summary;
    expect(terminal.notes.map((note) => note.label)).not.toContain("Still working");
  });
});

describe("waitForWorkToSettle", () => {
  const noSleep = async (): Promise<void> => undefined;

  it("ends as soon as the work is done, not when the ceiling is up", async () => {
    // Four polls of work, against a ceiling that would allow a thousand.
    let remaining = 4;
    const result = await waitForWorkToSettle({
      ceilingMs: 250_000,
      pollMs: 250,
      sleep: noSleep,
      isWorkInFlight: () => remaining-- > 0,
    });
    expect(result.hitCeiling).toBe(false);
    expect(result.polls).toBeLessThan(10);
  });

  it("gives the work a moment to appear before deciding there is none", async () => {
    // Nothing in flight when the wait starts, and something by the third look.
    let looks = 0;
    const result = await waitForWorkToSettle({
      ceilingMs: 250_000,
      pollMs: 250,
      startWindowMs: 2000,
      sleep: noSleep,
      isWorkInFlight: () => {
        looks += 1;
        return looks > 2 && looks < 6;
      },
    });
    expect(result.hitCeiling).toBe(false);
    expect(looks).toBeGreaterThan(5);
  });

  it("carries on when nothing ever starts", async () => {
    const result = await waitForWorkToSettle({
      ceilingMs: 250_000,
      pollMs: 250,
      startWindowMs: 2000,
      sleep: noSleep,
      isWorkInFlight: () => false,
    });
    expect(result.hitCeiling).toBe(false);
    // The start window and nothing more: it did not sit out the ceiling.
    expect(result.polls).toBe(8);
  });

  it("keeps waiting when finishing one Task queues the next", async () => {
    // In flight, a gap of one look while the follow-on is queued, in flight
    // again. Stopping in the gap is what would type over the second result.
    const flight = [true, false, true, true, false, false, false];
    let look = 0;
    const result = await waitForWorkToSettle({
      ceilingMs: 250_000,
      pollMs: 250,
      sleep: noSleep,
      isWorkInFlight: () => flight[look++] ?? false,
    });
    expect(result.hitCeiling).toBe(false);
    // Past the gap at index 1 and through the second stretch of work. Stopping
    // at the gap would have returned after three looks at most.
    expect(look).toBeGreaterThan(4);
  });

  it("stops at the ceiling when the work never finishes", async () => {
    const result = await waitForWorkToSettle({
      ceilingMs: 1000,
      pollMs: 250,
      sleep: noSleep,
      isWorkInFlight: () => true,
    });
    expect(result.hitCeiling).toBe(true);
    expect(result.polls).toBe(4);
  });

  it("stops when the source asks, and says why", async () => {
    const result = await run({
      actions: [
        { kind: "line", line: "/overview" },
        { kind: "stop", reason: "the model gave up" },
        { kind: "line", line: "/tasks" },
      ],
    }).summary;
    expect(result.stopReason).toBe("the model gave up");
    expect(result.turns).toBe(1);
  });
});

describe("answering a staff review", () => {
  it("keeps answering while the review is open, rather than guessing a count", async () => {
    // The expect harness has to send more `yes` lines than it expects, because
    // the number of proposed Workers is model-generated. In-process the open
    // flow is a fact.
    let open = 3;
    const terminal = createRecordingBotTerminal((line) => {
      if (line === "yes") open -= 1;
      return ok("Done");
    });
    await run({
      actions: [{ kind: "staff", line: "/staff" }],
      terminal,
      isFlowOpen: () => open > 0,
    }).summary;

    expect(terminal.submitted).toEqual(["/staff", "yes", "yes", "yes"]);
  });

  it("closes an open worker chat the way a worker chat closes", async () => {
    // A chat takes plain text as a message, so "cancel" is a question put to
    // the model. Sending it five times took a finished run from 4,000 to 12,000
    // tokens and printed four near-identical walls of text after the run was
    // supposed to be over.
    let chatting = true;
    const terminal = createRecordingBotTerminal((line) => {
      if (line === "/chat end") chatting = false;
      return ok("Read-only worker chat");
    });
    await run({
      actions: [{ kind: "line", line: "/timeline" }],
      terminal,
      isFlowOpen: () => chatting,
      closeOpenFlowLine: () => (chatting ? "/chat end" : "cancel"),
    }).summary;

    expect(terminal.submitted).toEqual(["/timeline", "/chat end"]);
  });

  it("gives up rather than repeating a close line that did not work", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Still asking"));
    await run({
      actions: [{ kind: "line", line: "/overview" }],
      terminal,
      isFlowOpen: () => true,
      closeOpenFlowLine: () => "cancel",
    }).summary;

    // One attempt, then it says so instead of sending four more.
    expect(terminal.submitted).toEqual(["/overview", "cancel"]);
    expect(terminal.notes.some((note) => note.label === "Left a question open")).toBe(true);
  });

  it("never hands the terminal back in the middle of a question", async () => {
    let open = true;
    const terminal = createRecordingBotTerminal((line) => {
      if (line === "cancel") open = false;
      return ok("Done");
    });
    await run({
      actions: [{ kind: "line", line: "/function" }],
      terminal,
      isFlowOpen: () => open,
    }).summary;

    expect(terminal.submitted[terminal.submitted.length - 1]).toBe("cancel");
  });
});

describe("approving as the bot", () => {
  it("names the bot on every approval it submits", async () => {
    // Without this the line is bare, and resolveApprovalCommandIdentity signs
    // it under the only eligible human — a script signing as a person.
    const terminal = createRecordingBotTerminal(() => ok("Approved"));
    await run({
      actions: [{ kind: "line", line: "/approve task-1" }],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    expect(terminal.submitted).toEqual([`/approve task-1 --as "${BOT_OPERATOR_NAME}"`]);
  });

  it("registers the approver before the first approval, not at startup", async () => {
    // Most plans open with /reset, which deletes the Worker registry: an
    // operator registered up front is gone by the time it is needed, and the
    // approval is refused with "No registered Worker named …".
    const registeredAfter: number[] = [];
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({
      actions: [
        { kind: "line", line: "/reset" },
        { kind: "line", line: "/overview" },
        { kind: "line", line: "/approve task-1" },
      ],
      mode: { ...scripted, mayApprove: true },
      terminal,
      ensureApprover: () => registeredAfter.push(terminal.submitted.length),
    }).summary;

    expect(registeredAfter).toEqual([2]);
  });

  it("refuses a plan's approval when the run may not sign, and says so at the end", async () => {
    // Scenario 001 contains /approve. Before this, a scripted run without
    // --approve typed it bare, the sole eligible human was auto-selected, and
    // the record read "Approved by Publication Reviewer" — while the closing
    // note said nothing had been approved.
    const terminal = createRecordingBotTerminal(() => ok("Approval"));
    const result = await run({
      actions: [
        { kind: "line", line: "/tasks" },
        { kind: "line", line: "/approve task-1" },
      ],
      terminal,
    }).summary;

    expect(terminal.submitted).toEqual(["/tasks"]);
    expect(result.failures).toBe(1);

    const refusal = terminal.notes.find((note) => note.label === "Bot line turned down");
    expect(refusal?.body).toContain("/approve task-1");
    expect(refusal?.body).toContain("the one person here who is allowed to approve");

    const finished = terminal.notes[terminal.notes.length - 1].body;
    expect(finished).toContain("1 sign-off line in the script was turned down");
    expect(finished).not.toContain("Nothing was signed off");
  });

  it("still lists approvals when it may not make them", async () => {
    // /approvals and /approval-status begin with /approve and are reads.
    const terminal = createRecordingBotTerminal(() => ok("Approvals"));
    await run({
      actions: [
        { kind: "line", line: "/approvals" },
        { kind: "line", line: "/approval-status task-1" },
      ],
      terminal,
    }).summary;

    expect(terminal.submitted).toEqual(["/approvals", "/approval-status task-1"]);
  });

  it("leaves an approval alone when it already says who", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Approved"));
    await run({
      actions: [{ kind: "line", line: '/approve task-1 --as "Ada Fenwick"' }],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    expect(terminal.submitted).toEqual(['/approve task-1 --as "Ada Fenwick"']);
  });

  it("does not claim the bot signed anything when every line named a person", async () => {
    // Scenario 051's plan names its approver on every line, so --approve lets
    // the bot type them but the bot signs nothing. The closing note used to
    // claim otherwise off the flag alone — on an accountability claim, in a
    // run whose whole point is that a named person decided.
    const terminal = createRecordingBotTerminal(() => ok("Approval"));
    await run({
      actions: [{ kind: "line", line: '/approve task-1 --as "Principal Architect"' }],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    const finished = terminal.notes[terminal.notes.length - 1].body;
    expect(finished).toContain("every decision in this script named a real person");
    expect(finished).not.toContain(BOT_OPERATOR_NAME);
  });

  it("counts the decisions it did sign", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Approval"));
    await run({
      actions: [
        { kind: "line", line: "/approve task-1" },
        { kind: "line", line: "/approve task-2" },
      ],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    const finished = terminal.notes[terminal.notes.length - 1].body;
    expect(finished).toContain(`2 decisions in this run were signed off by ${BOT_OPERATOR_NAME}`);
  });

  it("says the operator it registered is still there", async () => {
    // It shows in /workers afterwards as a fourth "Human". Leaving it is
    // deliberate — removing it would leave the signed decisions pointing at an
    // approver who no longer exists — so the run says so rather than letting it
    // be a surprise.
    const terminal = createRecordingBotTerminal(() => ok("Approved"));
    await run({
      actions: [{ kind: "line", line: "/approve task-1" }],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    const finished = terminal.notes[terminal.notes.length - 1].body;
    expect(finished).toContain("still on your team");
    expect(finished).toContain("/workers");
  });

  it("does not mention an operator it never registered", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({
      actions: [{ kind: "line", line: "/overview" }],
      mode: { ...scripted, mayApprove: true },
      terminal,
    }).summary;

    expect(terminal.notes[terminal.notes.length - 1].body).not.toContain("still on your team");
  });

  it("says at the end whether anything was signed by a bot", async () => {
    // A run that decided nothing must not claim the bot signed anything, even
    // with --approve. This assertion used to be the other way round, which is
    // how the note came to say it on a run that signed nothing at all.
    const approving = createRecordingBotTerminal(() => ok("Done"));
    await run({ actions: [], mode: { ...scripted, mayApprove: true }, terminal: approving }).summary;
    expect(approving.notes[0].body).toContain("The bot signed nothing off");
    expect(approving.notes[0].body).not.toContain(BOT_OPERATOR_NAME);

    const watching = createRecordingBotTerminal(() => ok("Done"));
    await run({ actions: [], terminal: watching }).summary;
    expect(watching.notes[0].body).toContain("Nothing was signed off");
  });

  it("does not write a closing note that the renderer will read as a table row", async () => {
    // lineInterface's KEY_VALUE_LINE turns "<label up to 32 chars>: value" into
    // an aligned two-column row and drops the colon — right for Arturo's own
    // output, wrong for a sentence. "Nothing was signed by the bot: every
    // decision …" is 29 characters before the colon, so every run printed it
    // with the punctuation silently removed and a gutter in its place.
    const KEY_VALUE_LINE = /^(\s*)([^:\n]{1,32}):\s+(.*)$/;

    for (const mayApprove of [true, false]) {
      const terminal = createRecordingBotTerminal(() => ok("Done"));
      await run({
        actions: [],
        mode: { ...scripted, mayApprove },
        terminal,
      }).summary;

      for (const line of terminal.notes[0].body.split("\n")) {
        expect(KEY_VALUE_LINE.test(line)).toBe(false);
      }
    }
  });
});

describe("limits on an autonomous run", () => {
  it("stops at the turn limit", async () => {
    const forever: BotInputSource = {
      describe: "test",
      async next() {
        return { kind: "line", line: "/overview" };
      },
    };
    const result = await runBotSession({
      source: forever,
      terminal: createRecordingBotTerminal(() => ok("Done")),
      mode: { ...auto, maxTurns: 4 },
      sleep: noSleep,
      emit: () => undefined,
    });
    expect(result.turns).toBe(4);
    expect(result.stopReason).toBe("it hit its limit of 4 turns");
  });

  it("counts refusals consecutively, not cumulatively", async () => {
    // A run that gets three things wrong across twenty-five turns is working;
    // a run that gets three wrong in a row is stuck. Only the second is worth
    // stopping for.
    const lines = ["/overview", "/nonsense", "/tasks", "/nonsense", "/timeline"];
    let index = 0;
    const source: BotInputSource = {
      describe: "test",
      async next() {
        return index < lines.length ? { kind: "line", line: lines[index++] } : undefined;
      },
    };
    const result = await runBotSession({
      source,
      terminal: createRecordingBotTerminal((line) =>
        line === "/nonsense" ? ok("Command not found") : ok("Done")
      ),
      mode: auto,
      sleep: noSleep,
      emit: () => undefined,
    });
    expect(result.turns).toBe(5);
    expect(result.failures).toBe(2);
    expect(result.stopReason).toBe("the script finished");
  });

  it("gives up after three refusals rather than flailing", async () => {
    const failing: BotInputSource = {
      describe: "test",
      async next() {
        return { kind: "line", line: "/nonsense" };
      },
    };
    const result = await runBotSession({
      source: failing,
      terminal: createRecordingBotTerminal(() => ok("Command not found")),
      mode: auto,
      sleep: noSleep,
      emit: () => undefined,
    });
    expect(result.stopReason).toBe("its last three suggestions were all turned down");
  });

  it("shows a refused line instead of hiding it", async () => {
    const terminal = createRecordingBotTerminal(() => ok("Done"));
    await run({
      actions: [{ kind: "line", line: "/reset" }],
      mode: auto,
      terminal,
    }).summary;

    expect(terminal.submitted).toEqual([]);
    expect(terminal.notes[0].label).toBe("Bot line turned down");
    expect(terminal.notes[0].body).toContain("/reset");
  });
});

describe("what the model may not run", () => {
  it("never lets a model erase the installation", () => {
    expect(isDeniedAutoLine("/reset")).toContain("not allowed");
    expect(isDeniedAutoLine("/RESET --yes")).toContain("not allowed");
  });

  it("refuses removals", () => {
    expect(isDeniedAutoLine("/workers remove Ada")).toBeDefined();
    expect(isDeniedAutoLine("/function remove f-1")).toBeDefined();
  });

  it("allows ordinary commands", () => {
    expect(isDeniedAutoLine("/overview")).toBeUndefined();
  });
});

describe("what no run may do unless it was started with --approve", () => {
  it("refuses an approval, whatever proposed it", () => {
    // This was checked in autonomous mode only, and scenario 001 contains
    // /approve. A scripted run typed it bare, the sole eligible human was
    // auto-selected, and the record read "Approved by Publication Reviewer".
    expect(refuseUnauthorisedApproval("/approve task-1", false)).toContain("--approve");
    expect(refuseUnauthorisedApproval("/reject task-1", false)).toContain("--approve");
    // Signing a result off is a decision in a person's name too.
    expect(refuseUnauthorisedApproval("/task signoff task-1", false)).toContain("--approve");
    expect(refuseUnauthorisedApproval("/task inspect task-1", false)).toBeUndefined();
    expect(refuseUnauthorisedApproval("  /APPROVE task-1  ", false)).toContain("--approve");
  });

  it("says what would have happened, not just that it refused", () => {
    expect(refuseUnauthorisedApproval("/approve task-1", false)).toContain(
      "the one person here who is allowed to approve"
    );
  });

  it("allows it when the run was started with --approve", () => {
    expect(refuseUnauthorisedApproval("/approve task-1", true)).toBeUndefined();
  });

  it("leaves everything else alone", () => {
    for (const line of ["/approvals", "/approval-status task-1", "/overview", "yes"]) {
      expect(refuseUnauthorisedApproval(line, false)).toBeUndefined();
    }
  });
});

describe("reading a result as a failure", () => {
  it("recognises the refusals Arturo actually writes", () => {
    for (const label of [
      "Refused",
      "Task not created",
      "Worker not found",
      "Workflow failed",
      "Unknown option",
      "Usage",
      "Error",
    ]) {
      expect(turnFailed([{ actor: "Arturo", label, body: "" }])).toBe(true);
    }
  });

  it("does not read a success as a failure", () => {
    expect(turnFailed([{ actor: "Arturo", label: "Task created", body: "" }])).toBe(false);
  });
});
