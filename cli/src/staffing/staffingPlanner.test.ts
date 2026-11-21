import { describe, expect, it } from "vitest";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import type { Worker } from "../control/workers";
import {
  assignUnambiguousApprovers,
  buildStaffingRepairPrompt,
  completeCapabilityCoverage,
  createStaffingPlan,
  includeExistingAssignments,
  isUninformativeWorkerName,
  requireApprovalForSensitiveWork,
  parseStaffingPlan,
} from "./staffingPlanner";

const functions = [
  createBusinessFunctionDefinition({ id: "f-1", enterpriseId: "e-1", label: "Sourcing" }),
  createBusinessFunctionDefinition({ id: "f-2", enterpriseId: "e-1", label: "Safety", requiredArchetypes: ["guardian"] }),
];

const existingWorkers: Worker<any, any>[] = [{
  name: "Safety Worker", kind: "ai", archetype: "guardian", trust: false,
  availability: "available", capabilities: ["llm"], run: function* (input: any) { return input; },
}];

describe("parseStaffingPlan", () => {
  it("accepts shared coverage and reuse of a registered worker", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Reuse safety coverage and add one shared operations worker.",
      workers: [
        { name: "Operations Worker", archetype: "operator", functionIds: ["f-1", "f-2"], existing: false, rationale: "Compatible operational work." },
        { name: "Safety Worker", archetype: "guardian", functionIds: ["f-2"], existing: true, rationale: "Retain specialist review." },
      ],
      humanApprovals: [],
    }), functions, existingWorkers);
    expect(plan.workers[0].functionIds).toEqual(["f-1", "f-2"]);
    expect(plan.workers[1].existing).toBe(true);
  });

  it("adds transparent fallback coverage when the model omits a function", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Incomplete plan",
      workers: [{ name: "Operations Worker", archetype: "operator", functionIds: ["f-1"], existing: false, rationale: "Operations." }],
      humanApprovals: [],
    }), functions, existingWorkers);
    expect(plan.workers[1]).toMatchObject({
      name: "Safety AI", archetype: "guardian", functionIds: ["f-2"],
      existing: false, source: "fallback",
    });
    expect(plan.summary).toContain("fallback coverage for 1 omitted Function");
  });

  it("normalizes an invented existing AI worker into a new proposal", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Create missing capability",
      workers: [{ name: "Pattern Analyst", archetype: "analyst", functionIds: ["f-1", "f-2"], existing: true, rationale: "Analyze patterns." }],
      humanApprovals: [],
    }), functions, existingWorkers);
    expect(plan.workers[0]).toMatchObject({
      name: "Pattern Analyst",
      existing: false,
    });
  });

  it("grounds a Worker rationale default in the objective but drops an unreasoned approval", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      workers: [{ name: "Operations Worker", archetype: "operator", functionIds: ["f-1", "f-2"], existing: false }],
      humanApprovals: [{ functionId: "f-2" }],
    }), functions, existingWorkers);
    expect(plan.summary).toBe("Staffing coverage proposed for 2 Functions.");
    // A missing Worker rationale is still filled from the Function objective.
    expect(plan.workers[0].rationale).toContain("Sourcing, Safety");
    // But an approval requirement with no stated reason is over-gating and is
    // dropped here; the deterministic sensitive-work classifier re-adds it with
    // a real reason if the work is genuinely consequential.
    expect(plan.humanApprovals).toEqual([]);
  });

  it("supplies a declared archetype when the model omits one", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Coverage",
      workers: [{ name: "Safety Coverage", functionIds: ["f-1", "f-2"], rationale: "Coverage." }],
      humanApprovals: [],
    }), functions, existingWorkers);
    expect(plan.workers[0]).toMatchObject({
      archetype: "guardian",
      archetypeSource: "fallback",
    });
  });

  it("keeps approval requirements but removes invented human identities", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Invalid identities",
      workers: [{ name: "Pattern Analyst", archetype: "analyst", functionIds: ["f-1", "f-2"], existing: false, rationale: "Analyze patterns." }],
      humanApprovals: [{ functionId: "f-2", workerName: "Invented Human", rationale: "Approval." }],
    }), functions, existingWorkers);
    expect(plan.humanApprovals[0]).toEqual({
      functionId: "f-2",
      workerName: undefined,
      rationale: "Approval.",
    });
  });

  it("makes incomplete-plan repair requirements explicit", () => {
    const prompt = buildStaffingRepairPrompt(
      functions,
      existingWorkers,
      '{"workers":[]}',
      "staffing plan does not cover: Sourcing, Safety",
      1
    );
    expect(prompt).toContain("Required Function IDs (2):\n- f-1\n- f-2");
    expect(prompt).toContain("Return the COMPLETE plan again");
    expect(prompt).toContain("Correction attempt 1 of 3");
  });
});

/**
 * The sensitive-work classification is a separate model call made before the
 * plan. These stubs answer it with "nothing sensitive" so each test exercises
 * the planner behaviour it is actually about; the classifier has its own tests.
 */
const isClassificationPrompt = (prompt: string): boolean =>
  prompt.includes("Answer with one word, YES or NO");

describe("staffing generation options", () => {
  it("passes corrective feedback to an explicit model route", async () => {
    const prompts: string[] = [];
    const plan = await createStaffingPlan(
      [functions[1]],
      [],
      {
        model: "approved-model",
        feedback: "Prefer one guardian.",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          prompts.push(prompt);
          return {
            response: JSON.stringify({
              summary: "Bounded plan",
              workers: [{
                name: "Safety Guardian",
                archetype: "guardian",
                functionIds: ["f-2"],
                existing: false,
                rationale: "Covers safety.",
              }],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    expect(plan.summary).toBe("Bounded plan");
    expect(prompts[0]).toContain("Prefer one guardian.");
    expect(prompts[0]).toContain("<user_feedback>");
  });

  it("drops an unreasoned model approval when the work is not sensitive", async () => {
    const plan = await createStaffingPlan(
      [functions[0]],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          return {
            response: JSON.stringify({
              summary: "Bounded plan",
              workers: [{
                name: "Sourcing Analyst",
                archetype: "analyst",
                functionIds: ["f-1"],
                existing: false,
                rationale: "Covers sourcing.",
              }],
              // Blanket, unreasoned human approval — over-gating.
              humanApprovals: [{ functionId: "f-1" }],
            }),
          };
        },
      }
    );

    expect(plan.humanApprovals).toEqual([]);
  });

  it("still gates genuinely sensitive work even when the model proposed no approval", async () => {
    const plan = await createStaffingPlan(
      [functions[0]],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "YES" };
          return {
            response: JSON.stringify({
              summary: "Bounded plan",
              workers: [{
                name: "Sourcing Analyst",
                archetype: "analyst",
                functionIds: ["f-1"],
                existing: false,
                rationale: "Covers sourcing.",
              }],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    // The deterministic classifier — not the planner — is the authority, so the
    // requirement is present with a real, category-grounded reason.
    expect(plan.humanApprovals.length).toBeGreaterThan(0);
    expect(plan.humanApprovals[0].functionId).toBe("f-1");
    expect(plan.humanApprovals[0].rationale.length).toBeGreaterThan(0);
  });

  it("grounds the prompt with each Function's required capabilities and every archetype's capabilities", async () => {
    const prompts: string[] = [];
    await createStaffingPlan(
      [functions[1]],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          prompts.push(prompt);
          return {
            response: JSON.stringify({
              summary: "Bounded plan",
              workers: [{
                name: "Safety Guardian",
                archetype: "guardian",
                functionIds: ["f-2"],
                existing: false,
                rationale: "Covers safety.",
              }],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    expect(prompts[0]).toContain("requiredCapabilities");
    expect(prompts[0]).toContain('"safety"');
    expect(prompts[0]).toContain("Archetype capabilities");
    expect(prompts[0]).toContain('"guardian"');
  });

  it("accepts a team whose archetypes together cover a Function (no fallback, no retry)", async () => {
    // "Content Quality" infers writing + monitoring; no single archetype has
    // both, but a creator (writing) plus an observer (monitoring) cover it.
    const contentQuality = createBusinessFunctionDefinition({
      id: "f-cq",
      enterpriseId: "e-1",
      label: "Content Quality",
    });

    let call = 0;
    const plan = await createStaffingPlan(
      [contentQuality],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          call += 1;
          return {
            response: JSON.stringify({
              summary: "Team plan",
              workers: [
                { name: "Content Writer", archetype: "creator", functionIds: ["f-cq"], existing: false, rationale: "Writes content." },
                { name: "Quality Watcher", archetype: "observer", functionIds: ["f-cq"], existing: false, rationale: "Monitors quality." },
              ],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    expect(call).toBe(1);
    expect(plan.summary).toBe("Team plan");
    expect(plan.workers).toHaveLength(2);
    expect(plan.workers.some((worker) => worker.source === "fallback")).toBe(false);
  });

  it("completes coverage as a team instead of retrying when the plan leaves a capability gap", async () => {
    // The model staffs "Content Quality" (needs writing + monitoring) with a
    // creator only (writing). Arturo adds an observer to cover monitoring —
    // one generator call, no retry.
    const contentQuality = createBusinessFunctionDefinition({
      id: "f-cq",
      enterpriseId: "e-1",
      label: "Content Quality",
    });

    let call = 0;
    const plan = await createStaffingPlan(
      [contentQuality],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          call += 1;
          return {
            response: JSON.stringify({
              summary: "Partial plan",
              workers: [
                { name: "Content Writer", archetype: "creator", functionIds: ["f-cq"], existing: false, rationale: "Writes content." },
              ],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    expect(call).toBe(1);
    expect(plan.workers).toHaveLength(2);
    const added = plan.workers.find((worker) => worker.source === "fallback");
    expect(added).toBeDefined();
    expect(added?.archetype).toBe("observer");
    expect(added?.functionIds).toEqual(["f-cq"]);
    expect(plan.summary).toContain("complete capability coverage");
  });

  it("parses a plan wrapped in ```json fences", () => {
    const fenced = "```json\n" + JSON.stringify({
      summary: "Fenced plan",
      workers: [{ name: "Safety Guardian", archetype: "guardian", functionIds: ["f-2"], existing: false, rationale: "Covers safety." }],
      humanApprovals: [],
    }) + "\n```";
    const plan = parseStaffingPlan(fenced, [functions[1]], existingWorkers);
    expect(plan.summary).toBe("Fenced plan");
    expect(plan.workers[0].archetype).toBe("guardian");
  });

  it("never retries; it completes coverage deterministically even for omitted Functions", async () => {
    // A Job with no declared requiredArchetypes and a label that triggers no
    // capability keyword, so it defaults to the generic "analysis" capability.
    // The model omits it entirely: parseStaffingPlan adds an "assistant"
    // omitted-Job fallback (which lacks "analysis"), then completeCapability-
    // Coverage adds an "analyst" to fill that gap — all in one call, no retry.
    const uncoveredFunction = createBusinessFunctionDefinition({
      id: "f-3",
      enterpriseId: "e-1",
      label: "Vendor Contracts",
    });

    let call = 0;
    const plan = await createStaffingPlan(
      [uncoveredFunction],
      [],
      {
        model: "approved-model",
        allowAutomaticEscalation: false,
        generator: async ({ prompt }) => {
          if (isClassificationPrompt(prompt)) return { response: "NO" };
          call += 1;
          return {
            response: JSON.stringify({
              summary: "Omits the Function",
              workers: [],
              humanApprovals: [],
            }),
          };
        },
      }
    );

    expect(call).toBe(1);
    // The omitted-Job fallback (assistant) plus the capability-completing analyst.
    expect(plan.workers[0]).toMatchObject({
      source: "fallback",
      archetype: "assistant",
      functionIds: ["f-3"],
    });
    expect(
      plan.workers.some(
        (worker) => worker.archetype === "analyst" && worker.functionIds.includes("f-3")
      )
    ).toBe(true);
  });
});

describe("assignUnambiguousApprovers", () => {
  const humanWorker: Worker<any, any> = {
    name: "Kevin Davies", kind: "human", trust: false, humanMode: "approval",
    availability: "available", capabilities: [], run: function* (input: any) { return input; },
  } as any;

  const planNeedingApproval = {
    summary: "Coverage",
    workers: [],
    humanApprovals: [{ functionId: "f-2", workerName: undefined, rationale: "Safety decisions need a person." }],
  };

  it("names the only registered Human rather than telling the operator to add one", () => {
    const plan = assignUnambiguousApprovers(planNeedingApproval, [...existingWorkers, humanWorker]);
    expect(plan.humanApprovals[0].workerName).toBe("Kevin Davies");
    expect(plan.humanApprovals[0].rationale).toContain("the only registered Human Worker");
  });

  it("does not name a Human who cannot approve, so the plan and the approval gate agree", () => {
    const taskOnlyHuman = { ...humanWorker, humanMode: "task" as const };
    const plan = assignUnambiguousApprovers(planNeedingApproval, [taskOnlyHuman]);
    expect(plan.humanApprovals[0].workerName).toBeUndefined();
  });

  it("leaves the choice with the operator when several Humans could approve", () => {
    const plan = assignUnambiguousApprovers(planNeedingApproval, [
      humanWorker,
      { ...humanWorker, name: "Sam Reed" },
    ]);
    expect(plan.humanApprovals[0].workerName).toBeUndefined();
  });

  it("leaves an approval the model already assigned untouched", () => {
    const assigned = {
      ...planNeedingApproval,
      humanApprovals: [{ functionId: "f-2", workerName: "Kevin Davies", rationale: "Named by the plan." }],
    };
    expect(assignUnambiguousApprovers(assigned, [humanWorker]).humanApprovals[0]).toEqual(
      assigned.humanApprovals[0]
    );
  });
});

describe("includeExistingAssignments", () => {
  const coverageFunctions = [
    createBusinessFunctionDefinition({
      id: "f-2",
      enterpriseId: "e-1",
      label: "Safety",
      requiredArchetypes: ["guardian"],
    }),
  ];
  const monitoringWorker: Worker<any, any> = {
    name: "Safety Observer", kind: "ai", archetype: "observer", trust: false,
    availability: "available", capabilities: ["llm", "monitoring"],
    run: function* (input: any) { return input; },
  } as any;
  const emptyPlan = { summary: "Coverage", workers: [], humanApprovals: [] };

  it("re-adds a previously assigned Worker the model dropped, so coverage is not duplicated", () => {
    const merged = includeExistingAssignments(
      emptyPlan,
      coverageFunctions,
      [monitoringWorker],
      new Map([["f-2", ["Safety Observer"]]])
    );
    expect(merged.workers).toHaveLength(1);
    expect(merged.workers[0]).toMatchObject({
      name: "Safety Observer",
      existing: true,
      functionIds: ["f-2"],
    });

    // With the existing observer folded back in, its monitoring capability is
    // covered and no second observer is invented on the re-run.
    const completed = completeCapabilityCoverage(merged, coverageFunctions, [monitoringWorker]);
    expect(
      completed.workers.filter((worker) => worker.archetype === "observer")
    ).toHaveLength(1);
  });

  it("does not duplicate a Worker the model already listed for the Function", () => {
    const planWithWorker = {
      ...emptyPlan,
      workers: [{
        name: "Safety Observer", archetype: "observer" as const,
        functionIds: ["f-2"], existing: true,
        rationale: "Reused.",
      }],
    };
    const merged = includeExistingAssignments(
      planWithWorker,
      coverageFunctions,
      [monitoringWorker],
      new Map([["f-2", ["Safety Observer"]]])
    );
    expect(merged.workers).toHaveLength(1);
  });

  it("ignores an assignment whose Worker is no longer registered", () => {
    const merged = includeExistingAssignments(
      emptyPlan,
      coverageFunctions,
      [],
      new Map([["f-2", ["Ghost Worker"]]])
    );
    expect(merged.workers).toHaveLength(0);
  });
});

describe("worker naming", () => {
  it.each([
    "Researcher",
    "Analyst",
    "Observer",
    "Coach",
    "AI Worker",
    "The Assistant",
    "analyst",
    "LLM agent",
  ])("treats %s as naming no role", (name) => {
    expect(isUninformativeWorkerName(name)).toBe(true);
  });

  it.each([
    "Client Communication Analyst",
    "Contract Review Specialist",
    "Food Safety Guardian",
    "Donation Processing Analyst",
  ])("accepts %s as a role name", (name) => {
    expect(isUninformativeWorkerName(name)).toBe(false);
  });

  it("renames a bare archetype after the Function it covers, and says so", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Coverage",
      workers: [{ name: "Observer", archetype: "guardian", functionIds: ["f-2"], existing: false, rationale: "Watches safety." }],
      humanApprovals: [],
    }), functions, existingWorkers);

    expect(plan.workers[0].name).toBe("Safety Guardian");
    expect(plan.workers[0].rationale).toContain('Renamed from "Observer"');
  });

  it("keeps distinct names when the model proposes the same bare archetype twice", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Coverage",
      workers: [
        { name: "Analyst", archetype: "analyst", functionIds: ["f-1"], existing: false, rationale: "One." },
        { name: "analyst", archetype: "analyst", functionIds: ["f-1"], existing: false, rationale: "Two." },
      ],
      humanApprovals: [],
    }), functions, existingWorkers);

    expect(plan.workers.slice(0, 2).map((worker) => worker.name)).toEqual([
      "Sourcing Analyst",
      "Sourcing Analyst 2",
    ]);
  });

  it("never renames a Worker that is already registered", () => {
    const plan = parseStaffingPlan(JSON.stringify({
      summary: "Reuse",
      workers: [{ name: "Safety Worker", archetype: "guardian", functionIds: ["f-2"], existing: true, rationale: "Reuse." }],
      humanApprovals: [],
    }), functions, existingWorkers);

    expect(plan.workers[0].name).toBe("Safety Worker");
    expect(plan.workers[0].rationale).not.toContain("Renamed");
  });
});

describe("requireApprovalForSensitiveWork", () => {
  const basePlan = { summary: "Coverage.", workers: [], humanApprovals: [] };

  it("adds the approval the planner omitted for sensitive work", () => {
    const plan = requireApprovalForSensitiveWork(
      basePlan,
      functions,
      new Map([["f-1", []], ["f-2", ["safety-or-health" as const]]])
    );

    expect(plan.humanApprovals).toHaveLength(1);
    expect(plan.humanApprovals[0].functionId).toBe("f-2");
    expect(plan.summary).toContain("Arturo required Human approval for 1 Function");
  });

  it("leaves work that touches nothing sensitive alone", () => {
    expect(
      requireApprovalForSensitiveWork(
        basePlan,
        functions,
        new Map([["f-1", []], ["f-2", []]])
      ).humanApprovals
    ).toEqual([]);
  });

  it("requires approval for every Function when classification is unavailable", () => {
    expect(
      requireApprovalForSensitiveWork(basePlan, functions, undefined).humanApprovals
    ).toHaveLength(2);
  });

  it("does not duplicate an approval the planner already proposed", () => {
    const plan = requireApprovalForSensitiveWork(
      { ...basePlan, humanApprovals: [{ functionId: "f-2", rationale: "Planner said so." }] },
      functions,
      new Map([["f-1", []], ["f-2", ["safety-or-health" as const]]])
    );

    expect(plan.humanApprovals).toEqual([{ functionId: "f-2", rationale: "Planner said so." }]);
  });
});

/**
 * A person whose name reads like a role — "Editor in Chief", "Workshop
 * Luthier" — gets reused by the model as the name of the AI Worker covering
 * that Function. Failing the whole plan over it left the Enterprise with no
 * Workers at all after three correction attempts, twice, on two different
 * names. The intent was fine; only the name was wrong.
 */
describe("a proposal that collides with a registered person", () => {
  const withHuman: Worker<any, any>[] = [
    ...existingWorkers,
    {
      name: "Editor in Chief", kind: "human", archetype: "guardian", trust: true,
      availability: "available", capabilities: [], run: function* (input: any) { return input; },
    },
  ];

  const planNaming = (name: string) => parseStaffingPlan(JSON.stringify({
    summary: "Cover both Functions.",
    workers: [
      { name, archetype: "analyst", functionIds: ["f-1"], existing: false, rationale: "Reads submissions." },
      { name: "Safety Worker", archetype: "guardian", functionIds: ["f-2"], existing: true, rationale: "Reuse." },
    ],
    humanApprovals: [],
  }), functions, withHuman);

  it("renames the AI Worker instead of failing the plan", () => {
    const plan = planNaming("Editor in Chief");

    expect(plan.workers).toHaveLength(2);
    expect(plan.workers[0].name).not.toBe("Editor in Chief");
    expect(plan.workers[0].functionIds).toEqual(["f-1"]);
    expect(plan.workers[0].existing).toBe(false);
  });

  it("never lets an AI Worker carry the person's name", () => {
    // Approvals are signed in a named person's name; two participants
    // answering to one name would make that record ambiguous.
    const names = planNaming("editor in chief").workers.map((worker) => worker.name.toLowerCase());

    expect(names).not.toContain("editor in chief");
  });

  it("still reuses a registered AI Worker under its own name", () => {
    expect(planNaming("Sourcing Analyst").workers[1]).toMatchObject({
      name: "Safety Worker",
      existing: true,
    });
  });
});
