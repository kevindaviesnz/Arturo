import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  readsAsRefusal,
} from "../ui/uiConsoleCapture";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

import {
  clearEnterprises,
  createAndSaveEnterprise as persistEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";

import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  handleTaskCreateCommand,
  parseTaskCreateOptions,
} from "./taskRoutingCommands";

import { ensureTestSigner } from "../testing/cliTestSetup";

function createAndSaveEnterprise(
  input: Parameters<typeof persistEnterprise>[0]
): ReturnType<typeof persistEnterprise> {
  const enterprise = persistEnterprise(input);
  ensureTestSigner({ enterpriseId: enterprise.id });
  return enterprise;
}



function createSafetyJob(): {
  readonly enterpriseId: string;
  readonly jobId: string;
} {
  const enterprise =
    createAndSaveEnterprise({
      name: "Toy Safety Co",
      mission: "Keep children safe.",
    });
  const job =
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:safety`,
      enterpriseId: enterprise.id,
      label: "Product Safety",
      objective: "Ensure every toy is safe for its intended age group.",
    });

  return {
    enterpriseId: enterprise.id,
    jobId: job.id,
  };
}

function addSafetyAiWorker(): void {
  addWorker({
    name: "Toy Safety Worker",
    displayName: "Toy Safety Worker",
    kind: "ai",
    archetype: "guardian",
    run: function* (input: unknown) {
      return input;
    },
  });
}

function staffJob(
  jobId: string,
  workerName: string
): void {
  saveStaffingAssignment({
    businessFunctionId: jobId,
    workerName,
    role: "ai",
    rationale: "Assigned for this test.",
  });
}

describe("handleTaskCreateCommand", () => {
  beforeEach(() => {
    clearJobs();
    clearWorkers();
    clearStaffingAssignments();
    clearBusinessFunctionDefinitions();
    clearEnterprises();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearJobs();
    clearWorkers();
    clearStaffingAssignments();
    clearBusinessFunctionDefinitions();
    clearEnterprises();
    vi.restoreAllMocks();
  });

  it("creates a Task for the only available Function without --job", () => {
    const {
      jobId,
    } = createSafetyJob();
    addSafetyAiWorker();
    staffJob(
      jobId,
      "Toy Safety Worker"
    );

    handleTaskCreateCommand([
      "Review the toy safety evidence and list release-blocking gaps.",
    ]);

    expect(listJobs()).toHaveLength(1);
    expect(listJobs()[0]).toMatchObject({
      task: "Review the toy safety evidence and list release-blocking gaps.",
      worker: "Toy Safety Worker",
      selectedWorker: "Toy Safety Worker",
      owningJobId: jobId,
      requiredCapabilities: [
        "safety",
        "review",
      ],
    });
    expect(listJobs()[0].routingReason).toContain(
      "Inferred Function Product Safety"
    );
  });

  it("routes to the best-covering Worker when a team-staffed Function has no single Worker for every capability", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Fluxwire",
      });
    const pipeline =
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:pipeline`,
        enterpriseId: enterprise.id,
        label: "Pipeline",
        // Objective yields monitoring ("Monitor") + coordination ("operation").
        objective: "Monitor pipelines and keep continuous operation.",
      });
    // A two-Worker team with disjoint capabilities — neither holds both. No
    // archetype, so the explicit capabilities are kept as-is.
    addWorker({
      name: "AAA Observer",
      kind: "ai",
      capabilities: ["monitoring"],
      run: function* (input: unknown) {
        return input;
      },
    });
    addWorker({
      name: "BBB Coordinator",
      kind: "ai",
      capabilities: ["coordination"],
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(pipeline.id, "AAA Observer");
    staffJob(pipeline.id, "BBB Coordinator");

    handleTaskCreateCommand([
      "Handle the daily pipeline run.",
      "--job",
      "Pipeline",
    ]);

    // The Task is created, not refused, and routed to the best-covering Worker.
    expect(listJobs()).toHaveLength(1);
    const job = listJobs()[0];
    expect(job.requiredCapabilities).toEqual(["monitoring", "coordination"]);
    // AAA Observer sorts first and covers one required capability; the shortfall
    // is recorded rather than hidden.
    expect(job.worker).toBe("AAA Observer");
    expect(job.routingReason).toContain("Best-available coverage");
    expect(job.routingReason).toContain("coordination");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("partial coverage")
    );
  });

  it("routes a cognitive-only Task the staffed team cannot cover, instead of dead-ending", () => {
    // A walkthrough hit this straight after applying Arturo's own staffing
    // plan: the Task inferred only "summarisation", nobody staffed held it,
    // and /task create refused outright with advice (/staff) that could not
    // fix it. A cognitive shortfall routes with the gap reported; it must not
    // refuse.
    const enterprise = createAndSaveEnterprise({ name: "LedgerBot Books" });
    const onboarding = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:onboarding`,
      enterpriseId: enterprise.id,
      label: "Client Onboarding",
      objective: "Collect the information a new client engagement needs.",
    });
    addWorker({
      name: "Client Onboarding Analyst",
      kind: "ai",
      capabilities: ["llm", "analysis"],
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(onboarding.id, "Client Onboarding Analyst");

    handleTaskCreateCommand([
      "Summarise what a good weekly client report should contain.",
      "--job",
      "Client Onboarding",
    ]);

    expect(listJobs()).toHaveLength(1);
    const job = listJobs()[0];
    expect(job.requiredCapabilities).toEqual(["summarisation"]);
    expect(job.worker).toBe("Client Onboarding Analyst");
    // It holds llm and analysis and the Task needs summarisation, so it covers
    // none of it. Calling that partial cover overstated the match.
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("no capability match")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("holds none of summarisation")
    );
  });

  it("still refuses when the missing capability is consequential, with an actionable fix", () => {
    // "safety" authorises governance-relevant work; routing must not hand it
    // to a Worker without it. The refusal names the enterprise (not its id)
    // and says how to actually fix the gap.
    const { jobId } = createSafetyJob();
    addWorker({
      name: "Product Safety Observer",
      kind: "ai",
      capabilities: ["monitoring"],
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(jobId, "Product Safety Observer");

    handleTaskCreateCommand([
      "Review the toy safety evidence and list release-blocking gaps.",
      "--job",
      "Product Safety",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("safety")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("/add-ai-worker")
    );
    // The Enterprise is named in prose now that no switch quotes it.
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Toy Safety Co")
    );
  });

  it("routes a fully-uncovered cognitive Task to the staffed Worker with the whole shortfall reported", () => {
    // monitoring + coordination are routing hints, not authorisations. A
    // staffed Function must be able to accept this work even when its only
    // Worker covers none of it — the shortfall is reported, not fatal.
    const enterprise =
      createAndSaveEnterprise({
        name: "Fluxwire Two",
      });
    const pipeline =
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:pipeline`,
        enterpriseId: enterprise.id,
        label: "Pipeline",
        objective: "Monitor pipelines and keep continuous operation.",
      });
    addWorker({
      name: "Unrelated Writer",
      kind: "ai",
      capabilities: ["writing"],
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(pipeline.id, "Unrelated Writer");

    handleTaskCreateCommand([
      "Handle the daily pipeline run.",
      "--job",
      "Pipeline",
    ]);

    expect(listJobs()).toHaveLength(1);
    expect(listJobs()[0].worker).toBe("Unrelated Writer");
    // A writer taking monitoring and coordination work holds neither.
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("no capability match")
    );
  });

  it("uses --job as an explicit override", () => {
    const {
      jobId,
    } = createSafetyJob();
    addSafetyAiWorker();
    staffJob(
      jobId,
      "Toy Safety Worker"
    );

    handleTaskCreateCommand([
      "Review the supplied toy evidence.",
      "--job",
      "Product Safety",
    ]);

    expect(listJobs()[0]).toMatchObject({
      owningJobId: jobId,
      worker: "Toy Safety Worker",
    });
    expect(listJobs()[0].routingReason).toContain(
      "Selected staffed Worker"
    );
  });

  it("infers the uniquely matching Function when several Functions exist", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Acme Backup Solutions",
      });
    const backupJob =
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:backups`,
        enterpriseId: enterprise.id,
        label: "Backup Operations",
        objective: "Create and verify recoverable backups.",
      });
    const supportJob =
      createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:support`,
      enterpriseId: enterprise.id,
      label: "Customer Support",
      objective: "Resolve customer requests.",
    });
    addWorker({
      name: "Backup Operations Assistant",
      kind: "ai",
      archetype: "operator",
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(
      backupJob.id,
      "Backup Operations Assistant"
    );
    addWorker({
      name: "Customer Support Assistant",
      kind: "ai",
      archetype: "assistant",
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(
      supportJob.id,
      "Customer Support Assistant"
    );

    handleTaskCreateCommand([
      "Verify last night's backup and record any failures.",
    ]);

    expect(listJobs()[0]).toMatchObject({
      owningJobId: backupJob.id,
      worker: "Backup Operations Assistant",
      requiredCapabilities: [
        "backup",
      ],
    });
  });

  it("requires an explicit Function when more than one candidate is equally suitable", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Acme Operations",
      });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:backup`,
      enterpriseId: enterprise.id,
      label: "Backup Operations",
      objective: "Maintain recoverable backups.",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:support`,
      enterpriseId: enterprise.id,
      label: "Customer Support",
      objective: "Resolve customer requests.",
    });

    handleTaskCreateCommand([
      "Prepare the daily report.",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "could not determine one Function"
      )
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Use /task create --job"
      )
    );
  });

  it("requires Enterprise scope before inference across Enterprises", () => {
    const first =
      createAndSaveEnterprise({
        name: "First Enterprise",
      });
    const second =
      createAndSaveEnterprise({
        name: "Second Enterprise",
      });
    createAndSaveBusinessFunctionDefinition({
      id: `${first.id}:backup`,
      enterpriseId: first.id,
      label: "Backups",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${second.id}:backups`,
      enterpriseId: second.id,
      label: "Backups",
    });

    handleTaskCreateCommand([
      "Verify last night's backup.",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "More than one Enterprise"
      )
    );
  });

  it("requires Enterprise scope for duplicate explicit Function labels", () => {
    const first =
      createAndSaveEnterprise({
        name: "First Enterprise",
      });
    const second =
      createAndSaveEnterprise({
        name: "Second Enterprise",
      });
    createAndSaveBusinessFunctionDefinition({
      id: `${first.id}:backups`,
      enterpriseId: first.id,
      label: "Backups",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${second.id}:backups`,
      enterpriseId: second.id,
      label: "Backups",
    });

    handleTaskCreateCommand([
      "Verify last night's backup.",
      "--job",
      "Backups",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "More than one Function matches"
      )
    );
  });

  it("requires AI staffing before it creates a Task", () => {
    createSafetyJob();

    handleTaskCreateCommand([
      "Review the toy safety evidence.",
    ]);

    expect(listJobs()).toHaveLength(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Product Safety needs an AI worker. Nothing was created and no AI was asked."
      )
    );
  });

  it("makes a web step only from a person's search words, for a business that turned web search on, refused before anything is written otherwise", async () => {
    const { createHumanWorker } = await import("../control/workers");
    const { runtimeDb } = await import("../storage/runtimeDatabase");
    const { clearWebSearchSwitches, turnWebSearchOn } = await import("../runtime/webSearchSwitch");
    const { createTask } = await import("./taskRoutingCommands");
    clearWebSearchSwitches();
    runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
    vi.stubEnv("ARTURO_WEB_SEARCH_PROVIDER", "brave");
    vi.stubEnv("ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION", "2");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "test-key");
    try {
    const enterprise =
      createAndSaveEnterprise({
        name: "Threadline Fashion",
      });
    const job =
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:research`,
        enterpriseId: enterprise.id,
        label: "Trend Research",
        objective: "Find current public fashion evidence.",
      });
    addWorker({
      name: "Fashion Web Researcher",
      displayName: "Fashion Web Researcher",
      kind: "ai",
      archetype: "researcher",
      run: function* (input: unknown) {
        return input;
      },
    });
    staffJob(
      job.id,
      "Fashion Web Researcher"
    );

    const ask = () => createTask([
      "Summarize captured fashion sources and label uncertainty.",
      "--search-query",
      "current recycled cotton outerwear trends",
    ]);

    // This computer's setting alone never lets anything search (W3).
    expect(ask()).toMatchObject({ created: false, code: "web_search_off", message: expect.stringContaining("Web search is off for Threadline Fashion") });
    expect(listJobs()).toEqual([]);

    addWorker(createHumanWorker("Amy Wise", "guardian"));
    runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run("Amy Wise", enterprise.id);
    expect(turnWebSearchOn({ enterpriseId: enterprise.id, reason: "Trend research.", actor: { userId: "user-amy", workerName: "Amy Wise", displayName: "Amy Wise", roles: new Map([[enterprise.id, "owner"]]) } })).toMatchObject({ record: { on: true } });
    expect(ask()).toMatchObject({ created: true });

    expect(listJobs()[0]).toMatchObject({
      worker: "Fashion Web Researcher",
      enterpriseId: enterprise.id,
      owningJobId: job.id,
      webSearchQuery:
        "current recycled cotton outerwear trends",
      requiredCapabilities: [
        "summarisation",
        "web-research",
      ],
    });
    } finally {
      vi.unstubAllEnvs();
      clearWebSearchSwitches();
      runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
    }
  });

  it("rejects the former direct capability switches", () => {
    expect(
      parseTaskCreateOptions([
        "Review the evidence.",
        "--capability",
        "safety",
      ])
    ).toEqual({
      ok: false,
      message: expect.stringContaining(
        "capabilities now come from the Worker staffed"
      ),
    });

    expect(
      parseTaskCreateOptions([
        "--bounded-task",
        "Review the evidence.",
      ])
    ).toEqual({
      ok: false,
      message: expect.stringContaining(
        "The bounded outcome is the Task itself"
      ),
    });
  });

  /**
   * The book still prints these two flags in three chapters, so the refusal is
   * what those readers actually meet. It has to name the replacement, and it
   * has to read as a refusal — captureUiCommandOutput keys the entry label off
   * the body text, and the previous wording carried none of its trigger words,
   * so a rejected command was announced as "Task created".
   */
  it("points the removed capability switches at /task and reads as a refusal", () => {
    for (const args of [
      ["Review the evidence.", "--capability", "safety"],
      ["--bounded-task", "Review the evidence."],
    ]) {
      const result =
        parseTaskCreateOptions(args);

      expect(result.ok).toBe(false);
      if (result.ok) continue;

      expect(result.message).toContain("/task");
      expect(
        readsAsRefusal(result.message)
      ).toBe(true);
    }
  });
});

describe("how a request fits a Function", () => {
  const job = (label: string, objective = label) => ({ id: `e:${label}`, enterpriseId: "e", label, objective, inputs: [], outputs: [], successCriteria: [] }) as never;

  it("counts a Function as named only by its whole name, never inside another word", async () => {
    const { taskFitParts } = await import("./taskRoutingCommands");
    expect(taskFitParts("Reads the contract and lists the dates", job("Ads")).named).toBe(false);
    expect(taskFitParts("New ads for the spring list", job("Ads")).named).toBe(true);
    expect(taskFitParts("Review the lease", job("Lease reviews"))).toMatchObject({ nameWords: 1, sharedWords: 1, named: false });
  });
});
