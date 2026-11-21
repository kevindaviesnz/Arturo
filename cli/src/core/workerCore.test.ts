import { describe, it, expect } from "vitest";
import { createState, addWorker, listWorkers } from "./workerRegistry";

describe("WorkerRegistry (pure)", () => {
  it("adds a worker", () => {
    const state = createState();
    const next = addWorker(state, "alpha");

    expect(listWorkers(next)).toContain("alpha");
  });

  it("does not mutate original state", () => {
    const state = createState();
    const next = addWorker(state, "alpha");

    expect(listWorkers(state)).toEqual([]);
    expect(listWorkers(next)).toEqual(["alpha"]);
  });

  it("throws on duplicate", () => {
    const state = createState(["alpha"]);

    expect(() => addWorker(state, "alpha")).toThrow();
  });
});