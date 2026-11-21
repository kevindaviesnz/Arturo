import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  Kernel,
} from "../kernel/kernel";

import {
  planAskWorkflow,
} from "./askWorkflow";

import {
  clearApprovalChains,
  getApprovalChain,
} from "../runtime/approvalChainStore";

import {
  clearJobs,
  enqueueJob,
} from "../runtime/jobQueue";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
} from "../control/workers";

import {
  appendRuntimeEventToStore,
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  clearRuntimeReplayCheckpoint,
} from "../storage/runtimeReplayCheckpointRepository";

import {
  createDefaultHelpText,
  createFullHelpText,
  findMissingSlashSuggestion,
  formatHelpGroups,
  formatUnknownCommandMessage,
  handleCommand,
  listKnownCommands,
  resetApplicationState,
} from "./commands";

vi.mock("./askWorkflow", async () => {
  const actual =
    await vi.importActual<typeof import("./askWorkflow")>(
      "./askWorkflow"
    );

  return {
    ...actual,
    planAskWorkflow: vi.fn(),
  };
});

beforeEach(() => {
  clearJobs();
  clearApprovalChains();
  clearRuntimeEventStore();
  clearRuntimeReplayCheckpoint();
  clearWorkers();
  addWorker(
    createHumanWorker("Kevin", "guardian")
  );
  vi.clearAllMocks();
});

describe("help text", () => {
  it("formats help command groups", () => {
    const text =
      formatHelpGroups([
        {
          title: "Group A",
          commands: [
            "/one",
            "/two",
          ],
        },
        {
          title: "Group B",
          commands: [
            "/three",
          ],
        },
      ]);

    expect(text).toBe(
      [
        "Group A",
        "",
        "/one",
        "/two",
        "",
        "Group B",
        "",
        "/three",
      ].join("\n")
    );
  });

    it("shows curated primary commands in default help", () => {
    const text =
      createDefaultHelpText();

    expect(text).toContain(
      "Arturo command guide"
    );

    expect(text).toContain(
      "/ask"
    );

    expect(text).toContain(
      "/delegation"
    );

    expect(text).toContain(
      "/functions"
    );

    expect(text).toContain(
      "/model-routing"
    );

    expect(text).toContain(
      "Governance and people"
    );

    // /workflow moved to /help all with the rest of the unproven Workflow
    // surface; /ask is the one the guide still offers.
    expect(text).not.toContain("/workflow");
    expect(text).toContain("/ask");
    expect(text).toContain("/artefact");

    expect(text).toContain(
      "Use /help all to show low-level developer commands."
    );

    expect(text).not.toContain(
      "/kernel-dispatch <call-id>"
    );
  });

  it("prints default help from the help command", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "/help",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Arturo command guide"
      )
    );

    const output =
      log.mock.calls
        .map((call) => String(call[0]))
        .join("\n");

    expect(output).not.toContain(
      "/kernel-dispatch <call-id>"
    );
  });

  it("prints detailed help for one primary command", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await handleCommand("/help delegation", new Kernel());
    expect(log).toHaveBeenCalledWith(expect.stringContaining(
      '/delegation request "<bounded-work>"'
    ));
  });

  it("prints full help from the help all command", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "/help all",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Kernel and process tools"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "/kernel-dispatch <call-id>"
      )
    );
  });
});

describe("REPL approval commands", () => {
  it("reports missing approval chain", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "/approval-status missing-job",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      "approval chain not found: missing-job"
    );
  });

  it("records approval decision", async () => {
    const job =
      enqueueJob(
        "Approve deploy",
        "operator",
        {
          requiredCapabilities: [
            "human-review" as any,
          ],
          requiredApprovals: 1,
        }
      );

    await handleCommand(
      `/approve ${job.id}`,
      new Kernel()
    );

    expect(
      getApprovalChain(job.id)?.status
    ).toBe("approved");
    expect(
      getApprovalChain(job.id)?.decisions[0].worker
    ).toBe("Kevin");
  });

  it("records rejection decision", async () => {
    const job =
      enqueueJob(
        "Approve deploy",
        "operator",
        {
          requiredCapabilities: [
            "human-review" as any,
          ],
          requiredApprovals: 1,
        }
      );

    await handleCommand(
      `/reject ${job.id} "Unsafe"`,
      new Kernel()
    );

    expect(
      getApprovalChain(job.id)?.status
    ).toBe("rejected");
  });

  it("reset clears approval chains", () => {
    const job =
      enqueueJob(
        "Approve deploy",
        "operator",
        {
          requiredCapabilities: [
            "human-review" as any,
          ],
        }
      );

    expect(
      getApprovalChain(job.id)
    ).toBeDefined();

    resetApplicationState();

    expect(
      getApprovalChain(job.id)
    ).toBeUndefined();
  });

  it("prints formatted approval chain", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    const job =
      enqueueJob(
        "Deploy production",
        "operator",
        {
          requiredCapabilities: [
            "human-review" as any,
          ],
          requiredApprovals: 2,
        }
      );

    await handleCommand(
      `/approve ${job.id}`,
      new Kernel()
    );

    await handleCommand(
      `/approval-status ${job.id}`,
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Status: pending"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Kevin: approved"
      )
    );
  });
});

describe("REPL replay commands", () => {
  it("prints replay events", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    appendRuntimeEventToStore({
      id: "event-1",
      type: "job.queued",
      level: "info",
      message: "Job queued",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    });

    await handleCommand(
      "/replay-events",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "job.queued"
      )
    );
  });

  it("prints replay state", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    appendRuntimeEventToStore({
      id: "event-1",
      type: "job.queued",
      level: "info",
      message: "Job queued",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    });

    await handleCommand(
      "/replay-state",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Replay state"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Events: 1"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Tasks observed: 1"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "job-1 queued"
      )
    );
  });

  it("creates replay checkpoint", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    appendRuntimeEventToStore({
      id: "event-1",
      type: "job.queued",
      level: "info",
      message: "Job queued",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    });

    await handleCommand(
      "/replay-checkpoint",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Replay checkpoint created"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Events: 1"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "State hash:"
      )
    );
  });

  it("verifies replay checkpoint", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    appendRuntimeEventToStore({
      id: "event-1",
      type: "job.queued",
      level: "info",
      message: "Job queued",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    });

    await handleCommand(
      "/replay-checkpoint",
      new Kernel()
    );

    await handleCommand(
      "/replay-verify-checkpoint",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Replay checkpoint verification"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Valid: true"
      )
    );
  });

  it("prints historical replay state", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    appendRuntimeEventToStore({
      id: "event-1",
      type: "approval.approved",
      level: "success",
      message: "Approval recorded",
      timestamp: 1000000,
      payload: {
        jobId: "job-1",
      },
    });

    await handleCommand(
      "/replay-history",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Replay history"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Events: 1"
      )
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Approvals observed: 1"
      )
    );
  });
});

describe("unknown command feedback", () => {
  it("suggests a slash command when the slash is missing", () => {
    expect(
      findMissingSlashSuggestion(
        "jobs",
        listKnownCommands()
      )
    ).toBe("/jobs");
  });

  it("does not suggest when command already starts with slash", () => {
    expect(
      findMissingSlashSuggestion(
        "/missing",
        listKnownCommands()
      )
    ).toBeUndefined();
  });

  it("formats missing slash suggestions", () => {
    expect(
      formatUnknownCommandMessage(
        "jobs",
        listKnownCommands()
      )
    ).toBe(
      [
        "unknown command: jobs",
        "Did you mean /jobs?",
      ].join("\n")
    );
  });

  it("formats unknown slash commands with help hint", () => {
    expect(
      formatUnknownCommandMessage(
        "/nope",
        listKnownCommands()
      )
    ).toBe(
      [
        "unknown command: /nope",
        "Use /help to show available commands.",
      ].join("\n")
    );
  });

  it("prints a missing slash suggestion from the command handler", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "jobs --all",
      new Kernel()
    );

    expect(log).toHaveBeenCalledWith(
      [
        "unknown command: jobs",
        "Did you mean /jobs?",
      ].join("\n")
    );
  });
});

describe("ask command feedback", () => {
  it("prints background workflow guidance after creating a workflow", async () => {
    vi.mocked(
      planAskWorkflow
    ).mockResolvedValue({
      request: "Research functional programming",
      objective: {
        description: "Research functional programming",
        type: "research",
        lifetime: "finite",
        businessPattern: "Education",
        supported: true,
        reason: "The request asks for research.",
      },
      originalPlan: {
        objective: "Research functional programming",
        explanation: "Research requested.",
        steps: [
          {
            archetype: "researcher",
            instruction: "Research functional programming.",
          },
        ],
      },
      enforcedPlan: {
        objective: "Research functional programming",
        explanation: "Research requested.",
        steps: [
          {
            archetype: "researcher",
            instruction: "Research functional programming.",
          },
        ],
      },
      workflowRunId: "run-1",
      stepCount: 1,
      firstWorkerName: "Researcher",
      enforcementApplied: false,
      autoWorkers: false,
      autoCreatedWorkers: [],
    });

    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "/add-ai-worker Researcher researcher",
      new Kernel()
    );

    await handleCommand(
      '/ask "Research functional programming"',
      new Kernel()
    );

    const output =
      log.mock.calls
        .map((call) => String(call[0]))
        .join("\n");

    expect(output).toContain(
      "Plan is ready for review."
    );

    expect(output).toContain(
      "Tasks have been drafted but execution has not started yet."
    );

    expect(output).toContain(
      "Use /tasks"
    );

    expect(output).toContain(
      "Use /start run-1"
    );
    
  });

  it("prints usage before planning when request is missing", async () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => {}
      );

    await handleCommand(
      "/ask",
      new Kernel()
    );

    const output =
      log.mock.calls
        .map((call) => String(call[0]))
        .join("\n");

    expect(output).toContain(
      'Usage: /ask "<request>"'
    );

    expect(output).not.toContain(
      "Planning workflow..."
    );
  });
});
