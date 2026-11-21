import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearWorkers,
  getWorker,
  listWorkers,
} from "../control/workers";

import {
  clearAddHumanWorkerFlow,
  handleAddHumanWorkerReply,
  isAddHumanWorkerFlowActive,
  startAddHumanWorkerFlow,
} from "./uiAddHumanWorkerFlow";

describe("guided add-person flow", () => {
  beforeEach(() => {
    clearWorkers();
    clearAddHumanWorkerFlow();
  });
  afterEach(() => {
    clearWorkers();
    clearAddHumanWorkerFlow();
  });

  it("asks for a name, then a role by number, and creates an approver with no switches", () => {
    const start = startAddHumanWorkerFlow();
    expect(start[0].label).toBe("Name (eg Warehouse Lead):");
    expect(isAddHumanWorkerFlowActive()).toBe(true);

    const roleQ = handleAddHumanWorkerReply("Sam O'Neil");
    expect(roleQ?.[0].label).toBe("Responsibilities:");
    expect(roleQ?.[0].body).toContain("1. Sign off sensitive work");
    // Answers "why can't I pick both?" without a data-model change.
    expect(roleQ?.[0].body).toContain("You can add more people later");

    const emailQ = handleAddHumanWorkerReply("1");
    expect(emailQ?.[0].label).toBe("Email address:");

    const done = handleAddHumanWorkerReply("sam@example.com");
    expect(done?.[0].label).toBe("Human worker added");
    expect(done?.[0].body).toContain("can now approve sensitive work");
    // Points at the real next step (approving), not a misleading /staff re-run.
    expect(done?.[0].body).toContain("/approve");
    expect(done?.[0].body).not.toContain("Run /staff");
    expect(isAddHumanWorkerFlowActive()).toBe(false);

    const worker = getWorker("Sam O'Neil");
    expect(worker?.kind).toBe("human");
    expect(worker?.humanMode).toBe("approval");
    expect(worker?.email).toBe("sam@example.com");
  });

  it("leaves the address unset when skipped, so contact stays unavailable", () => {
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Sam O'Neil");
    handleAddHumanWorkerReply("1");
    handleAddHumanWorkerReply("skip");

    expect(getWorker("Sam O'Neil")?.email).toBeUndefined();
    expect(isAddHumanWorkerFlowActive()).toBe(false);
  });

  // The prompt is a bare "Email address:" now, with nothing offering "skip".
  // Enter on its own must leave it unset rather than store an empty string,
  // which would read as an address that is present but blank to anything
  // checking whether the person can be contacted.
  it("leaves the address unset when the operator just presses Enter", () => {
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Sam O'Neil");
    handleAddHumanWorkerReply("1");
    handleAddHumanWorkerReply("");

    expect(getWorker("Sam O'Neil")?.email).toBeUndefined();
    expect(isAddHumanWorkerFlowActive()).toBe(false);
  });

  it("creates a task-only person who cannot approve, and says so", () => {
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Alex");
    handleAddHumanWorkerReply("3");
    const done = handleAddHumanWorkerReply("skip");

    expect(done?.[0].body).toContain("cannot approve");
    expect(getWorker("Alex")?.humanMode).toBe("task");
  });

  it("reaches a role outside the short list, so no person needs a switch", () => {
    // The three-role list covers the common case. A person whose job is to
    // *produce* the work — a creator — was reachable only with
    // "--archetype creator", which is the last thing a scenario needed a
    // switch for.
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Design File Creator");

    const fullList = handleAddHumanWorkerReply("4");
    expect(fullList?.[0].label).toBe("Which role?");
    expect(fullList?.[0].body).toContain("creator —");
    expect(fullList?.[0].body).not.toContain("--");

    const creatorIndex = fullList![0].body
      .split("\n")
      .find((line) => line.includes("creator —"))!
      .trim()
      .match(/^(\d+)\./)![1];

    handleAddHumanWorkerReply(creatorIndex);
    handleAddHumanWorkerReply("skip");

    const worker = getWorker("Design File Creator");
    expect(worker?.kind).toBe("human");
    expect(worker?.archetype).toBe("creator");
  });

  it("re-asks an out-of-range role from the full list", () => {
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Design File Creator");
    handleAddHumanWorkerReply("4");
    const again = handleAddHumanWorkerReply("999");

    expect(again?.[0].label).toBe("Which role?");
    expect(getWorker("Design File Creator")).toBeUndefined();
  });

  it("re-asks on an invalid role reply rather than creating the wrong thing", () => {
    startAddHumanWorkerFlow();
    handleAddHumanWorkerReply("Priya");
    const again = handleAddHumanWorkerReply("banana");

    expect(again?.[0].body).toContain("number from 1 to");
    expect(listWorkers().filter((w) => w.kind === "human")).toHaveLength(0);
    expect(isAddHumanWorkerFlowActive()).toBe(true);
  });

  it("cancels cleanly", () => {
    startAddHumanWorkerFlow();
    const cancelled = handleAddHumanWorkerReply("cancel");
    expect(cancelled?.[0].label).toBe("Cancelled");
    expect(isAddHumanWorkerFlowActive()).toBe(false);
    expect(listWorkers().filter((w) => w.kind === "human")).toHaveLength(0);
  });

  it("passes replies through when no flow is active", () => {
    expect(handleAddHumanWorkerReply("anything")).toBeUndefined();
  });
});
