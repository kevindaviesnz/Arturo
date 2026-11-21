import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedWorkers,
  deletePersistedWorker,
  fromWorkerRow,
  loadWorkers,
  saveWorker,
  toWorkerRow,
} from "./workerRepository";

beforeEach(() => {
  clearPersistedWorkers();
});

expect(
  toWorkerRow({
    name: "writer",
    kind: "ai",
    model: "llama3.2",
    trust: true,
  })
).toEqual({
  name: "writer",
  displayName: null,
  email: null,
  kind: "ai",
  archetype: null,
  model: "llama3.2",
  refinement: null,
  trust: 1,
  capabilities: "[]",
  system: 0,
  availability: null,
  humanMode: null,
  workflowDefinition: null,
});

describe("fromWorkerRow", () => {
  it("restores worker metadata with a safe run function", () => {
    const worker =
      fromWorkerRow({
        name: "writer",
        displayName: null,
        email: null,
        kind: "ai",
        model: "llama3.2",
        trust: 0,
        capabilities: "[\"llm\"]",
      });

    expect(worker.name).toBe(
      "writer"
    );

    expect(worker.kind).toBe(
      "ai"
    );

    expect(worker.model).toBe(
      "llama3.2"
    );

    expect(worker.capabilities).toEqual([
      "llm",
    ]);

    expect(typeof worker.run).toBe(
      "function"
    );
  });
});

describe("workerRepository", () => {
  it("persists a human worker participation mode", () => {
    saveWorker({
      name: "kevin",
      displayName: "Kevin",
      kind: "human",
      archetype: "guardian",
      humanMode: "approval",
    });

    expect(loadWorkers()[0]).toMatchObject({
      name: "kevin",
      displayName: "Kevin",
      kind: "human",
      archetype: "guardian",
      humanMode: "approval",
    });
  });

  it("saves and loads workers", () => {
    saveWorker({
      name: "writer",
      kind: "ai",
      model: "llama3.2",
      trust: false,
      capabilities: [
        "llm",
        "writing",
      ],
    });

    expect(
      loadWorkers().map((worker) => ({
        name: worker.name,
        kind: worker.kind,
        model: worker.model,
        trust: worker.trust,
        capabilities: worker.capabilities,
      }))
    ).toEqual([
      {
        name: "writer",
        kind: "ai",
        model: "llama3.2",
        trust: false,
        capabilities: [
          "llm",
          "writing",
        ],
      },
    ]);
  });

  it("deletes one persisted worker without clearing the registry", () => {
    saveWorker({
      name: "writer",
      kind: "ai",
    });
    saveWorker({
      name: "reviewer",
      kind: "ai",
    });

    expect(
      deletePersistedWorker(
        "writer"
      )
    ).toBe(true);
    expect(
      deletePersistedWorker(
        "missing"
      )
    ).toBe(false);
    expect(
      loadWorkers().map(
        (worker) =>
          worker.name
      )
    ).toEqual([
      "reviewer",
    ]);
  });

  it("persists Worker specialization across reloads", () => {
    saveWorker({
      name: "analyst",
      kind: "ai",
      archetype: "analyst",
      refinement: "Treat Arturo as a software Enterprise.",
    });

    expect(loadWorkers()[0].refinement).toBe(
      "Treat Arturo as a software Enterprise."
    );
  });

  it("restores worker metadata including system and availability", () => {
  const worker =
    fromWorkerRow({
      name: "operator",
      displayName: "Operator",
      email: null,
      kind: "human",
      archetype: "operator",
      model: "human-operator",
      trust: 1,
      capabilities: JSON.stringify([
        "human-review",
      ]),
      system: 1,
      availability: "available",
    });

  expect(
    worker
  ).toMatchObject({
    name: "operator",
    displayName: "Operator",
    email: undefined,
    kind: "human",
    archetype: "operator",
    model: "human-operator",
    trust: true,
    system: true,
    availability: "available",
    capabilities: [
      "human-review",
    ],
  });
  });
  
  it("clears persisted workers", () => {
    saveWorker({
      name: "writer",
      kind: "ai",
      model: "llama3.2",
      trust: false,
    });

    clearPersistedWorkers();

    expect(loadWorkers()).toEqual([]);
  });
});
