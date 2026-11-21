import { describe, expect, it } from "vitest";

import { parseBotPlan } from "./botPlanSource";
import { createBotScriptedSource } from "./botScriptedSource";
import type { BotTurn } from "./botDriver";
import type { WorkStreamEntry } from "../ui/uiState";

function entries(label: string, body: string): readonly WorkStreamEntry[] {
  return [{ actor: "Arturo", label, body }];
}

function turn(line: string, label: string, body: string): BotTurn {
  return { line, entries: entries(label, body), failed: false };
}

describe("driving a scenario plan", () => {
  it("captures a value from the entries the previous line produced", async () => {
    const source = createBotScriptedSource(
      parseBotPlan(
        [
          "@cap TASK_ID {(task-[0-9]+)}",
          "/tasks",
          "/approve {{TASK_ID}}",
        ].join("\n")
      ),
      "test"
    );

    const first = await source.next({ turn: 1, history: [] });
    expect(first).toEqual({ kind: "line", line: "/tasks" });

    const history = [turn("/tasks", "Tasks", "ID   task-7\nStatus  Completed")];
    const second = await source.next({
      turn: 2,
      history,
      last: history[history.length - 1],
    });
    expect(second).toEqual({ kind: "line", line: "/approve task-7" });
  });

  it("still captures when a wait sits between the directive and the line", async () => {
    // Plans routinely read: @wait N, @cap VAR, /tasks. A wait produces no turn
    // of its own, so the capture has to survive a next() call that returns
    // something other than a submitted line.
    const source = createBotScriptedSource(
      parseBotPlan(
        [
          "@wait 5",
          "@cap WORKER {Worker\\s+([A-Za-z][A-Za-z ]+[a-z])}",
          "/tasks",
          '/chat "{{WORKER}}" "hello"',
        ].join("\n")
      ),
      "test"
    );

    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "wait",
      seconds: 5,
    });
    expect(await source.next({ turn: 2, history: [] })).toEqual({
      kind: "line",
      line: "/tasks",
    });

    const history = [
      turn("/tasks", "Tasks", "   Worker                 Publication Researcher\n"),
    ];
    const chat = await source.next({
      turn: 3,
      history,
      last: history[history.length - 1],
    });
    expect(chat).toEqual({
      kind: "line",
      line: '/chat "Publication Researcher" "hello"',
    });
  });

  it("captures from the rendered text, not the raw entry body", async () => {
    // The raw body reads "Worker: Publication Researcher"; the display
    // formatter turns it into aligned columns. Every pattern in the existing
    // plans was written against the columns, so matching the raw body finds
    // nothing and the step silently falls back to <worker>. This cost a live
    // run before it was noticed.
    const source = createBotScriptedSource(
      parseBotPlan(
        ["@cap WORKER {Worker\\s+([A-Za-z][A-Za-z ]+[a-z])}", "/tasks", '/chat "{{WORKER}}" "hi"'].join("\n")
      ),
      "test",
      (entry) => entry.body.replace("Worker: ", "Worker                 ")
    );

    await source.next({ turn: 1, history: [] });
    const history = [turn("/tasks", "Tasks", "   Worker: Publication Researcher\n")];
    const chat = await source.next({
      turn: 2,
      history,
      last: history[history.length - 1],
    });
    expect(chat).toEqual({
      kind: "line",
      line: '/chat "Publication Researcher" "hi"',
    });
  });

  it("falls back to the doc placeholder when a capture found nothing", async () => {
    // The same fallback the written scenario has, so a broken step reads exactly
    // like following the doc literally rather than as a bot-specific failure.
    const source = createBotScriptedSource(
      parseBotPlan(["@cap TASK_ID {(task-[0-9]+)}", "/tasks", "/approve {{TASK_ID}}"].join("\n")),
      "test"
    );

    await source.next({ turn: 1, history: [] });
    const history = [turn("/tasks", "Tasks", "No tasks found.")];
    const next = await source.next({
      turn: 2,
      history,
      last: history[history.length - 1],
    });
    expect(next).toEqual({ kind: "line", line: "/approve <task-id>" });
  });

  it("passes over @timeout without saying anything about it", async () => {
    const source = createBotScriptedSource(
      parseBotPlan(["@timeout 240", "/overview", "@timeout 100", "/tasks"].join("\n")),
      "test"
    );

    // It is the plan's instruction to the expect harness, not the operator's,
    // and bot mode's behaviour without it is what anyone would expect. A note
    // explaining a non-event only puts "Bot" on a screen someone is watching.
    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "line",
      line: "/overview",
    });
    expect(await source.next({ turn: 2, history: [] })).toEqual({
      kind: "line",
      line: "/tasks",
    });
  });

  it("marks a staff line so the driver answers its review", async () => {
    const source = createBotScriptedSource(parseBotPlan("@staff /staff"), "test");
    expect(await source.next({ turn: 1, history: [] })).toEqual({
      kind: "staff",
      line: "/staff",
    });
  });

  it("finishes when the plan runs out", async () => {
    const source = createBotScriptedSource(parseBotPlan("/overview"), "test");
    await source.next({ turn: 1, history: [] });
    expect(await source.next({ turn: 2, history: [] })).toBeUndefined();
  });
});
