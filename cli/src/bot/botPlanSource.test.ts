import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  captureFromEntries,
  parseBotPlan,
  planResetsState,
  stripAnsi,
  stripSurroundingBraces,
  substituteBotPlanVariables,
} from "./botPlanSource";

const PLANS_DIRECTORY = join(__dirname, "..", "..", "scenario_harness", "plans");

describe("parsing a plan", () => {
  it("reads a command line as a line", () => {
    expect(parseBotPlan("/overview")).toEqual([{ kind: "line", line: "/overview" }]);
  });

  it("ignores blank lines and comments", () => {
    expect(parseBotPlan(["# set up", "", "  ", "/overview"].join("\n"))).toEqual([
      { kind: "line", line: "/overview" },
    ]);
  });

  it("keeps the whole remainder of a note or a staff line", () => {
    expect(parseBotPlan("@note Watch the routing reason")).toEqual([
      { kind: "note", text: "Watch the routing reason" },
    ]);
    expect(parseBotPlan('@staff /task create "Draft the brief"')).toEqual([
      { kind: "staff", line: '/task create "Draft the brief"' },
    ]);
  });

  it("reads a capture's name and pattern", () => {
    expect(parseBotPlan("@cap TASK_ID {(task-[0-9]+)}")).toEqual([
      { kind: "capture", name: "TASK_ID", pattern: "(task-[0-9]+)" },
    ]);
  });

  it("keeps @timeout as a directive rather than dropping it silently", () => {
    // It cannot do anything here — the driver awaits each command — but a
    // dropped directive is a plan that quietly means something else.
    expect(parseBotPlan("@timeout 240")).toEqual([{ kind: "timeout" }]);
  });

  it("surfaces a directive it does not know", () => {
    expect(parseBotPlan("@sendkeys ^C")).toEqual([
      { kind: "unsupported", directive: "@sendkeys" },
    ]);
  });

  it("treats a wait with no number as no wait, not as NaN", () => {
    expect(parseBotPlan("@wait")).toEqual([{ kind: "wait", seconds: 0 }]);
  });
});

describe("every scenario plan", () => {
  const files = readdirSync(PLANS_DIRECTORY).filter((name) => name.endsWith(".plan"));

  it("has plans to run", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("uses only directives bot mode understands", () => {
    // Fails the day someone adds a directive to the expect harness without
    // teaching the bot about it, rather than the bot silently skipping a step
    // in a live demonstration.
    const unsupported: string[] = [];
    for (const file of files) {
      const directives = parseBotPlan(readFileSync(join(PLANS_DIRECTORY, file), "utf8"));
      for (const directive of directives) {
        if (directive.kind === "unsupported") {
          unsupported.push(`${file}: ${directive.directive}`);
        }
      }
    }
    expect(unsupported).toEqual([]);
  });

  it("gives every capture a name and a pattern", () => {
    const broken: string[] = [];
    for (const file of files) {
      for (const directive of parseBotPlan(readFileSync(join(PLANS_DIRECTORY, file), "utf8"))) {
        if (directive.kind !== "capture") continue;
        if (!directive.name || !directive.pattern) {
          broken.push(`${file}: @cap ${directive.name} ${directive.pattern}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("stripping the expect driver's braces", () => {
  it("removes one wrapping pair", () => {
    expect(stripSurroundingBraces("{(task-[0-9]+)}")).toBe("(task-[0-9]+)");
  });

  it("leaves a bare pattern alone", () => {
    expect(stripSurroundingBraces("task-[0-9]+")).toBe("task-[0-9]+");
  });
});

describe("filling in a captured value", () => {
  it("substitutes what was captured", () => {
    expect(
      substituteBotPlanVariables("/approve {{TASK_ID}}", new Map([["TASK_ID", "task-7"]]))
    ).toBe("/approve task-7");
  });

  it("falls back to the placeholder the written scenario uses", () => {
    // So a failed capture reads like following the doc literally, and fails the
    // same way, rather than as a bot-specific mystery.
    expect(substituteBotPlanVariables("/approve {{TASK_ID}}", new Map())).toBe(
      "/approve <task-id>"
    );
  });
});

describe("capturing from a result", () => {
  it("prefers the first group over the whole match", () => {
    expect(
      captureFromEntries(
        [{ actor: "Arturo", label: "Task created", body: "ID   task-7" }],
        "(task-[0-9]+)"
      )
    ).toBe("task-7");
  });

  it("returns nothing when the pattern does not match", () => {
    expect(
      captureFromEntries([{ actor: "Arturo", label: "Tasks", body: "None yet." }], "(task-[0-9]+)")
    ).toBeUndefined();
  });

  it("matches the words, not the colour codes around them", () => {
    expect(
      captureFromEntries(
        [{ actor: "Arturo", label: "Task", body: "ID   \u001b[32mtask-7\u001b[39m" }],
        "(task-[0-9]+)"
      )
    ).toBe("task-7");
  });
});

describe("noticing a destructive plan", () => {
  it("sees a /reset at the top", () => {
    expect(planResetsState(parseBotPlan(["@wait 2", "/reset", "/overview"].join("\n")))).toBe(true);
  });

  it("does not fire on a plan that never resets", () => {
    expect(planResetsState(parseBotPlan(["/overview", "/tasks"].join("\n")))).toBe(false);
  });
});

describe("stripping colour", () => {
  it("leaves plain text alone", () => {
    expect(stripAnsi("Worker  Ada Fenwick")).toBe("Worker  Ada Fenwick");
  });
});
