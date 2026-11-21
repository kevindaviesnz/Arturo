import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addWorker,
  assertWorkerCapability,
  clearWorkers,
  createHumanWorker,
  createInitialUserWorker,
  findWorkersByCapabilities,
  getWorker,
  isConsequentialCapability,
  initializeDefaultWorkers,
  listAllWorkers,
  listRuntimeWorkers,
  listWorkers,
  parseWorkerCapabilities,
  parseWorkerCapability,
  registerAiWorker,
  resolveDefaultHumanWorkerMode,
  resolveRegisteredWorkerCapabilities,
  selectWorkerForCapabilities,
  toRuntimeWorker,
  updateInitialUserDetails,
  withUserDetails,
  workerSupportsCapabilities,
  workerSupportsCapability,
  type Worker,
} from "./workers";

beforeEach(() => {
  clearWorkers();
});

describe("resolveDefaultHumanWorkerMode", () => {
  it("uses review mode for reviewers", () => {
    expect(
      resolveDefaultHumanWorkerMode(
        "reviewer"
      )
    ).toBe("review");
  });

  it("uses approval mode for guardians", () => {
    expect(
      resolveDefaultHumanWorkerMode(
        "guardian"
      )
    ).toBe("approval");
  });

  it("uses task mode for operators", () => {
    expect(
      resolveDefaultHumanWorkerMode(
        "operator"
      )
    ).toBe("task");
  });

  it("uses task mode for other human archetypes", () => {
    expect(
      resolveDefaultHumanWorkerMode(
        "advisor"
      )
    ).toBe("task");
  });

  it("uses task mode when no archetype is provided", () => {
    expect(
      resolveDefaultHumanWorkerMode()
    ).toBe("task");
  });
});

describe("createInitialUserWorker", () => {
  it("creates the hidden first human operator worker", () => {
    const worker =
      createInitialUserWorker();

    expect(worker.name).toBe("operator");
    expect(worker.displayName).toBe("Operator");
    expect(worker.kind).toBe("human");
    expect(worker.archetype).toBe("operator");
    expect(worker.system).toBe(true);
    expect(worker.availability).toBe("available");
    expect(worker.humanMode).toBe("task");
    expect(worker.model).toBe("human-operator");
    expect(worker.trust).toBe(true);
    // The built-in Human operator keeps human-review (it is a Human). The
    // operator archetype now also grants an AI operator the reasoning and
    // execution capabilities every other archetype has.
    expect(worker.capabilities).toEqual([
      "human-review",
      "llm",
      "execution",
      "backup",
      "office-read",
      "office-write",
    ]);
  });
});

describe("createHumanWorker", () => {
  it("creates a human reviewer with review mode", () => {
    const worker =
      createHumanWorker(
        "Sarah Mitchell",
        "reviewer",
        "sarah@example.com"
      );

    expect(worker.name).toBe("Sarah Mitchell");
    expect(worker.displayName).toBe("Sarah Mitchell");
    expect(worker.kind).toBe("human");
    expect(worker.archetype).toBe("reviewer");
    expect(worker.availability).toBe("available");
    expect(worker.humanMode).toBe("review");
    expect(worker.email).toBe("sarah@example.com");

    expect(
      worker.capabilities
    ).toContain("human-review");

    expect(
      worker.capabilities
    ).toContain("review");
  });

  it("creates a human guardian with approval mode", () => {
    const worker =
      createHumanWorker(
        "Kevin Davies",
        "guardian"
      );

    expect(worker.kind).toBe("human");
    expect(worker.archetype).toBe("guardian");
    expect(worker.availability).toBe("available");
    expect(worker.humanMode).toBe("approval");
  });

  it("creates a human operator with task mode", () => {
    const worker =
      createHumanWorker(
        "Founder",
        "operator"
      );

    expect(worker.kind).toBe("human");
    expect(worker.archetype).toBe("operator");
    expect(worker.availability).toBe("available");
    expect(worker.humanMode).toBe("task");
  });

  it("creates a human advisor with task mode", () => {
    const worker =
      createHumanWorker(
        "Advisor",
        "advisor"
      );

    expect(worker.kind).toBe("human");
    expect(worker.archetype).toBe("advisor");
    expect(worker.availability).toBe("available");
    expect(worker.humanMode).toBe("task");
  });
});

describe("withUserDetails", () => {
  it("returns a worker with user display details without mutating original", () => {
    const worker =
      createInitialUserWorker();

    const updated =
      withUserDetails(worker, {
        displayName: "Operator",
        email: undefined,
      });

    expect(updated).toEqual({
      ...worker,
      displayName: "Operator",
      email: undefined,
    });

    expect(worker.displayName).toBe("Operator");
  });
});

describe("updateInitialUserDetails", () => {
  it("updates the hidden operator worker details", () => {
    updateInitialUserDetails({
      displayName: "Operator",
      email: undefined,
    });

    expect(
      listRuntimeWorkers()
    ).toEqual([]);

expect(
  listAllWorkers().find(
    (worker) => worker.name === "operator"
  )
).toMatchObject({
  name: "operator",
  displayName: "Operator",
  kind: "human",
  archetype: "operator",
  system: true,
  availability: "available",
});
  });
});

describe("initializeDefaultWorkers", () => {
  it("registers the hidden initial user worker", () => {
    initializeDefaultWorkers();

    expect(
      listRuntimeWorkers()
    ).toEqual([]);

expect(
  listAllWorkers().find(
    (worker) => worker.name === "operator"
  )
).toMatchObject({
  name: "operator",
  displayName: "Operator",
  kind: "human",
  archetype: "operator",
  system: true,
  availability: "available",
});
  });

  it("is idempotent", () => {
    initializeDefaultWorkers();
    initializeDefaultWorkers();

    expect(
      listWorkers()
    ).toHaveLength(0);

    expect(
      listAllWorkers().filter(
        (worker) => worker.name === "operator"
      )
    ).toHaveLength(1);
  });
});

describe("toRuntimeWorker", () => {
  it("converts a registered AI worker into a serializable runtime worker", () => {
    const worker: Worker<any, any> = {
      name: "planner",
      run: function* () {
        return {};
      },
    };

    expect(toRuntimeWorker(worker)).toEqual({
      id: "planner",
      name: "planner",
      displayName: undefined,
      type: "ai",
      status: "idle",
      model: "registered-worker",
      jobs: 0,
      tokens: 0,
      tools: 0,
      trust: false,
      capabilities: [],
    });
  });

  it("preserves explicit runtime metadata", () => {
    const worker: Worker<any, any> = {
      name: "reviewer",
      displayName: "Human Reviewer",
      email: "review@example.com",
      kind: "human",
      model: "human-review",
      trust: true,
      run: function* () {
        return {};
      },
    };

    expect(toRuntimeWorker(worker)).toEqual({
      id: "reviewer",
      name: "reviewer",
      displayName: "Human Reviewer",
      email: "review@example.com",
      type: "human",
      status: "idle",
      model: "human-review",
      jobs: 0,
      tokens: 0,
      tools: 0,
      trust: true,
      capabilities: [],
    });
  });
});

describe("resolveRegisteredWorkerCapabilities", () => {
  it("uses Chapter 6 default assistant capabilities", () => {
    expect(
      resolveRegisteredWorkerCapabilities(
        "assistant"
      )
    ).toEqual([
      "llm",
      "writing",
      "summarisation",
      "human-contact",
    ]);
  });
});

describe("registerAiWorker", () => {
  it("registers an available AI worker execution resource", () => {
    const worker =
      registerAiWorker(
        "GPT-5"
      );

    expect(worker.name).toBe("GPT-5");
    expect(worker.displayName).toBe("GPT-5");
    expect(worker.kind).toBe("ai");
    expect(worker.archetype).toBe("assistant");
    expect(worker.availability).toBe("available");

    expect(
      worker.capabilities
    ).toEqual([
      "llm",
      "writing",
      "summarisation",
      "human-contact",
    ]);

    expect(
      listWorkers().map(
        (candidate) => candidate.name
      )
    ).toEqual([
      "GPT-5",
    ]);
  });

  it("assigns backup only through the operator archetype", () => {
    const worker =
      registerAiWorker(
        "Backup Operator",
        "operator"
      );

    expect(worker.capabilities).toEqual([
      "llm",
      "execution",
      "backup",
      "office-read",
      "office-write",
    ]);
    // An AI archetype must never carry the human-only approval capability.
    expect(worker.capabilities).not.toContain("human-review");
  });

  it("does not retain direct capabilities on an archetyped Worker", () => {
    addWorker({
      name: "Manual Assistant",
      kind: "ai",
      archetype: "assistant",
      capabilities: [
        "safety",
      ],
      run: function* () {
        return undefined;
      },
    });

    expect(
      getWorker("Manual Assistant")?.capabilities
    ).toEqual(
      resolveRegisteredWorkerCapabilities(
        "assistant"
      )
    );
  });
});

describe("listRuntimeWorkers", () => {
  it("returns an empty array before default initialization", () => {
    expect(listRuntimeWorkers()).toEqual([]);
  });

  it("returns registered workers only", () => {
    addWorker({
      name: "planner",
      run: function* () {
        return {};
      },
    });

    expect(
      listRuntimeWorkers().map(
        (worker) => worker.name
      )
    ).toEqual([
      "planner",
    ]);
  });
});

describe("capability routing", () => {
  it("checks whether a worker supports all required capabilities", () => {
    const worker: Worker<any, any> = {
      name: "writer",
      kind: "ai",
      capabilities: [
        "llm",
        "writing",
      ],
      run: function* () {
        return {};
      },
    };

    expect(
      workerSupportsCapabilities(
        worker,
        [
          "llm",
          "writing",
        ]
      )
    ).toBe(true);

    expect(
      workerSupportsCapabilities(
        worker,
        [
          "research",
        ]
      )
    ).toBe(false);
  });

  it("detects one supported capability", () => {
    const worker =
      createHumanWorker(
        "Sarah Mitchell",
        "reviewer",
        "sarah@example.com"
      );

    expect(
      workerSupportsCapability(
        worker,
        "review"
      )
    ).toBe(true);
  });

  it("detects one unsupported capability", () => {
    const worker =
      createHumanWorker(
        "Sarah Mitchell",
        "reviewer",
        "sarah@example.com"
      );

    expect(
      workerSupportsCapability(
        worker,
        "email-send"
      )
    ).toBe(false);
  });

  it("finds workers by capabilities", () => {
    addWorker({
      name: "writer",
      kind: "ai",
      capabilities: [
        "llm",
        "writing",
      ],
      run: function* () {
        return {};
      },
    });

    addWorker({
      name: "researcher",
      kind: "ai",
      capabilities: [
        "llm",
        "research",
      ],
      run: function* () {
        return {};
      },
    });

    expect(
      findWorkersByCapabilities([
        "writing",
      ]).map(
        (worker) => worker.name
      )
    ).toEqual([
      "writer",
    ]);
  });

  it("selects the first deterministic worker for capabilities", () => {
    addWorker({
      name: "writer",
      kind: "ai",
      capabilities: [
        "llm",
        "writing",
      ],
      run: function* () {
        return {};
      },
    });

    expect(
      selectWorkerForCapabilities([
        "llm",
        "writing",
      ])?.name
    ).toBe("writer");
  });
});

describe("worker capability parsing", () => {
  it("parses known capabilities", () => {
    expect(
      parseWorkerCapability(
        "email-send"
      )
    ).toBe("email-send");
  });

  it("parses human-contact as a known capability", () => {
    expect(
      parseWorkerCapability(
        "human-contact"
      )
    ).toBe("human-contact");
  });

  it("rejects unknown capabilities", () => {
    expect(() =>
      parseWorkerCapability(
        "fake-capability"
      )
    ).toThrow(
      "Unknown worker capability: fake-capability"
    );
  });

  it("parses multiple known capabilities", () => {
    expect(
      parseWorkerCapabilities([
        "llm",
        "research",
      ])
    ).toEqual([
      "llm",
      "research",
    ]);
  });
});

describe("worker capability enforcement", () => {
  it("allows workers with the required capability", () => {
    const worker: Worker<any, any> = {
      name: "email-operator",
      kind: "ai",
      capabilities: [
        "llm",
        "email-send",
      ],
      run: function* () {
        return {};
      },
    };

    expect(() =>
      assertWorkerCapability(
        worker,
        "email-send"
      )
    ).not.toThrow();
  });

  it("rejects workers missing the required capability", () => {
    const worker =
      createHumanWorker(
        "Sarah Mitchell",
        "reviewer",
        "sarah@example.com"
      );

    expect(() =>
      assertWorkerCapability(
        worker,
        "email-send"
      )
    ).toThrow(
      "lacks required capability: email-send"
    );
  });
});

describe("isConsequentialCapability", () => {
  it("fails closed for side-effect and authority capabilities", () => {
    for (const capability of [
      "human-review",
      "safety",
      "email-send",
      "file-write",
      "shell-execute",
      "web",
    ] as const) {
      expect(isConsequentialCapability(capability)).toBe(true);
    }
  });

  it("treats cognitive capabilities as routing hints", () => {
    for (const capability of [
      "llm",
      "writing",
      "summarisation",
      "analysis",
      "planning",
      "review",
    ] as const) {
      expect(isConsequentialCapability(capability)).toBe(false);
    }
  });
});
