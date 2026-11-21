import { describe, expect, it } from "vitest";
import {
  demoGovernedTaskStep,
  demoOpeningMoves,
  demoStaffing,
  demoSteps,
  DEMO_GOVERNED_FUNCTION,
} from "./demoScript";
import { inferTaskCapabilities } from "../repl/taskRoutingCommands";
import { getArchetypeCapabilities } from "../agents/archetypeCapabilities";
import type { AgentArchetype } from "../agents/agentArchetype";
import { seedDemoEnterprise } from "./seedDemo";
import { listJobs } from "../runtime/jobQueue";
import { evaluateJobGovernance } from "../runtime/jobGovernance";
import { listEnterprises } from "../enterprise/enterpriseStore";
import { listWorkers } from "../control/workers";

describe("demo script", () => {
  it("uses no command that needs a model provider", () => {
    const modelBacked = ["/next", "/staff", "/ask", "/suggest", "/workflow", "/run"];

    for (const step of demoSteps()) {
      expect(modelBacked, step.narrative).not.toContain(step.command);
    }
  });

  it("staffs every Function it creates", () => {
    const created = demoSteps()
      .filter((step) => step.command === "/function")
      .map((step) => step.args[1]);
    const staffed = new Set(
      demoStaffing().map((assignment) => assignment.functionLabel)
    );

    for (const label of created) {
      expect(staffed.has(label), `${label} is unstaffed`).toBe(true);
    }
  });

  it("registers every Worker it later staffs", () => {
    const registered = new Set(
      demoSteps()
        .filter(
          (step) =>
            step.command === "/add-ai-worker" ||
            step.command === "/add-human-worker"
        )
        .map((step) => step.args[0])
    );

    for (const assignment of demoStaffing()) {
      expect(
        registered.has(assignment.workerName),
        `${assignment.workerName} is staffed but never registered`
      ).toBe(true);
    }
  });

  it("gives the governed Function a Worker covering the Task's capabilities", () => {
    const required = inferTaskCapabilities(
      demoGovernedTaskStep().args[1]
    );
    const archetypeByWorker = new Map(
      demoSteps()
        .filter((step) => step.command === "/add-ai-worker")
        .map((step) => [step.args[0], step.args[2]])
    );
    const staffedArchetypes = demoStaffing()
      .filter(
        (assignment) =>
          assignment.functionLabel === DEMO_GOVERNED_FUNCTION &&
          assignment.role === "ai"
      )
      .map((assignment) => archetypeByWorker.get(assignment.workerName));

    // Routing selects one Worker that supports every required capability, so
    // the union across the team is not sufficient.
    const covering = staffedArchetypes.filter((archetype) =>
      archetype
        ? required.every((capability) =>
            getArchetypeCapabilities(
              archetype as AgentArchetype
            ).includes(capability)
          )
        : false
    );

    expect(covering.length, `no single archetype covers ${required.join(", ")}`)
      .toBeGreaterThan(0);
  });

  it("governs the Task it creates with a matching require-approval policy", () => {
    const required = inferTaskCapabilities(
      demoGovernedTaskStep().args[1]
    );
    const policyStep = demoSteps().find(
      (step) => step.command === "/governance"
    );
    const capabilityIndex =
      (policyStep?.args ?? []).indexOf("--capability");
    const governed = policyStep?.args[capabilityIndex + 1];

    expect(required).toContain(governed);
  });

  it("opens on inspection rather than generation", () => {
    expect(demoOpeningMoves()[0]).toBe("/overview");
    expect(demoOpeningMoves()).toContain("/approvals");
  });
});

/**
 * The checks above read the script. These run it, because both ways the seed
 * has broken were invisible to them: its own readiness check searched command
 * output for wording that had since changed, and its reset was never confirmed.
 */
describe("seeded demonstration", () => {
  const quiet = (): void => undefined;

  it("seeds one held Task and a staffed company, however often it is run", async () => {
    await seedDemoEnterprise(quiet);
    await seedDemoEnterprise(quiet);

    const tasks = listJobs();
    expect(tasks).toHaveLength(1);
    expect(evaluateJobGovernance(tasks[0])?.effect).toBe("require-approval");

    const enterprises = listEnterprises();
    expect(enterprises).toHaveLength(1);

    const registered = demoSteps()
      .filter(
        (step) =>
          step.command === "/add-ai-worker" ||
          step.command === "/add-human-worker"
      )
      .map((step) => step.args[0]);

    const workerNames = listWorkers()
      .filter((worker) => registered.includes(worker.name))
      .map((worker) => worker.name)
      .sort();
    expect(workerNames).toEqual([...registered].sort());
    expect(tasks[0].enterpriseId).toBe(enterprises[0].id);
  });
});
