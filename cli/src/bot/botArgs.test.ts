import { describe, expect, it } from "vitest";

import {
  DEFAULT_BOT_PLAN,
  DEFAULT_PACING,
  parseBotArguments,
  resolveBotPlanPath,
} from "./botArgs";

function scripted(argv: readonly string[]) {
  const result = parseBotArguments(argv);
  if (!result.ok) throw new Error(result.error);
  if (result.mode.kind !== "scripted") throw new Error(`not scripted: ${result.mode.kind}`);
  return result.mode;
}

describe("reading the command line", () => {
  it("leaves an ordinary session alone", () => {
    expect(parseBotArguments([])).toEqual({ ok: true, mode: { kind: "human" } });
    // Not every argument is ours: `npm run ui` may pass through others.
    expect(parseBotArguments(["--colour"])).toEqual({
      ok: true,
      mode: { kind: "human" },
    });
  });

  it("replays scenario 001 when no script is named", () => {
    const mode = scripted(["bot"]);
    expect(mode.planPath).toBe(resolveBotPlanPath(DEFAULT_BOT_PLAN));
    expect(mode.pacing).toEqual(DEFAULT_PACING);
    expect(mode.mayApprove).toBe(false);
    expect(mode.assumeYes).toBe(false);
  });

  it("takes a scenario number positionally, because npm keeps flags for itself", () => {
    // `npm run ui bot 025` has to work as typed: npm forwards positional
    // arguments but consumes anything starting with -, so the modes are words.
    expect(scripted(["bot", "025"]).planPath).toBe(resolveBotPlanPath("025"));
  });

  it("takes a path when one is given", () => {
    expect(scripted(["bot", "/tmp/demo.plan"]).planPath).toBe("/tmp/demo.plan");
  });

  it("reads the flags that follow --", () => {
    const mode = scripted(["bot", "--pace", "3000", "--approve", "--yes"]);
    expect(mode.pacing.betweenTurnsMs).toBe(3000);
    expect(mode.mayApprove).toBe(true);
    expect(mode.assumeYes).toBe(true);
  });

  it("refuses a pace that is not a number rather than silently racing", () => {
    const result = parseBotArguments(["bot", "--pace", "quickly"]);
    expect(result).toEqual({
      ok: false,
      error: '--pace needs a number of milliseconds, not "quickly".',
    });
  });

  it("needs a goal for autonomous mode", () => {
    const result = parseBotArguments(["bot", "auto"]);
    expect(result.ok).toBe(false);
  });

  it("reads an autonomous goal and its limits", () => {
    const result = parseBotArguments([
      "bot",
      "auto",
      "grow",
      "a",
      "legal",
      "practice",
      "--max-turns",
      "40",
      "--max-minutes",
      "5",
    ]);
    expect(result).toEqual({
      ok: true,
      mode: {
        kind: "auto",
        goal: "grow a legal practice",
        pacing: DEFAULT_PACING,
        maxTurns: 40,
        maxMinutes: 5,
        mayApprove: false,
        mayUsePaidModel: false,
        quiet: false,
      },
    });
  });

  it("refuses limits that would remove the limit", () => {
    expect(parseBotArguments(["bot", "auto", "x", "--max-turns", "0"]).ok).toBe(false);
    expect(parseBotArguments(["bot", "auto", "x", "--max-minutes", "0"]).ok).toBe(false);
  });
});

describe("finding a plan", () => {
  it("adds the extension to a bare number", () => {
    expect(resolveBotPlanPath("001").endsWith("/scenario_harness/plans/001.plan")).toBe(true);
    expect(resolveBotPlanPath("001.plan")).toBe(resolveBotPlanPath("001"));
  });

  it("passes a path through untouched", () => {
    expect(resolveBotPlanPath("./demo.plan")).toBe("./demo.plan");
  });
});
