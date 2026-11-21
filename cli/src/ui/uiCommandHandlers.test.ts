import {
  createAskFailedEntry,
  createAskUsageEntry,
  createAskWorkflowResultEntries,
  createGeneratedWorkflowEntries,
  createResetSuccessEntry,
  createUnsupportedUiCommandEntry,
  findSimilarUiCommands,
  createWorkerRegistrationUsageEntry,
  createWorkflowFailedEntry,
  createWorkflowUsageEntry,
  formatAutoWorkerSummary,
  formatGeneratedWorkflowSteps,
  formatUiBusinessFunctionDefinitionList,
  formatWorkflowBusinessFunctionLines,
  findUnknownUiFlags,
  getUiFlagValue,
  handleUiCommand,
  removeUiFlagPair,
  parseAiWorkerRegistrationArgs,
  stripRepeatedNextAction,
  startNextReview,
  handleNextReviewReply,
  isNextReviewActive,
  clearNextReview,
} from "./uiCommandHandlers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
  getWorker,
} from "../control/workers";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearJobs,
  enqueueJob,
} from "../runtime/jobQueue";

import {
  clearWorkflowRuns,
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  clearBusinessFunctionDefinitions,
  getBusinessFunctionDefinition,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  clearHumanTasks,
  listHumanTasks,
} from "../runtime/humanTaskStore";

const mockObjective = {
  description: "Plan",
  type: "create" as const,
  lifetime: "finite" as const,
  businessPattern: "Internal Operations",
  supported: true,
  reason: "The request asks Arturo to create a plan.",
};

beforeEach(() => {
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearJobs();
  clearWorkflowRuns();
  clearHumanTasks();
  clearWorkers();
});

describe("uiCommandHandlers", () => {
  it("formats Business Functions as a compact numbered list", () => {
    expect(
      formatUiBusinessFunctionDefinitionList([
        {
          id: "enterprise-1:function-1",
          enterpriseId: "enterprise-1",
          label: "Resource Development",
          objective: "Develop resources.",
          description: "Develop resources.",
          status: "declared",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "enterprise-1:function-2",
          enterpriseId: "enterprise-1",
          label: "Curriculum Development",
          objective: "Develop curriculum.",
          description: "Develop curriculum.",
          status: "declared",
          createdAt: 2,
          updatedAt: 2,
        },
      ] as never)
    ).toBe([
      "1. Resource Development",
      "2. Curriculum Development",
    ].join("\n"));
  });

  it("supports the standalone Human Task lifecycle in the terminal UI", async () => {
    addWorker(createHumanWorker("Kevin", "guardian"));
    const created = await handleUiCommand("/create-human-task", [
      "Resolve release conflict",
      "Review both positions and record a decision.",
    ]);
    const task = listHumanTasks()[0];

    expect(task).toBeDefined();
    expect(created[0].label).toBe("Human task created");
    expect(created[0].body).toContain(`human task created: ${task.id}`);

    const inspected = await handleUiCommand("/human-task", [task.id]);
    expect(inspected[0].body).toContain("Title: Resolve release conflict");
    expect(inspected[0].body).toContain("Status: open");

    const completed = await handleUiCommand("/complete-human-task", [
      task.id,
      "Return for revision.",
    ]);
    expect(completed[0].body).toContain(`human task completed: ${task.id}`);
    expect(completed[0].body).toContain("completed by: Kevin");
    expect(listHumanTasks()[0].status).toBe("completed");
    expect(listHumanTasks()[0].completedBy).toBe("Kevin");
  });

  it("creates a CLI Human Task when signed browser links are not configured", async () => {
    const previousSecret = process.env.HUMAN_TASK_TOKEN_SECRET;
    delete process.env.HUMAN_TASK_TOKEN_SECRET;

    try {
      const created = await handleUiCommand("/create-human-task", [
        "Resolve conflict",
        "Record an accountable decision.",
      ]);

      expect(listHumanTasks()).toHaveLength(1);
      expect(created[0].label).toBe("Human task created");
      expect(created[0].body).toContain("human task created:");
      expect(created[0].body).toContain("open: unavailable");
      expect(created[0].body).not.toContain("Error");
    } finally {
      if (previousSecret === undefined) {
        delete process.env.HUMAN_TASK_TOKEN_SECRET;
      } else {
        process.env.HUMAN_TASK_TOKEN_SECRET = previousSecret;
      }
    }
  });

  it("preserves unquoted multi-word flag values until the next flag", () => {
    const args = ["Koru Kids", "--description", "Develops", "age-appropriate", "learning", "--status", "active"];
    expect(getUiFlagValue(args, "--description")).toBe("Develops age-appropriate learning");
    expect(removeUiFlagPair(args, "--description")).toEqual(["Koru Kids", "--status", "active"]);
  });

  it("presents a guided executive overview for an empty installation", async () => {
    const entries = await handleUiCommand("/overview", []);
    expect(entries[0]).toMatchObject({
      actor: "Arturo",
      label: "Welcome",
    });
    // Switch-free welcome: the numbered steps are bare commands now.
    expect(entries[0].body).toContain("/enterprise");
    expect(entries[0].body).toContain("/staff");
    expect(entries[0].body).not.toContain("--mission");
    expect(entries[0].body).not.toContain("--advise");
  });

  it("returns detailed help for a named command", async () => {
    const entries = await handleUiCommand("/help", ["delegation"]);
    expect(entries[0].label).toBe("Help · /delegation");
    expect(entries[0].body).toContain('/delegation request "<bounded-work>"');
    expect(entries[0].body).toContain("Cross-Enterprise delegation is not currently supported");
  });

  it("lists and explains Worker archetypes", async () => {
    const list =
      await handleUiCommand(
        "/archetypes",
        []
      );
    const detail =
      await handleUiCommand(
        "/archetypes",
        [
          "guardian",
        ]
      );

    expect(list[0].label).toBe("Worker archetypes");
    expect(list[0].body).toContain("researcher");
    expect(detail[0].label).toBe("Guardian archetype");
    expect(detail[0].body).toContain("What a Worker with this role can do:");
  });

  it("removes a Worker through /workers remove", async () => {
    addWorker({
      name:
        "Temporary Worker",
      displayName:
        "Temporary Worker",
      kind:
        "ai",
      archetype:
        "assistant",
      capabilities: [
        "llm",
      ],
      run: function* (
        input: unknown
      ) {
        return input;
      },
    });

    const entries =
      await handleUiCommand(
        "/workers",
        [
          "remove",
          "Temporary Worker",
        ]
      );

    expect(
      entries[0].label
    ).toBe(
      "Worker removed"
    );
    expect(
      entries[0].body
    ).toContain(
      "Removed Worker: Temporary Worker"
    );
    expect(
      getWorker(
        "Temporary Worker"
      )
    ).toBeUndefined();
  });

  it("reports when /workers remove is blocked by active work", async () => {
    addWorker({
      name:
        "Busy Worker",
      displayName:
        "Busy Worker",
      kind:
        "ai",
      archetype:
        "assistant",
      capabilities: [
        "llm",
      ],
      run: function* (
        input: unknown
      ) {
        return input;
      },
    });
    const job =
      enqueueJob(
        "Finish this work.",
        "Busy Worker"
      );

    const entries =
      await handleUiCommand(
        "/workers",
        [
          "remove",
          "Busy Worker",
        ]
      );

    expect(
      entries[0].label
    ).toBe(
      "Worker not removed"
    );
    expect(
      entries[0].body
    ).toContain(
      job.id
    );
    expect(
      getWorker(
        "Busy Worker"
      )
    ).toBeDefined();
  });

  it("treats /models as an alias of the /model chooser", async () => {
    // The chooser talks to the local model server; whether that server is up
    // is machine state, so only the shape is asserted: both spellings land in
    // the same interactive chooser, never the old read-only config list.
    const entries =
      await handleUiCommand(
        "/models",
        []
      );

    expect(entries[0].label).not.toBe("Models");
    expect(entries[0].label).toMatch(
      /Choose a model|model server|No models found/i
    );
  });

  it("creates an unknown command entry", () => {
    // It used to say the UI "does not handle /unknown yet", which implies a
    // planned command. This is the catch-all for every typo.
    expect(
      createUnsupportedUiCommandEntry(
        "/unknown"
      )
    ).toEqual({
      actor: "Arturo",
      label: "Unknown command",
      body: "There is no /unknown command.\n\nRun /help for the full list.",
    });
  });

  it("offers the command a typo was probably reaching for", () => {
    const entry =
      createUnsupportedUiCommandEntry("/functins");

    expect(entry.body).toContain("Did you mean");
    expect(entry.body).toContain("/functions");
  });

  it("keeps the suggestions to near misses", () => {
    // A plain-text reply gets its own recovery block; this path must not turn
    // every unrecognised word into a wall of half the command list.
    expect(
      findSimilarUiCommands("/zzzzzzzzzz")
    ).toEqual([]);

    expect(
      findSimilarUiCommands("/task").length
    ).toBeLessThanOrEqual(4);
  });

  it("creates ask usage entry", () => {
    expect(
      createAskUsageEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Usage",
      body: 'Use /ask "<request>" or /ask --auto-workers "<request>"',
    });
  });

  it("creates ask failed entry from error", () => {
    expect(
      createAskFailedEntry(
        new Error(
          "Planner failed"
        )
      )
    ).toEqual({
      actor: "Arturo",
      label: "Workflow failed",
      body: "Planner failed",
    });
  });

  it("creates ask failed entry from unknown error", () => {
    expect(
      createAskFailedEntry(
        "bad"
      )
    ).toEqual({
      actor: "Arturo",
      label: "Workflow failed",
      body: "Unknown /ask failure.",
    });
  });

  it("formats disabled auto-worker summary", () => {
    expect(
      formatAutoWorkerSummary({
        request: "Plan",
        objective: mockObjective,
        originalPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        enforcedPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        workflowRunId: "run-1",
        stepCount: 0,
        firstWorkerName: undefined,
        enforcementApplied: false,
        autoWorkers: false,
        autoCreatedWorkers: [],
      })
    ).toBe(
      "disabled"
    );
  });

  it("formats enabled auto-worker summary when no workers were created", () => {
    expect(
      formatAutoWorkerSummary({
        request: "Plan",
        objective: mockObjective,
        originalPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        enforcedPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        workflowRunId: "run-1",
        stepCount: 0,
        firstWorkerName: undefined,
        enforcementApplied: false,
        autoWorkers: true,
        autoCreatedWorkers: [],
      })
    ).toBe(
      "enabled; created none"
    );
  });

  it("formats enabled auto-worker summary with created workers", () => {
    expect(
      formatAutoWorkerSummary({
        request: "Plan",
        objective: mockObjective,
        originalPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        enforcedPlan: {
          objective: "Plan",
          explanation: "Explain",
          steps: [],
        },
        workflowRunId: "run-1",
        stepCount: 0,
        firstWorkerName: undefined,
        enforcementApplied: false,
        autoWorkers: true,
        autoCreatedWorkers: [
          {
            name: "auto-planner",
            archetype: "planner",
            kind: "ai",
          },
          {
            name: "auto-operator",
            archetype: "operator",
            kind: "human",
          },
        ],
      })
    ).toBe(
      "enabled; created ai:auto-planner(planner), human:auto-operator(operator)"
    );
  });

  it("creates ask workflow result entries", () => {
    const entries =
      createAskWorkflowResultEntries({
        request: "Plan Arturo launch",
        objective: mockObjective,
        originalPlan: {
          objective: "Plan Arturo launch",
          explanation: "Create a launch plan.",
          steps: [],
        },
        enforcedPlan: {
          objective: "Plan Arturo launch",
          explanation: "Create a launch plan.",
          steps: [],
        },
        workflowRunId: "run-1",
        stepCount: 2,
        firstWorkerName: "auto-planner",
        enforcementApplied: false,
        autoWorkers: true,
        autoCreatedWorkers: [
          {
            name: "auto-planner",
            archetype: "planner",
            kind: "ai",
          },
        ],
      });

    expect(
      entries
    ).toEqual([
      {
        actor: "Planner",
        label: "Objective classified",
        body: [
          "objective: Plan",
          "type: create",
          "lifetime: finite",
          "business pattern: Internal Operations",
          "supported: yes",
          "reason: The request asks Arturo to create a plan.",
        ].join("\n"),
      },
      {
        actor: "Planner",
        label: "Workflow created",
        body: [
          "workflow objective: Plan Arturo launch",
          "workflow run: run-1",
          "steps planned: 2",
          "first worker: auto-planner",
          "workers created: 1",
        ].join("\n"),
      },
      {
        actor: "Arturo",
        label: "Next",
        body: [
          "Plan is ready for review.",
          "",
          // /refine-task was recommended here but has no handler at all, and
          // /task-detail is absent from /help; both sent a new operator to a
          // command they could not run or look up.
          //
          // "Use /tasks to review the plan" was the same defect one step on:
          // /tasks answers "No tasks found" until /start creates them, so the
          // first thing this told the operator to run showed nothing.
          "The plan has 2 steps. No Tasks exist yet, so /tasks will not show them.",
          "Use /start run-1 to create its Tasks and begin execution.",
          'Then /tasks lists them, and /task inspect "<task-id>" reads one in full.',
          "",
          "Nothing runs until you start it.",
        ].join("\n"),
      },
    ]);
  });

  it("creates worker registration usage entry", () => {
    expect(
      createWorkerRegistrationUsageEntry(
        "/add-ai-worker",
        "/add-ai-worker <name> [archetype] [model]"
      )
    ).toEqual({
      actor: "Arturo",
      label: "Usage",
      body: "/add-ai-worker: /add-ai-worker <name> [archetype] [model]",
    });
  });

  it("parses an unquoted multi-word AI worker name", () => {
    expect(
      parseAiWorkerRegistrationArgs([
        "Toy", "Safety", "Worker", "guardian",
      ])
    ).toEqual({
      name: "Toy Safety Worker",
      archetype: "guardian",
      model: undefined,
    });
  });

  it("preserves a quoted worker name token and optional model", () => {
    expect(
      parseAiWorkerRegistrationArgs([
        "Toy Safety Worker", "guardian", "llama3.2:latest",
      ])
    ).toEqual({
      name: "Toy Safety Worker",
      archetype: "guardian",
      model: "llama3.2:latest",
    });
  });

  it("creates reset success entry", () => {
    expect(
      createResetSuccessEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Everything deleted",
      body: "Arturo is now empty, as though you had just installed it.",
    });
  });

  it("creates workflow usage entry", () => {
    expect(
      createWorkflowUsageEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Usage",
      body: 'Use /workflow "<workflow request>"',
    });
  });

  it("creates workflow failed entry", () => {
    expect(
      createWorkflowFailedEntry(
        new Error(
          "Planner failed"
        )
      )
    ).toEqual({
      actor: "Arturo",
      label: "Workflow generation failed",
      body: "Planner failed",
    });
  });

  it("formats generated workflow steps", () => {
    expect(
      formatGeneratedWorkflowSteps({
        name: "fast-fashion-start-up",
        request: "Create a workflow",
        plannerRequest: "Design a reusable multi-step Arturo workflow definition.",
        plan: {
          objective: "Create workflow",
          explanation: "Test explanation",
          steps: [
            {
              archetype: "researcher",
              instruction: "Research trends.",
            },
            {
              archetype: "analyst",
              instruction: "Analyse market fit.",
            },
          ],
        },
      })
    ).toBe(
      [
        "1. researcher — Research trends.",
        "2. analyst — Analyse market fit.",
      ].join("\n")
    );
  });

  it("returns refine-worker usage when arguments are missing", async () => {
    await expect(
      handleUiCommand(
        "/refine-worker",
        []
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: '/refine-worker <worker-name> "<refinement instructions>"',
      },
    ]);
  });

  it("returns not found when refining a missing worker", async () => {
    await expect(
      handleUiCommand(
        "/refine-worker",
        [
          "missing-worker",
          "Be more detailed.",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Worker not found",
        body: "worker not found: missing-worker",
      },
    ]);
  });

  it("refines an existing worker", async () => {
    addWorker({
      name: "auto-designer",
      kind: "ai",
      archetype: "creator",
      model: "llama3.2",
      trust: false,
      capabilities: [
        "llm",
      ],
      run: function* (ctx: any) {
        return ctx;
      },
    });

    await expect(
      handleUiCommand(
        "/refine-worker",
        [
          "auto-designer",
          "Produce detailed garment specs.",
        ]
      )
    ).resolves.toEqual([
      {
        // Reads the specialisation back. The operator typed a paragraph and
        // used to get four words, so nothing on screen showed what was stored.
        actor: "Arturo",
        label: "Worker refined",
        body: [
          "worker refined: auto-designer",
          "",
          "Specialisation:",
          "Produce detailed garment specs.",
        ].join("\n"),
      },
    ]);
  });

  it("formats workflow business function lines", () => {
    expect(
      formatWorkflowBusinessFunctionLines({
        request:
          "Build me an AI-native fast fashion business",
        objective: {
          description:
            "Create a product company",
          type:
            "create",
          lifetime:
            "finite",
          businessPattern:
            "Product Company",
          supported:
            true,
          reason:
            "The request asks Arturo to create a business around products.",
        },
        originalPlan: {
          objective:
            "Build me an AI-native fast fashion business",
          explanation:
            "Created a business-function workflow.",
          steps: [],
        },
        enforcedPlan: {
          objective:
            "Build me an AI-native fast fashion business",
          explanation:
            "Created a business-function workflow.",
          steps: [
            {
              archetype:
                "planner",
              instruction:
                "Business Strategy: Define the business model.",
            },
            {
              archetype:
                "researcher",
              instruction:
                "Market Research: Research customers.",
            },
          ],
        },
        workflowRunId:
          "run-1",
        stepCount:
          2,
        firstWorkerName:
          "auto-planner",
        enforcementApplied:
          false,
        autoWorkers:
          true,
        autoCreatedWorkers:
          [],
      })
    ).toEqual([
      "workflow steps: 2",
      "",
      "1. Business Strategy",
      "2. Market Research",
      "",
    ]);
  });

  it("handles functions command", async () => {
    await expect(
      handleUiCommand(
        "/functions",
        []
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Functions",
        body: "No functions found.",
      },
    ]);
  });

  it("treats /functions --enterprise as a list, not a bad subcommand", async () => {
    // Regression: /functions passed --enterprise straight through as the
    // subcommand, so it printed the /function usage block instead of listing.
    const result = await handleUiCommand("/functions", [
      "--enterprise",
      "Nonexistent Co",
    ]);
    const body = result.map((entry) => entry.body).join("\n");
    expect(body).not.toContain("/function create");
    expect(result[0]?.label).not.toBe("Usage");
  });

  it("handles start command", async () => {
    const run =
      createWorkflowRun(
        "Build business",
        "Draft plan",
        "draft",
        {
          objective:
            "Build business",
          explanation:
            "Draft plan",
          steps: [
            {
              archetype:
                "planner",
              workerName:
                "auto-planner",
              instruction:
                "Business Strategy: Define the business model.",
            },
          ],
        }
      );

    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id:
          `${run.id}:function-1`,
        label:
          "Business Strategy",
        objective:
          "Business Strategy: Define the business model.",
        ownerWorker:
          "auto-planner",
      })
    );

    await expect(
      handleUiCommand(
        "/start",
        [
          run.id,
        ]
      )
    ).resolves.toEqual([
      {
        actor:
          "Arturo",
        label:
          "Workflow started",
        body:
          [
            "Workflow started.",
            "",
            "Run: run-1",
            "Tasks created: 1",
            "",
            "Use /tasks or /timeline to inspect progress.",
          ].join("\n"),
      },
    ]);
  });

  it("creates generated workflow entries", () => {
    expect(
      createGeneratedWorkflowEntries({
        name: "fast-fashion-start-up",
        request: "Create a full workflow for a fast fashion start up",
        plannerRequest: "Design a reusable multi-step Arturo workflow definition.",
        plan: {
          objective: "Create a fast fashion startup workflow",
          explanation: "A reusable workflow for fast fashion startup operations.",
          steps: [
            {
              archetype: "researcher",
              instruction: "Research fashion trends.",
            },
          ],
        },
      })
    ).toEqual([
      {
        actor: "Arturo",
        label: "Workflow created",
        body: [
          "name: fast-fashion-start-up",
          "mode: planned",
          "source: model-generated",
          "objective: Create a fast fashion startup workflow",
          "explanation: A reusable workflow for fast fashion startup operations.",
          "",
          "steps:",
          "1. researcher — Research fashion trends.",
        ].join("\n"),
      },
      {
        actor: "Arturo",
        label: "Next",
        body: "Use /run fast-fashion-start-up to start this workflow.",
      },
    ]);
  });

  it("handles enterprise list command when empty", async () => {
    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "list",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Enterprises",
        body: "No enterprises.",
      },
    ]);
  });

  it("handles enterprise create command", async () => {
    const entries =
      await handleUiCommand(
        "/enterprise",
        [
          "create",
          "Daily Intelligence",
          "--mission",
          "Operate an AI-native news business.",
        ]
      );

    expect(
      entries
    ).toEqual([
        {
          actor: "Arturo",
          label: "Enterprise created",
          body: expect.stringContaining(
            [
              "Enterprise created.",
              "",
              "  ID:                  enterprise-1",
              "  Name:                Daily Intelligence",
              "  Mission:             Operate an AI-native news business.",
              "  Description:         (none)",
              "  Status:              active",
            ].join("\n")
          ),
        },
      ]);
    expect(
      entries[0].body
    ).toContain(
      'Run /next "Daily Intelligence" to create this Enterprise\'s ongoing Functions, or /function to add one yourself.'
    );
  });

  it("creates an Enterprise from the short description form", async () => {
    const entries =
      await handleUiCommand(
        "/enterprise",
        [
          "Acme Real Estate",
          "--description",
          "Acme Real Estate is a small real estate business specialising in rural property",
        ]
      );

    expect(entries[0]).toMatchObject({
      actor: "Arturo",
      label: "Enterprise created",
    });
    expect(entries[0].body).toContain(
      "  Name:                Acme Real Estate"
    );
    expect(entries[0].body).toContain(
      "  Description:         Acme Real Estate is a small real estate business specialising in rural property"
    );
    expect(entries[0].body).toContain(
      'Run /next "Acme Real Estate" to create this Enterprise\'s ongoing Functions, or /function to add one yourself.'
    );
  });

  it("returns usage for enterprise create when arguments are missing", async () => {
    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "create",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /enterprise "<name>" --description "<description>" or /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
      },
    ]);
  });

  it("returns usage for add-function when arguments are missing", async () => {
    await expect(
      handleUiCommand(
        "/add-function",
        []
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /add-function <enterprise-id> "<function name>" "<objective>"',
      },
    ]);
  });

  it("returns not found when adding a function to a missing enterprise", async () => {
    await expect(
      handleUiCommand(
        "/add-function",
        [
          "missing",
          "News Discovery",
          "Find relevant articles.",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: "enterprise not found: missing",
      },
    ]);
  });

  it("adds a function to an enterprise", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await expect(
      handleUiCommand(
        "/add-function",
        [
          "enterprise-1",
          "News Discovery",
          "Find relevant articles from trusted sources.",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Business function added",
        body: [
          "enterprise: enterprise-1",
          "function: News Discovery",
          "id: daily-intelligence:news-discovery",
        ].join("\n"),
      },
    ]);

    expect(
      getBusinessFunctionDefinition(
        "daily-intelligence:news-discovery"
      )
    ).toEqual(
      expect.objectContaining({
        id: "daily-intelligence:news-discovery",
        enterpriseId: "enterprise-1",
        label: "News Discovery",
        objective: "Find relevant articles from trusted sources.",
        description: undefined,
        status: "declared",
        executionMode: "manual",
      })
    );
  });

  it("returns usage for enterprise command when subcommand is missing", async () => {
    await expect(
      handleUiCommand(
        "/enterprise",
        []
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: [
          "Usage:",
          '  /enterprise "<name>" --description "<description>" [--mission "<mission>"]',
          '  /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
          '  /enterprise inspect "<name-or-id>"',
          '  /enterprise update "<name-or-id>" --description "<description>"',
          "  /enterprise list",
        ].join("\n"),
      },
    ]);
  });

  it("returns usage for enterprise inspect when id is missing", async () => {
    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "inspect",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /enterprise inspect "<name-or-id>"',
      },
    ]);
  });

  it("shows enterprise detail with functions", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "inspect",
          "enterprise-1",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Enterprise detail",
        body: [
          "Enterprise: Daily Intelligence",
          "  ID:          enterprise-1",
          "  Status:      active",
          "  Mission:     Operate an AI-native news business.",
          "  Description: (none)",
          "  Functions (1):",
          "    - News Discovery (daily-intelligence:news-discovery) — declared",
          "",
          "  Workers (0):",
          "    (none)",
          "",
          "  Policies (0):",
          "    (none)",
        ].join("\n"),
      },
    ]);
  });

  it("lists enterprises after creation", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "list",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Enterprises",
        body: [
          "  ID            Name                Status  Functions",
          "  enterprise-1  Daily Intelligence  active  0",
        ].join("\n"),
      },
    ]);
  });

  it("keeps ongoing Functions separate from bounded Tasks in the primary commands", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "Science Tracker",
      "--mission",
      "Find and summarise the latest public science news.",
    ]);

    const createdJob = await handleUiCommand("/job", [
      "create",
      "Science Discovery",
      "--enterprise",
      "Science Tracker",
      "--objective",
      "Find the latest public science news.",
    ]);

    expect(createdJob[0].label).toBe("Function created");

    const jobs = await handleUiCommand("/jobs", [
      "--enterprise",
      "Science Tracker",
    ]);
    expect(jobs[0].label).toBe("Functions");
    expect(jobs[0].body).toContain("Science Discovery");

    const task = enqueueJob(
      "Summarise the five supplied science-news results.",
      undefined,
      {
        enterpriseId:
          "enterprise-1",
        requiredCapabilities: [
          "writing",
        ],
      }
    );

    const tasks = await handleUiCommand("/tasks", []);
    expect(tasks[0].label).toBe("Tasks");
    expect(tasks[0].body).toContain(task.id);
    expect(tasks[0].body).toContain(
      "Summarise the five supplied science-news results."
    );

    const inspected = await handleUiCommand("/task", [
      "inspect",
      task.id,
    ]);
    expect(inspected[0].body).toContain(task.id);
    expect(inspected[0].body).toContain(
      "Summarise the five supplied science-news results."
    );
  });

  it("starts a Function under the canonical spelling, not only the /job alias", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "Science Tracker",
      "--mission",
      "Find and summarise the latest public science news.",
    ]);
    await handleUiCommand("/function", [
      "create",
      "Science Discovery",
      "--enterprise",
      "Science Tracker",
      "--objective",
      "Find the latest public science news.",
    ]);

    const started = await handleUiCommand("/function", [
      "start",
      "Science Discovery",
    ]);

    expect(started[0].label).not.toBe("Usage");
    expect(started[0].body).toContain("Science Discovery");
  });

  it("updates enterprise description from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await expect(
      handleUiCommand(
        "/enterprise",
        [
          "update",
          "enterprise-1",
          "--description",
          "Operate a governed AI-native intelligence business.",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Enterprise updated",
        body: expect.stringContaining(
          [
            "Enterprise updated.",
            "",
            "  ID:          enterprise-1",
            "  Name:        Daily Intelligence",
            "  Mission:     Operate an AI-native news business.",
            "  Description: Operate a governed AI-native intelligence business.",
            "  Status:      active",
          ].join("\n")
        ),
      },
    ]);
  });

  it("updates a Business Function objective and description from the UI", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "Arturo",
      "--mission",
      "Build a governed Enterprise OS.",
    ]);
    await handleUiCommand("/function", [
      "create",
      "Quality and Verification Function",
      "--enterprise",
      "Arturo",
      "--objective",
      "Challenge claims verify behaviour.",
    ]);

    const entries = await handleUiCommand("/function", [
      "update",
      "Quality and Verification Function",
      "--objective",
      "Challenge claims, verify behaviour, and define completion evidence.",
      "--description",
      "Owns reproducible verification of Arturo's supported behaviour.",
    ]);

    expect(entries[0].label).toBe("Function updated");
    expect(entries[0].body).toContain(
      "Objective:     Challenge claims, verify behaviour, and define completion evidence."
    );
    expect(entries[0].body).toContain(
      "Description:   Owns reproducible verification of Arturo's supported behaviour."
    );
    expect(
      getBusinessFunctionDefinition("arturo:quality-and-verification-function")
    ).toMatchObject({
      objective: "Challenge claims, verify behaviour, and define completion evidence.",
      description: "Owns reproducible verification of Arturo's supported behaviour.",
    });
  });

  it("stores an explicit Business Function description during creation", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "Arturo",
      "--mission",
      "Build a governed Enterprise OS.",
    ]);

    const entries = await handleUiCommand("/function", [
      "create",
      "Quality and Verification Function",
      "--enterprise",
      "Arturo",
      "--objective",
      "Verify supported behaviour.",
      "--description",
      "Owns reproducible product testing and evidence.",
    ]);

    expect(
      getBusinessFunctionDefinition("arturo:quality-and-verification-function")
      ?.description
    ).toBe(
      "Owns reproducible product testing and evidence."
    );
  });

  it("registers refined AI and available Human Workers with flag syntax", async () => {
    const aiEntries =
      await handleUiCommand(
        "/add-ai-worker",
        [
          "Girls Softball Coach",
          "--archetype",
          "coach",
          "--refine",
          "You specialise in coaching softball for girls under 15.",
        ]
      );
    const humanEntries =
      await handleUiCommand(
        "/add-human-worker",
        [
          "Design Approver",
          "--archetype",
          "reviewer",
          "--availability",
          "busy",
          "--refine",
          "Reviews exact design-file versions.",
        ]
      );

    // The Worker reports the model /model currently selects, not one of its own.
    expect(aiEntries[0].body).toContain("(chosen with /model)");
    expect(getWorker("Girls Softball Coach")).toMatchObject({
      archetype: "coach",
      refinement: "You specialise in coaching softball for girls under 15.",
    });
    expect(humanEntries[0].body).toContain("availability: busy");
    expect(getWorker("Design Approver")).toMatchObject({
      kind: "human",
      archetype: "reviewer",
      availability: "busy",
      refinement: "Reviews exact design-file versions.",
    });
  });

  it("pauses a business function from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/pause-function",
        [
          "daily-intelligence:news-discovery",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function paused",
        body: [
          "id: daily-intelligence:news-discovery",
          "status: paused",
        ].join("\n"),
      },
    ]);
  });

  it("resumes a business function from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/resume-function",
        [
          "daily-intelligence:news-discovery",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function resumed",
        body: [
          "id: daily-intelligence:news-discovery",
          "status: running",
        ].join("\n"),
      },
    ]);
  });

  it("stops a business function from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/stop-function",
        [
          "daily-intelligence:news-discovery",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function stopped",
        body: [
          "id: daily-intelligence:news-discovery",
          "status: stopped",
        ].join("\n"),
      },
    ]);
  });

  it("fails a business function from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/fail-function",
        [
          "daily-intelligence:news-discovery",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function failed",
        body: [
          "id: daily-intelligence:news-discovery",
          "status: failed",
        ].join("\n"),
      },
    ]);
  });

  it("returns usage for start-function when id is missing", async () => {
    await expect(
      handleUiCommand(
        "/start-function",
        []
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Usage",
        body: "Use /start-function <function-id>",
      },
    ]);
  });

  it("returns not found when starting a missing function", async () => {
    await expect(
      handleUiCommand(
        "/start-function",
        [
          "enterprise-1:function-1",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function not found",
        body: "function not found: enterprise-1:function-1",
      },
    ]);
  });

  it("starts a business function from the UI", async () => {
    await handleUiCommand(
      "/enterprise",
      [
        "create",
        "Daily Intelligence",
        "--mission",
        "Operate an AI-native news business.",
      ]
    );

    await handleUiCommand(
      "/add-function",
      [
        "enterprise-1",
        "News Discovery",
        "Find relevant articles from trusted sources.",
      ]
    );

    await expect(
      handleUiCommand(
        "/start-function",
        [
          "daily-intelligence:news-discovery",
        ]
      )
    ).resolves.toEqual([
      {
        actor: "Arturo",
        label: "Function started",
        body: [
          "id: daily-intelligence:news-discovery",
          "status: running",
        ].join("\n"),
      },
    ]);
  });
});

describe("stripRepeatedNextAction", () => {
  const body = [
    "ID    fn-1",
    "Name  Marketing",
    "",
    "Next:",
    '  Run /staff --enterprise "Marlowe Books" to add Workers.',
  ].join("\n");

  it("removes the repeated next step from each created Function", () => {
    const [entry] = stripRepeatedNextAction([
      { actor: "Arturo", label: "Function created", body },
    ]);

    expect(entry.body).not.toContain("/staff");
    expect(entry.body).toContain("Name  Marketing");
  });

  it("leaves an entry without the block untouched", () => {
    const other = { actor: "Arturo", label: "Function skipped", body: "Already exists." };

    expect(stripRepeatedNextAction([other])[0].body).toBe("Already exists.");
  });
});


describe("Function objective", () => {
  it("warns that a Function created without an Objective has only its name", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "t & s heating ltd",
      "--mission",
      "Repairs and services boilers.",
    ]);

    const created = await handleUiCommand("/function", [
      "create",
      "invoicing",
      "--enterprise",
      "t & s heating ltd",
    ]);

    expect(created[0].body).toContain("has no Objective");
    expect(created[0].body).toContain('/function update "invoicing" --objective');
  });

  it("says nothing when an Objective was given", async () => {
    await handleUiCommand("/enterprise", [
      "create",
      "t & s heating ltd",
      "--mission",
      "Repairs and services boilers.",
    ]);

    const created = await handleUiCommand("/function", [
      "create",
      "invoicing",
      "--enterprise",
      "t & s heating ltd",
      "--objective",
      "Every completed job is billed within three days.",
    ]);

    expect(created[0].body).not.toContain("has no Objective");
  });

  it("finds flag-shaped tokens outside the known set, de-duplicated", () => {
    expect(
      findUnknownUiFlags(
        ["Name", "--role", "lead", "--email", "a@b.c", "--role", "again"],
        ["--email", "--archetype"]
      )
    ).toEqual(["--role"]);
  });

  it("treats --flag=value equals-form as a known flag", () => {
    expect(
      findUnknownUiFlags(["--email=a@b.c", "--bogus"], ["--email"])
    ).toEqual(["--bogus"]);
  });

  it("refuses an unknown /add-human-worker flag instead of absorbing it into the name", async () => {
    const entries = await handleUiCommand("/add-human-worker", [
      "Sam Okafor",
      "--role",
      "Platform engineering lead",
    ]);

    expect(entries[0].label).toBe("Unknown option");
    expect(entries[0].body).toContain("--role");

    const workers = await handleUiCommand("/workers", []);
    expect(workers[0].body ?? "").not.toContain("Sam Okafor");
    expect(workers[0].body ?? "").not.toContain("--role");
  });

  it("refuses --model on a Human Worker and explains why", async () => {
    const entries = await handleUiCommand("/add-human-worker", [
      "Test Human",
      "--model",
      "llama3.2",
    ]);

    expect(entries[0].label).toBe("Unknown option");
    expect(entries[0].body).toContain("Human Workers do not use a model");
  });

  it("still registers a Human Worker when only known flags are used", async () => {
    const entries = await handleUiCommand("/add-human-worker", [
      "Sam Okafor",
      "--archetype",
      "guardian",
      "--refine",
      "Owns on-call process.",
    ]);

    expect(entries[0].label).toBe("Human worker added");
    expect(entries[0].body).toContain("Sam Okafor");
    expect(entries[0].body).not.toContain("--");
  });

  it("refuses an unknown /add-ai-worker flag", async () => {
    const entries = await handleUiCommand("/add-ai-worker", [
      "Analyst",
      "--archetype",
      "analyst",
      "--role",
      "junk",
    ]);

    expect(entries[0].label).toBe("Unknown option");
    expect(entries[0].body).toContain("--role");
  });

  it("points --model at the /model command instead of registering a per-Worker model", async () => {
    const entries = await handleUiCommand("/add-ai-worker", [
      "Analyst",
      "--archetype",
      "analyst",
      "--model",
      "llama3.2",
    ]);

    expect(entries[0].label).toBe("Choose models with /model");
    expect(entries[0].body).toContain("/model");
    expect(getWorker("Analyst")).toBeUndefined();
  });

  it("sets an Enterprise mission through /enterprise update", async () => {
    await handleUiCommand("/enterprise", ["create", "Ridgeline"]);

    const updated = await handleUiCommand("/enterprise", [
      "update",
      "Ridgeline",
      "--mission",
      "Keep incidents contained inside SLAs.",
    ]);

    expect(updated[0].label).toBe("Enterprise updated");
    expect(updated[0].body).toContain(
      "Mission:     Keep incidents contained inside SLAs."
    );

    const inspected = await handleUiCommand("/enterprise", [
      "inspect",
      "Ridgeline",
    ]);
    expect(inspected[0].body).toContain(
      "Keep incidents contained inside SLAs."
    );
  });

  it("refuses an unknown /enterprise update flag instead of dropping it silently", async () => {
    await handleUiCommand("/enterprise", ["create", "Ridgeline"]);

    const updated = await handleUiCommand("/enterprise", [
      "update",
      "Ridgeline",
      "--frobnicate",
      "xyz",
    ]);

    expect(updated[0].label).toBe("Unknown option");
    expect(updated[0].body).toContain("--frobnicate");
  });

  it("updates mission and description together in one /enterprise update", async () => {
    await handleUiCommand("/enterprise", ["create", "Ridgeline"]);

    const updated = await handleUiCommand("/enterprise", [
      "update",
      "Ridgeline",
      "--mission",
      "Keep incidents contained.",
      "--description",
      "A 30-person B2B SaaS.",
    ]);

    expect(updated[0].body).toContain("Mission:     Keep incidents contained.");
    expect(updated[0].body).toContain("Description: A 30-person B2B SaaS.");
  });
});

describe("interactive /next review", () => {
  beforeEach(() => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearNextReview();
  });
  afterEach(() => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearNextReview();
  });

  const recs = [
    { name: "Client Onboarding", objective: "Welcome each new client.", reason: "New clients need a smooth start.", exampleTasks: ["Write a welcome note", "Draft a checklist"] },
    { name: "Session Notes", objective: "Keep a record of each session.", reason: "Notes track progress.", exampleTasks: ["Summarise a session"] },
  ];

  it("shows Functions one at a time with example tasks, not a wall of text", () => {
    const e = createAndSaveEnterprise({ name: "Life Coach", mission: "Coach." });
    const entries = startNextReview(e.id, e.name, recs);
    expect(entries[0].label).toBe("Areas of work to set up");
    expect(entries[1].label).toBe("Area of work 1 of 2");
    expect(entries[1].body).toContain("Client Onboarding");
    expect(entries[1].body).toContain("For example, it could handle:");
    expect(entries[1].body).toContain("Write a welcome note");
    expect(entries.length).toBe(2);
    expect(isNextReviewActive()).toBe(true);
  });

  it("creates only the Functions the operator says yes to", () => {
    const e = createAndSaveEnterprise({ name: "Life Coach", mission: "Coach." });
    startNextReview(e.id, e.name, recs);

    const second = handleNextReviewReply("yes"); // Client Onboarding
    expect(second?.[0].label).toBe("Area of work 2 of 2");

    const done = handleNextReviewReply("skip"); // skip Session Notes
    expect(isNextReviewActive()).toBe(false);

    const labels = listBusinessFunctionDefinitionsByEnterprise(e.id).map((d) => d.label);
    expect(labels).toContain("Client Onboarding");
    expect(labels).not.toContain("Session Notes");
    // Ends by pointing at /staff.
    expect(JSON.stringify(done)).toContain("/staff");
  });

  it("creates nothing when every Function is skipped", () => {
    const e = createAndSaveEnterprise({ name: "Life Coach", mission: "Coach." });
    startNextReview(e.id, e.name, recs);
    handleNextReviewReply("skip");
    const done = handleNextReviewReply("skip");
    expect(done?.[0].label).toBe("Nothing created");
    expect(listBusinessFunctionDefinitionsByEnterprise(e.id)).toHaveLength(0);
  });

  it("re-asks on an answer that is not yes/skip/cancel", () => {
    const e = createAndSaveEnterprise({ name: "Life Coach", mission: "Coach." });
    startNextReview(e.id, e.name, recs);
    const again = handleNextReviewReply("huh?");
    expect(again?.[0].body).toContain("Please reply yes");
    expect(isNextReviewActive()).toBe(true);
  });

  it("cancels cleanly, creating nothing", () => {
    const e = createAndSaveEnterprise({ name: "Life Coach", mission: "Coach." });
    startNextReview(e.id, e.name, recs);
    const cancelled = handleNextReviewReply("cancel");
    expect(cancelled?.[0].label).toBe("Nothing created");
    expect(isNextReviewActive()).toBe(false);
    expect(listBusinessFunctionDefinitionsByEnterprise(e.id)).toHaveLength(0);
  });
});
