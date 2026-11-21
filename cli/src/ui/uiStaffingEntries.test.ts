import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import {
  clearBusinessFunctions,
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import { clearPolicyRules, loadPolicyRules } from "../storage/policyRepository";
import { evaluateJobGovernance } from "../runtime/jobGovernance";
import type { StaffingPlan } from "../staffing/staffingPlanner";
import { clearStaffingAssignments } from "../staffing/staffingStore";
import {
  applyStaffingPlan,
  clearStaffReview,
  describePaidEscalation,
  formatPlan,
  formatStaffingAppliedBody,
  formatStaffingNextSteps,
  handleStaffReviewReply,
  handleUiStaffCommand,
  inferStaffingWorkerCapabilities,
  isStaffReviewActive,
  parseStaffCommandOptions,
  startStaffReview,
} from "./uiStaffingEntries";
import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";
import {
  clearWorkers,
  getWorker,
} from "../control/workers";

afterEach(() => {
  clearBusinessFunctionDefinitions();
  clearEnterprises();
});

describe("formatPlan", () => {
  beforeEach(() => clearBusinessFunctionDefinitions());

  it("shows accountable worker and approval details using function names and IDs", () => {
    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:function-1",
      enterpriseId: "enterprise-1",
      label: "Resource Development",
    });
    const text = formatPlan({
      summary: "Reviewable coverage.",
      workers: [{
        name: "Resource Development AI",
        archetype: "assistant",
        functionIds: ["enterprise-1:function-1"],
        existing: false,
        rationale: "Fallback coverage requires review.",
        source: "fallback",
      }],
      humanApprovals: [{
        functionId: "enterprise-1:function-1",
        rationale: "Accountable approval is required.",
      }],
    }, true, "Koru Kids");

    expect(text).toContain("Enterprise: Koru Kids");
    expect(text).toContain("Resource Development AI");
    expect(text).toContain("Role:    assistant");
    expect(text).toContain("Resource Development (enterprise-1:function-1)");
    expect(text).toContain("Arturo added this, please review");
    expect(text).toContain(
      'Nobody yet — add a person who can approve with /add-human-worker (that can be you).'
    );
    expect(text).toContain("1 still needs a person to approve");
    expect(text).toContain("Accountable approval is required.");
  });

  it("omits confirmation from read-only comparisons", () => {
    const text = formatPlan({
      summary: "Comparison only.",
      workers: [],
      humanApprovals: [],
    }, false);

    expect(text).not.toContain("Shall Arturo set this up?");
  });

  it("derives governed Web Search and summarisation routing from covered Functions", () => {
    createAndSaveBusinessFunctionDefinition({
      id:
        "enterprise-1:function-1",
      enterpriseId:
        "enterprise-1",
      label:
        "Science Discovery",
      objective:
        "Get the latest science news from the internet.",
    });
    createAndSaveBusinessFunctionDefinition({
      id:
        "enterprise-1:function-2",
      enterpriseId:
        "enterprise-1",
      label:
        "Science News Summarisation",
      objective:
        "Summarise the supplied science news evidence.",
    });
    const proposal = {
      name:
        "Science News Researcher",
      archetype:
        "researcher" as const,
      functionIds: [
        "enterprise-1:function-1",
        "enterprise-1:function-2",
      ],
      existing:
        false,
      rationale:
        "Covers the small two-stage process.",
    };

    expect(
      inferStaffingWorkerCapabilities(
        proposal
      )
    ).toEqual([
      "web-research",
      "research",
      "summarisation",
    ]);
    expect(
      formatPlan({
        summary:
          "One shared Worker.",
        workers: [
          proposal,
        ],
        humanApprovals:
          [],
      })
    ).toContain(
      "Can do:"
    );
    expect(
      formatPlan({
        summary:
          "One shared Worker.",
        workers: [
          proposal,
        ],
        humanApprovals:
          [],
      })
    ).toContain(
      "Web Research"
    );
  });
});

describe("formatStaffingAppliedBody", () => {
  it("tells the operator how to give the business work next, switch-free", () => {
    const body = formatStaffingAppliedBody(2, 3, "Product Safety", "Ethical Toys");
    expect(body).toContain("Two AI Workers added, and put to work on three Functions.");
    // The three ways in are their own entry now, so the applied body no longer
    // carries them.
    const next = formatStaffingNextSteps().body;
    expect(next).toContain("/suggest");
    expect(next).toContain("/task");
    expect(next).toContain("/schedule");
    // No copy-paste flags in the guidance any more.
    expect(next).not.toContain("--function");
    expect(next).not.toContain("--input-artefact");
    expect(next).not.toContain("/job");
  });

  it("uses singular wording for a single worker, and names the one Function", () => {
    const body = formatStaffingAppliedBody(1, 1, "Product Safety", "Ethical Toys");
    expect(body).toContain("One AI Worker added, and put to work on Product Safety.");
  });

  it("says who was assigned when the plan only reuses Workers already on the team", () => {
    const body = formatStaffingAppliedBody(0, 1, "Trend Research", "Threadline Fashion", [], [], [], ["Trend Researcher"]);
    expect(body).toContain("Trend Researcher, already on your team, is now assigned to Trend Research. No new AI Workers were added.");
    expect(body).not.toContain("Zero AI Workers added");
  });

  it("names reused Workers beside the ones it added", () => {
    const body = formatStaffingAppliedBody(1, 2, "Trend Research", "Threadline Fashion", [], [], [], ["Trend Researcher", "Brief Creator"]);
    expect(body).toContain("One AI Worker added, and put to work on two Functions alongside Trend Researcher and Brief Creator, already on your team.");
  });

  it("warns when a Function still has no approver, naming the one it means", () => {
    const body = formatStaffingAppliedBody(2, 3, "Product Safety", "Ethical Toys", [
      "Product Safety",
    ]);
    expect(body).toContain("Product Safety still needs a person who can approve");
    expect(body).toContain("/add-human-worker");
    // Switch-free: the gap guidance no longer tells the user to type a flag.
    expect(body).not.toContain("--archetype guardian");
    // One Function is named in the sentence rather than left as a single
    // bullet under a colon.
    expect(body).not.toContain("· Product Safety");
  });

  it("bullets the Functions when more than one has no approver", () => {
    const body = formatStaffingAppliedBody(2, 3, "Product Safety", "Ethical Toys", [
      "Product Safety",
      "Evidence Gathering",
    ]);
    expect(body).toContain("two Functions still need a person who can approve");
    expect(body).toContain("· Product Safety");
    expect(body).toContain("· Evidence Gathering");
  });

  it("does not claim the business is idle-but-ready when no approver gap exists", () => {
    const body = formatStaffingAppliedBody(1, 1, "Product Safety", "Ethical Toys", []);
    expect(body).not.toContain("still need");
  });

  it("keeps the promise to name the work that needs sign-off, and who holds it", () => {
    // startStaffReview opens with "N kinds of work will also need your sign-off
    // — I'll note that at the end". That note only ever appeared when a Function
    // had been left *without* an approver, so the ordinary case — one guardian,
    // every Function assigned to them — promised a list and then said nothing.
    // Seen live in scenario 050: five Functions, five sign-off requirements, all
    // assigned to the National Controller, and not one of them named.
    const body = formatStaffingAppliedBody(
      11,
      11,
      "Situation Monitoring",
      "National Emergency Coordination",
      [],
      [
        { label: "Situation Monitoring", approver: "National Controller" },
        { label: "Public Information", approver: "National Controller" },
      ]
    );

    expect(body).toContain("· Situation Monitoring — National Controller");
    expect(body).toContain("· Public Information — National Controller");
  });

  it("says nothing about sign-off when the plan requires none", () => {
    const body = formatStaffingAppliedBody(1, 1, "Product Safety", "Ethical Toys", [], []);
    expect(body).not.toContain("who Arturo will ask");
  });
});

describe("parseStaffCommandOptions", () => {
  it("points the removed model switches at /model instead of a cold unknown-option error", () => {
    for (const removed of ["--model", "--retry", "--compare"]) {
      expect(() =>
        parseStaffCommandOptions([removed, "local"])
      ).toThrow("/model");
    }
  });

  it("parses an Enterprise and staffing instructions", () => {
    expect(
      parseStaffCommandOptions([
        "--enterprise",
        "Koru Kids",
        "--instructions",
        "Prefer shared coverage.",
      ])
    ).toEqual({
      enterpriseReference: "Koru Kids",
      instructions: "Prefer shared coverage.",
    });
  });

  it("still rejects a genuinely unknown option", () => {
    expect(() =>
      parseStaffCommandOptions(["--nonsense", "x"])
    ).toThrow("Unknown /staff option");
  });
});

describe("handleUiStaffCommand Enterprise selection", () => {
  beforeEach(() => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });

  it("reports an explicit unknown Enterprise before model generation", async () => {
    createAndSaveEnterprise({
      name: "Koru Kids",
    });

    expect(
      (await handleUiStaffCommand([
        "--enterprise",
        "Missing Enterprise",
      ]))[0]
    ).toMatchObject({
      label: "Enterprise not found",
      body: expect.stringContaining("Missing Enterprise"),
    });
  });

  it("asks which business when more than one Enterprise exists", async () => {
    createAndSaveEnterprise({
      name: "Koru Kids",
    });
    createAndSaveEnterprise({
      name: "Koru Labs",
    });

    // A staffing plan is scoped to one business, so this has to be resolved —
    // but by a numbered question, not by demanding --enterprise.
    const asked = (await handleUiStaffCommand([]))[0];
    expect(asked).toMatchObject({ label: "Which business?" });
    expect(asked.body).toContain("1. Koru Kids");
    expect(asked.body).toContain("2. Koru Labs");
    expect(asked.body).not.toContain("--enterprise");
    expect(isStaffReviewActive()).toBe(true);

    const cancelled = await handleStaffReviewReply("cancel");
    expect(cancelled?.[0].label).toBe("Staffing unchanged");
    expect(isStaffReviewActive()).toBe(false);
  });
});

describe("applyStaffingPlan governance", () => {
  beforeEach(() => {
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    clearEnterprises();
    clearPolicyRules();
    clearStaffingAssignments();
    clearWorkers();
    createAndSaveEnterprise({ name: "t & s heating ltd", mission: "Repair boilers." });
    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:invoicing",
      enterpriseId: "enterprise-1",
      label: "invoicing",
    });
  });

  afterEach(() => {
    clearPolicyRules();
    clearBusinessFunctions();
    clearStaffingAssignments();
    clearWorkers();
  });

  const planRequiringApproval: StaffingPlan = {
    summary: "Coverage.",
    workers: [{
      name: "Invoicing Analyst",
      archetype: "analyst",
      functionIds: ["enterprise-1:invoicing"],
      existing: false,
      rationale: "Covers invoicing.",
    }],
    humanApprovals: [{
      functionId: "enterprise-1:invoicing",
      rationale: "Money leaves the business.",
    }],
  };

  it("writes an enforceable policy rule, not just a staffing assignment", () => {
    applyStaffingPlan(planRequiringApproval);

    expect(loadPolicyRules()).toContainEqual(
      expect.objectContaining({
        id: "staffing-approval:enterprise-1:invoicing",
        effect: "require-approval",
        match: {
          businessFunctionId: "enterprise-1:invoicing",
          consequentialOnly: true,
        },
      })
    );
  });

  it("holds work that reaches outside Arturo", () => {
    applyStaffingPlan(planRequiringApproval);

    expect(
      evaluateJobGovernance({
        id: "job-1",
        task: "Email the customer their quote.",
        requiredCapabilities: ["email-send"],
        businessFunctionId: "enterprise-1:invoicing",
        status: "queued",
        createdAt: 1,
      })
      // The matched rule id matters as much as the effect: without it this
      // passes for the wrong reason, because the fail-closed consequential
      // default would gate email-send anyway with no rule at all.
    ).toMatchObject({
      effect: "require-approval",
      matchedRuleId: "staffing-approval:enterprise-1:invoicing",
      requiredApprovals: 1,
    });
  });

  // The complaint this whole change answers: "for every task I have to approve
  // it". Analysis has no effect outside Arturo, so nobody should be asked.
  it("lets analysis in the same Function run without asking anyone", () => {
    applyStaffingPlan(planRequiringApproval);

    expect(
      evaluateJobGovernance({
        id: "job-2",
        task: "Compose a quote for the requested repairs.",
        requiredCapabilities: ["analysis"],
        businessFunctionId: "enterprise-1:invoicing",
        status: "queued",
        createdAt: 1,
      })
    ).toBeUndefined();
  });

  it("writes no rule when the plan requires no Human approval", () => {
    applyStaffingPlan({ ...planRequiringApproval, humanApprovals: [] });

    expect(loadPolicyRules()).toEqual([]);
  });

  // A staffed-but-unstarted Function watches no Events, so it never reacts to
  // work another Function finishes — and because directly created Tasks run
  // regardless of operating state, nothing on screen reveals it.
  it("leaves the Functions it staffed running", () => {
    applyStaffingPlan(planRequiringApproval);

    const definition = getBusinessFunctionDefinition("enterprise-1:invoicing");
    expect(definition?.runtimeId).toBeDefined();
    expect(getBusinessFunction(definition!.runtimeId!)?.state).toBe("running");
  });

  it("says how to chain the Functions it started", () => {
    const entries = applyStaffingPlan(planRequiringApproval);

    expect(entries[0].body).toContain("invoicing");
    expect(entries[0].body).toContain("only does the work you ask for directly");
    expect(entries[0].body).toContain("/event");
  });

  // Starting grants no new authority: the approval rule the plan just wrote is
  // in force before anything starts, so a governed Task still waits.
  it("still governs work in a Function it started", () => {
    applyStaffingPlan(planRequiringApproval);

    expect(
      evaluateJobGovernance({
        id: "job-1",
        task: "Email the customer their quote.",
        requiredCapabilities: ["email-send"],
        businessFunctionId: "enterprise-1:invoicing",
        status: "queued",
        createdAt: 1,
      })
    ).toMatchObject({ effect: "require-approval" });
  });

  it("does not start a Function with no available AI Worker behind it", () => {
    applyStaffingPlan({
      ...planRequiringApproval,
      workers: [],
    });

    expect(
      getBusinessFunctionDefinition("enterprise-1:invoicing")?.runtimeId
    ).toBeUndefined();
  });
});

describe("interactive staffing review", () => {
  beforeEach(() => {
    clearBusinessFunctionDefinitions();
    clearEnterprises();
    clearPolicyRules();
    clearStaffReview();
    clearWorkers();
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:onboarding",
      enterpriseId: "enterprise-1",
      label: "Client Onboarding",
    });
    createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:notes",
      enterpriseId: "enterprise-1",
      label: "Session Notes",
    });
  });
  afterEach(() => {
    clearStaffReview();
    clearWorkers();
    clearPolicyRules();
  });

  const twoWorkerPlan: StaffingPlan = {
    summary: "Coverage.",
    workers: [
      { name: "Onboarding Coach", archetype: "coach", functionIds: ["enterprise-1:onboarding"], existing: false, rationale: "Covers onboarding." },
      { name: "Notes Assistant", archetype: "assistant", functionIds: ["enterprise-1:notes"], existing: false, rationale: "Covers notes." },
    ],
    humanApprovals: [],
  };

  it("shows Workers one at a time with example tasks, not a wall of text", () => {
    const entries = startStaffReview(twoWorkerPlan, "Solo Co");
    expect(entries[0].label).toContain("Arturo suggests two AI Workers");
    expect(entries[1].label).toBe("Worker one of two");
    expect(entries[1].body).toContain("Onboarding Coach");
    expect(entries[1].body).toContain("Can do");
    // The second Worker is not dumped in the same turn.
    expect(entries.length).toBe(2);
    expect(isStaffReviewActive()).toBe(true);
  });

  it("creates only the Workers the operator says yes to", async () => {
    startStaffReview(twoWorkerPlan, "Solo Co");

    const second = await handleStaffReviewReply("yes"); // add Coach
    expect(second?.[0].label).toBe("Worker two of two");

    const done = await handleStaffReviewReply("skip"); // skip Assistant
    expect(done?.[0].label).toBe("Staffing applied");
    expect(isStaffReviewActive()).toBe(false);

    expect(getWorker("Onboarding Coach")).toBeDefined();
    expect(getWorker("Notes Assistant")).toBeUndefined();
  });

  // Counting each Worker's functionIds summed assignments, so staffing one
  // Function with two Workers announced "put to work on 2 Functions" — and a
  // real six-Function Enterprise staffed with fifteen Workers reported
  // fifteen, more Functions than existed.
  it("counts distinct Functions, not Worker-to-Function assignments", async () => {
    startStaffReview(
      {
        summary: "Coverage.",
        workers: [
          { name: "Onboarding Coach", archetype: "coach", functionIds: ["enterprise-1:onboarding"], existing: false, rationale: "Covers onboarding." },
          { name: "Onboarding Planner", archetype: "planner", functionIds: ["enterprise-1:onboarding"], existing: false, rationale: "Also covers onboarding." },
        ],
        humanApprovals: [],
      },
      "Solo Co"
    );

    await handleStaffReviewReply("yes");
    const done = await handleStaffReviewReply("yes");

    expect(done?.[0].body).toContain("Two AI Workers added, and put to work on");
  });

  it("creates nothing when every Worker is skipped", async () => {
    startStaffReview(twoWorkerPlan, "Solo Co");
    await handleStaffReviewReply("skip");
    const done = await handleStaffReviewReply("skip");
    expect(done?.[0].label).toBe("Staffing unchanged");
    expect(getWorker("Onboarding Coach")).toBeUndefined();
  });

  it("re-asks on an answer that is not yes/skip/cancel", async () => {
    startStaffReview(twoWorkerPlan, "Solo Co");
    const again = await handleStaffReviewReply("what?");
    expect(again?.[0].body).toContain("Please reply yes");
    expect(isStaffReviewActive()).toBe(true);
  });

  it("cancels cleanly, creating nothing", async () => {
    startStaffReview(twoWorkerPlan, "Solo Co");
    const cancelled = await handleStaffReviewReply("cancel");
    expect(cancelled?.[0].label).toBe("Staffing unchanged");
    expect(isStaffReviewActive()).toBe(false);
    expect(getWorker("Onboarding Coach")).toBeUndefined();
  });

  it("still writes the approval rule for an approved Worker's Function", async () => {
    const planWithApproval: StaffingPlan = {
      ...twoWorkerPlan,
      humanApprovals: [{ functionId: "enterprise-1:onboarding", rationale: "Touches clients." }],
    };
    startStaffReview(planWithApproval, "Solo Co");
    await handleStaffReviewReply("yes"); // Coach
    await handleStaffReviewReply("yes"); // Assistant

    expect(loadPolicyRules()).toContainEqual(
      expect.objectContaining({
        id: "staffing-approval:enterprise-1:onboarding",
        effect: "require-approval",
      })
    );
  });
});

/**
 * /staff escalates to a paid external model on its own after the local model
 * fails schema validation four times. Consent for that is install-time only, so
 * nothing said it had happened — the operator's first notice was an error
 * message naming a paid call that had already been made and billed.
 */
describe("describePaidEscalation", () => {
  it("says nothing when no paid call was made", () => {
    expect(
      describePaidEscalation(3, {
        paidCallsRemaining: 3,
        paidModel: "gemini-2.0-flash",
      })
    ).toEqual([]);
  });

  it("names the model, the cost and what left the machine", () => {
    const [entry] =
      describePaidEscalation(3, {
        paidCallsRemaining: 2,
        paidModel: "gemini-2.0-flash",
      });

    expect(entry.label).toBe("Paid model used");
    expect(entry.body).toContain("gemini-2.0-flash");
    expect(entry.body).toContain("1 paid call");
    expect(entry.body).toContain("2 remain");
    // Cost is not the only thing spent: the Enterprise's Function and Worker
    // names travel in the escalation prompt.
    expect(entry.body).toContain("were sent to that provider");
    expect(entry.body).toContain("ARTURO_PAID_ESCALATION_ENABLED=false");
  });

  it("counts more than one call correctly", () => {
    const [entry] =
      describePaidEscalation(5, {
        paidCallsRemaining: 3,
        paidModel: undefined,
      });

    expect(entry.body).toContain("2 paid calls");
    expect(entry.body).toContain("the configured external model");
  });
});
