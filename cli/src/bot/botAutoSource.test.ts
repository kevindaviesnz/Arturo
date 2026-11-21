import { describe, expect, it } from "vitest";

import {
  buildBotAutoPrompt,
  createBotAutoSource,
  fallbackBotAutoLine,
  parseBotAutoReply,
  readMenuOptionCount,
  refuseBotAutoLine,
  type BotAutoDependencies,
} from "./botAutoSource";

import type { BotTurn } from "./botDriver";
import type { SetupState } from "../ui/uiSetupProgress";

const EMPTY: SetupState = { functionCount: 0, workerCount: 0 };
const STAFFED: SetupState = {
  enterpriseName: "Harbour Youth Trust",
  functionCount: 2,
  workerCount: 3,
};

function turn(line: string, label: string, body: string): BotTurn {
  return { line, entries: [{ actor: "Arturo", label, body }], failed: false };
}

function dependencies(
  replies: readonly string[],
  overrides: Partial<BotAutoDependencies> = {}
): BotAutoDependencies & { readonly notes: string[]; readonly prompts: string[] } {
  const notes: string[] = [];
  const prompts: string[] = [];
  let index = 0;
  return {
    notes,
    prompts,
    async generate(prompt) {
      prompts.push(prompt);
      return replies[Math.min(index++, replies.length - 1)];
    },
    readState: () => STAFFED,
    isFlowOpen: () => false,
    note: (label, body) => notes.push(`${label}: ${body}`),
    ...overrides,
  };
}

describe("salvaging a line from a model's reply", () => {
  // Captured from llama3.2 against the real prompt, not invented for the test.
  it("takes a bare command as it stands", () => {
    expect(parseBotAutoReply('/enterprise "Small Charity Foundation"')).toBe(
      '/enterprise "Small Charity Foundation"'
    );
    expect(parseBotAutoReply("/refine-worker")).toBe("/refine-worker");
    expect(parseBotAutoReply("2")).toBe("2");
  });

  it("strips the packaging a chat model adds", () => {
    expect(parseBotAutoReply("```\n/overview\n```")).toBe("/overview");
    expect(parseBotAutoReply("`/overview`")).toBe("/overview");
    expect(parseBotAutoReply("arturo › /overview")).toBe("/overview");
    expect(parseBotAutoReply("- /overview")).toBe("/overview");
    expect(parseBotAutoReply("1. /overview")).toBe("/overview");
    expect(parseBotAutoReply("/overview  # see where things stand")).toBe("/overview");
  });

  it("finds the command under a prose preamble", () => {
    expect(
      parseBotAutoReply(
        ["Sure! Here's the next command to run:", "", "/staff", "", "This proposes Workers."].join("\n")
      )
    ).toBe("/staff");
  });

  it("takes a short free-text answer when that is the whole reply", () => {
    // The guided flows ask for names and descriptions, so one short line is a
    // legitimate answer — but only when it is the entire reply.
    expect(parseBotAutoReply("Harbour Youth Trust")).toBe("Harbour Youth Trust");
    expect(
      parseBotAutoReply(["Let me think about this.", "The name should reflect the mission."].join("\n"))
    ).toBeUndefined();
  });

  it("gives up rather than typing prose", () => {
    expect(parseBotAutoReply("")).toBeUndefined();
    expect(
      parseBotAutoReply(
        "I would suggest that the first thing to do here is to consider what the organisation actually needs before creating anything at all."
      )
    ).toBeUndefined();
  });
});

describe("refusing a suggestion", () => {
  it("refuses a command Arturo does not have", () => {
    // "/show overview" is a real llama3.2 suggestion. There is no /show.
    expect(
      refuseBotAutoLine({ line: "/show overview", regime: "command", recentLines: [] })
    ).toBe("Arturo has no command called /show.");
  });

  it("refuses an unquoted value of more than one word", () => {
    // Also real: this reaches the handler as separate arguments and creates
    // something called "set".
    expect(
      refuseBotAutoLine({
        line: "/enterprise set up charity for disaster relief",
        regime: "command",
        recentLines: [],
      })
    ).toContain("double quotes");
  });

  it("allows a real command with a quoted value", () => {
    expect(
      refuseBotAutoLine({
        line: '/add-human-worker "Youth Worker"',
        regime: "command",
        recentLines: [],
      })
    ).toBeUndefined();
    expect(
      refuseBotAutoLine({ line: "/overview", regime: "command", recentLines: [] })
    ).toBeUndefined();
  });

  it("refuses a line it has just run", () => {
    expect(
      refuseBotAutoLine({
        line: "/overview",
        regime: "command",
        recentLines: ["/staff", "/OVERVIEW"],
      })
    ).toContain("Repeating it");
  });

  it("lets the same answer be given to successive questions", () => {
    // A /next review asks about each proposed Function in turn, so three
    // "yes" answers running is correct. The first live autonomous run was
    // pushed off "yes" onto "skip" and then "cancel" by a loop guard that
    // treated an answer like a command, and created nothing.
    expect(
      refuseBotAutoLine({
        line: "yes",
        regime: "answer",
        recentLines: ["yes", "yes"],
      })
    ).toBeUndefined();
  });

  it("lets a line be run again once it has fallen out of the window", () => {
    expect(
      refuseBotAutoLine({
        line: "/overview",
        regime: "command",
        recentLines: ["/overview", "/staff", "/tasks", "/timeline", "/workers"],
      })
    ).toBeUndefined();
  });

  it("refuses a command typed at an open question", () => {
    // The command would be recorded as the answer — a Function named
    // "/overview", or worse.
    expect(
      refuseBotAutoLine({ line: "/overview", regime: "answer", recentLines: [] })
    ).toContain("waiting for an answer");
  });

  it("refuses a menu number the menu does not offer", () => {
    expect(
      refuseBotAutoLine({
        line: "5",
        regime: "answer",
        recentLines: [],
        menuOptionCount: 2,
      })
    ).toBe("The list only goes up to 2.");
    expect(
      refuseBotAutoLine({
        line: "2",
        regime: "answer",
        recentLines: [],
        menuOptionCount: 2,
      })
    ).toBeUndefined();
  });

  it("allows an ordinary answer", () => {
    for (const line of ["yes", "skip", "cancel", "Harbour Youth Trust"]) {
      expect(refuseBotAutoLine({ line, regime: "answer", recentLines: [] })).toBeUndefined();
    }
  });

  it("refuses an empty line", () => {
    expect(refuseBotAutoLine({ line: "   ", regime: "command", recentLines: [] })).toBe(
      "It said nothing at all."
    );
  });
});

describe("reading a menu", () => {
  it("finds how many options were offered", () => {
    expect(
      readMenuOptionCount([
        { actor: "Arturo", label: "Which Function?", body: "  1. Fundraising\n  2. Volunteer Support" },
      ])
    ).toBe(2);
  });

  it("finds nothing when nothing was numbered", () => {
    expect(
      readMenuOptionCount([{ actor: "Arturo", label: "Name?", body: "What is it called?" }])
    ).toBeUndefined();
  });
});

describe("the prompt", () => {
  it("gives an empty installation the literal command to copy", () => {
    // describeNextSetupStep returns command lines, so the model has something
    // to copy rather than invent — which is where /show overview comes from.
    const prompt = buildBotAutoPrompt({
      goal: "set up a charity",
      state: EMPTY,
      regime: "command",
      recentLines: [],
    });
    expect(prompt).toContain("/enterprise");
    expect(prompt).toContain("set up a charity");
  });

  it("changes the vocabulary when a question is open", () => {
    const answering = buildBotAutoPrompt({
      goal: "x",
      state: STAFFED,
      regime: "answer",
      recentLines: [],
    });
    expect(answering).toContain("Do NOT reply with a command");
    expect(answering).not.toContain("The commands that exist");

    const commanding = buildBotAutoPrompt({
      goal: "x",
      state: STAFFED,
      regime: "command",
      recentLines: [],
    });
    expect(commanding).toContain("The commands that exist");
  });

  it("trims a long result rather than burying the instruction in it", () => {
    // A long transcript makes a small model parrot commands it already ran.
    const prompt = buildBotAutoPrompt({
      goal: "x",
      state: STAFFED,
      regime: "command",
      last: turn("/timeline", "Timeline", "line\n".repeat(2000)),
      recentLines: [],
    });
    expect(prompt).toContain("(trimmed)");
    expect(prompt.length).toBeLessThan(6000);
  });

  it("passes a refusal back so the next attempt is different", () => {
    const prompt = buildBotAutoPrompt({
      goal: "x",
      state: STAFFED,
      regime: "command",
      recentLines: [],
      refusal: "Arturo has no command called /show.",
    });
    expect(prompt).toContain("no command called /show");
    expect(prompt).toContain("Suggest something different");
  });
});

describe("choosing a line", () => {
  it("submits a usable suggestion", async () => {
    const deps = dependencies(["/overview"]);
    const source = createBotAutoSource({ goal: "x", dependencies: deps });
    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "line",
      line: "/overview",
    });
  });

  it("shows a refused suggestion rather than retrying in silence", async () => {
    const deps = dependencies(["/show overview", "/overview"]);
    const source = createBotAutoSource({ goal: "x", dependencies: deps });

    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "line",
      line: "/overview",
    });
    expect(deps.notes.join("\n")).toContain("/show overview");
    expect(deps.notes.join("\n")).toContain("no command called /show");
  });

  it("does not repeat itself across turns", async () => {
    const deps = dependencies(["/overview"]);
    const source = createBotAutoSource({ goal: "x", dependencies: deps });
    await source.next({ turn: 1, history: [] });
    // The model keeps saying /overview; the second turn falls back instead.
    const second = await source.next({ turn: 2, history: [] });
    expect(second).not.toEqual({ kind: "line", line: "/overview" });
  });

  it("falls back to the step Arturo itself recommends after three refusals", async () => {
    const deps = dependencies(["I think we should consider the options carefully."], {
      readState: () => EMPTY,
    });
    const source = createBotAutoSource({ goal: "x", dependencies: deps });

    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "line",
      line: "/enterprise",
    });
    expect(deps.prompts).toHaveLength(3);
    expect(deps.notes.join("\n")).toContain("Trying the obvious step instead");
  });

  it("stops rather than guessing an answer to a question", async () => {
    // At an open menu there is no safe deterministic fallback: a wrong answer
    // is recorded as the operator's choice, and several flows keep whatever
    // text they are given as a name.
    const deps = dependencies(["The fundraising one, probably."], {
      isFlowOpen: () => true,
    });
    const source = createBotAutoSource({ goal: "x", dependencies: deps });
    const history = [
      turn("/task", "Which Function?", "  1. Fundraising\n  2. Volunteer Support"),
    ];
    const action = await source.next({ turn: 1, history, last: history[0] });

    expect(action?.kind).toBe("stop");
    expect(deps.notes.join("\n")).toContain("numbered list");
  });

  it("stops when the model cannot be reached", async () => {
    const source = createBotAutoSource({
      goal: "x",
      dependencies: dependencies([], {
        async generate() {
          throw new Error("connect ECONNREFUSED 127.0.0.1:11434");
        },
      }),
    });
    const action = await source.next({ turn: 1, history: [] });
    expect(action).toEqual({
      kind: "stop",
      reason: "it could not reach the model (connect ECONNREFUSED 127.0.0.1:11434)",
    });
  });

  it("gives up on a turn the model never answers", async () => {
    const source = createBotAutoSource({
      goal: "x",
      timeoutMs: 5,
      dependencies: dependencies([], {
        readState: () => EMPTY,
        generate: () => new Promise<string>(() => undefined),
      }),
    });
    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "line",
      line: "/enterprise",
    });
  });
});

describe("the deterministic fallback", () => {
  it("is the command Arturo recommends, without its explanation", () => {
    expect(fallbackBotAutoLine(EMPTY)).toBe("/enterprise");
    expect(fallbackBotAutoLine({ enterpriseName: "Acme", functionCount: 0, workerCount: 0 })).toBe(
      '/next "Acme"'
    );
    expect(fallbackBotAutoLine({ enterpriseName: "Acme", functionCount: 1, workerCount: 0 })).toBe(
      "/staff"
    );
  });

  it("is a harmless read when nothing is missing", () => {
    expect(fallbackBotAutoLine(STAFFED)).toBe("/overview");
  });
});
