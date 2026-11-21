import { beforeEach, describe, expect, it } from "vitest";
import { clearRuntimeEventStore, listRuntimeEventStore } from "./runtimeEventStore";
import {
  clearProviderSends,
  listProviderSends,
  recordProviderSend,
  recordSearchSend,
  repeatOnNamedWorkRefusal,
  runOf,
  sendStartedAt,
  wouldRepeatSend,
} from "./providerSendLog";

beforeEach(() => {
  clearProviderSends();
  clearRuntimeEventStore();
});

describe("the provider send log (C2)", () => {
  it("stores when each send started, before the call, and a rerun after a restart as a repeat", () => {
    const firstRun = { id: "task-1", createdAt: 1, startedAt: 10 };
    recordProviderSend(firstRun, "task", 1, 11);
    recordProviderSend(firstRun, "task", 2, 12);
    expect(sendStartedAt("task-1")).toBe(11);
    expect(listProviderSends("task-1").map((send) => send.repeat)).toEqual([false, false]);
    expect(listRuntimeEventStore().some((event) => event.type === "runtime.send.repeated")).toBe(false);

    // Arturo stopped; the Task was queued again and runs a second time.
    const secondRun = { ...firstRun, startedAt: 20 };
    expect(wouldRepeatSend(secondRun, "task", runOf(secondRun, "task"))).toBe(true);
    // The same id used again after /reset is a different Task.
    expect(wouldRepeatSend({ id: "task-1", createdAt: 2 }, "task", 30)).toBe(false);
    const repeat = recordProviderSend(secondRun, "task", 1, 21);

    expect(repeat).toMatchObject({ repeat: true, run: 20, call: 1, at: 21 });
    expect(sendStartedAt("task-1")).toBe(11);
    expect(listRuntimeEventStore().find((event) => event.type === "runtime.send.repeated")?.message).toContain("Task task-1 is being sent to");
  });

  it("keeps the outcome assessment's sends apart from the Task's own", () => {
    recordProviderSend({ id: "task-2", createdAt: 1, startedAt: 10, completedAt: 15 }, "task", 1, 11);
    recordProviderSend({ id: "task-2", createdAt: 1, startedAt: 10, completedAt: 15 }, "outcome-assessment", 1, 16);
    expect(listProviderSends("task-2").map((send) => [send.purpose, send.repeat])).toEqual([["task", false], ["outcome-assessment", false]]);
    expect(sendStartedAt("task-2", "outcome-assessment")).toBe(16);
  });

  it("logs each web search, with its words and search provider, as a send, and a rerun as a repeat (S4)", () => {
    const firstRun = { id: "task-4", createdAt: 1, startedAt: 10 };
    expect(recordSearchSend(firstRun, "brave", "outerwear trends", 11)).toMatchObject({ purpose: "web-search", provider: "brave", query: "outerwear trends", repeat: false, at: 11 });
    expect(listProviderSends("task-4")).toMatchObject([{ purpose: "web-search", query: "outerwear trends" }]);
    recordSearchSend({ ...firstRun, startedAt: 20 }, "brave", "outerwear trends", 21);
    expect(listProviderSends("task-4").map((send) => send.repeat)).toEqual([false, true]);
    expect(listRuntimeEventStore().find((event) => event.type === "runtime.send.repeated")?.message).toContain("is searching brave again");
  });

  it("says why named work is not sent again", () => {
    expect(repeatOnNamedWorkRefusal("task-3")).toContain("not sent again until a person asks for it again");
  });
});
