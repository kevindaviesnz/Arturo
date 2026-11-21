import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearWorkflows,
  createCapabilityWorkflow,
  createWorkflow,
  getWorkflow,
  listWorkflows,
} from "./workflows";

beforeEach(() => {
  clearWorkflows();
});

describe("workflows", () => {
  it("creates and retrieves a workflow", () => {
    createWorkflow("demo", [
      "planner",
    ]);

    expect(
      getWorkflow("demo")
    ).toEqual({
      name: "demo",
      steps: ["planner"],
      mode: "worker",
    });
  });

  it("creates capability workflows", () => {
    createCapabilityWorkflow("blog", [
      "research",
      "writing",
      "human-review",
    ]);

    expect(
      getWorkflow("blog")
    ).toEqual({
      name: "blog",
      steps: [
        "research",
        "writing",
        "human-review",
      ],
      mode: "capability",
    });
  });

  it("clears workflows", () => {
    createWorkflow("demo", [
      "planner",
    ]);

    clearWorkflows();

    expect(listWorkflows()).toEqual([]);
  });
});