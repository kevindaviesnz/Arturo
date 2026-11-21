import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCommandMenu,
  handleCommandMenuReply,
  handleUiCommand,
  isCommandMenuActive,
} from "./uiCommandHandlers";

import {
  clearAddHumanWorkerFlow,
  handleAddHumanWorkerReply,
  isAddHumanWorkerFlowActive,
} from "./uiAddHumanWorkerFlow";

import {
  addWorker,
  clearWorkers,
  getWorker,
  listWorkers,
} from "../control/workers";

import {
  isApprovalCapableMode,
  resolveDefaultHumanWorkerMode,
} from "../control/humanWorkerMode";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  attachRuntimeToBusinessFunctionDefinition,
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearWorkflows,
} from "../control/workflows";

import {
  loadPolicyRules,
  savePolicyRules,
} from "../storage/policyRepository";

import {
  clearHumanTasks,
  createHumanTask,
} from "../runtime/humanTaskStore";

import {
  clearOperationalMemory,
  listAllOperationalMemory,
} from "../memory/operationalMemoryStore";

/**
 * A command given a name but not the value that decides what the thing can do
 * used to store it silently. With the switches gone, supplying only the name is
 * the normal way to type these, so the omission became the common case rather
 * than the unusual one.
 *
 * The worst of them was /add-human-worker: a role-less person cannot approve
 * governed work, which only surfaced later at /approve — a failure already seen
 * in a walkthrough and documented on isApprovalCapableMode.
 */
describe("a create that names the thing but not what it does", () => {
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearCommandMenu();
    clearAddHumanWorkerFlow();
    clearWorkers();
    clearEnterprises();
    createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearCommandMenu();
    clearAddHumanWorkerFlow();
    clearWorkers();
    clearEnterprises();
  });

  it("asks what a person will do, instead of registering one who cannot approve", async () => {
    const asked = await handleUiCommand("/add-human-worker", ["Dana Blue"]);

    expect(asked[0].label).toBe("Responsibilities:");
    expect(asked[0].body).toContain("Sign off sensitive work");
    expect(isAddHumanWorkerFlowActive()).toBe(true);
    // Nothing is registered until the role is answered.
    expect(getWorker("Dana Blue")).toBeUndefined();

    handleAddHumanWorkerReply("1"); // the approver role
    handleAddHumanWorkerReply("skip"); // no email

    const person = getWorker("Dana Blue");
    expect(person).toBeDefined();
    expect(person?.archetype).toBe("guardian");
    // The whole point: this person can actually approve governed work.
    expect(
      isApprovalCapableMode(resolveDefaultHumanWorkerMode(person?.archetype))
    ).toBe(true);
  });

  it("still allows a person with no sign-off role, when that is chosen", async () => {
    await handleUiCommand("/add-human-worker", ["Dana Blue"]);
    handleAddHumanWorkerReply("3"); // just do the tasks they are given
    handleAddHumanWorkerReply("skip"); // no email

    const person = getWorker("Dana Blue");
    expect(person).toBeDefined();
    expect(
      isApprovalCapableMode(resolveDefaultHumanWorkerMode(person?.archetype))
    ).toBe(false);
  });

  it("asks an AI Worker's role, instead of quietly making it an assistant", async () => {
    const asked = await handleUiCommand("/add-ai-worker", ["Bare Analyst"]);

    expect(asked[0].label).toBe("What is its role?");
    expect(asked[0].body).toContain("Bare Analyst");
    expect(isCommandMenuActive()).toBe(true);
    expect(getWorker("Bare Analyst")).toBeUndefined();

    const roleLine = asked[0].body
      .split("\n")
      .find((line) => line.includes("analyst —"));
    expect(roleLine).toBeDefined();

    await handleCommandMenuReply(roleLine!.trim().match(/^(\d+)\./)![1]);

    const worker = getWorker("Bare Analyst");
    expect(worker?.archetype).toBe("analyst");
  });

  it("asks for the refinement when only a Worker is named", async () => {
    await handleUiCommand("/add-ai-worker", ["Bare Analyst", "analyst"]);

    const asked = await handleUiCommand("/refine-worker", ["Bare Analyst"]);
    expect(asked[0].label).toBe("How should Bare Analyst specialise?");
    expect(isCommandMenuActive()).toBe(true);

    await handleCommandMenuReply("Focus on billing questions and label uncertainty.");
    expect(getWorker("Bare Analyst")?.refinement).toContain("billing questions");
  });

  it("says so plainly when the named Worker does not exist", async () => {
    const asked = await handleUiCommand("/refine-worker", ["Nobody"]);
    expect(asked[0].label).toBe("Worker not found");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("keeps every non-interactive path silent, so scripts never block", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });

    await handleUiCommand("/add-human-worker", ["Dana Blue"]);
    await handleUiCommand("/add-ai-worker", ["Bare Analyst"]);

    expect(isAddHumanWorkerFlowActive()).toBe(false);
    expect(isCommandMenuActive()).toBe(false);
    expect(listWorkers().filter((worker) => !worker.system)).toHaveLength(2);
  });
});

/**
 * A partial invocation used to answer with a usage line listing the switches
 * this work removed — teaching back exactly what the guided flows exist to
 * replace. Each now enters the flow at the value that is missing.
 */
describe("a partial invocation that used to print a usage line", () => {
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearCommandMenu();
    clearWorkers();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearHumanTasks();
    clearOperationalMemory();
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearCommandMenu();
    clearWorkers();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearHumanTasks();
    clearOperationalMemory();
  });

  it("asks which detail to change on /enterprise update", async () => {
    createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });

    const asked = await handleUiCommand("/enterprise", ["update", "Probe Co"]);
    expect(asked[0].label).toBe("Change Probe Co");
    expect(asked[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("asks which detail to change on /function update", async () => {
    const enterprise =
      createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:f`,
      enterpriseId: enterprise.id,
      label: "Probe Function",
      objective: "Do probes.",
    });

    const asked = await handleUiCommand("/function", ["update", "Probe Function"]);
    expect(asked[0].label).toBe("Change Probe Function");
    expect(asked[0].body).not.toContain("--");
  });

  it("asks what was done when /complete-human-task is given only an id", async () => {
    const task = createHumanTask({ title: "Inspect it", instructions: "Look." });

    const asked = await handleUiCommand("/complete-human-task", [task.id]);
    expect(asked[0].label).toBe('What was done for "Inspect it"?');
    expect(asked[0].body).not.toContain("--as");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("asks what is blocking when /block-task is given only an id", async () => {
    const task = createHumanTask({ title: "Inspect it", instructions: "Look." });

    const asked = await handleUiCommand("/block-task", [task.id]);
    expect(asked[0].label).toBe("What is blocking it?");

    const done = await handleCommandMenuReply("The unit has not arrived.");
    expect(done?.[0].label).toBe("Human task blocked");
  });

  it("says so plainly when the id does not exist", async () => {
    const asked = await handleUiCommand("/complete-human-task", ["human-task-999"]);
    expect(asked[0].label).toBe("Human task not found");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks where a note applies when /memory add has no scope", async () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });

    const asked = await handleUiCommand("/memory", [
      "add",
      "Our house style is short sentences.",
    ]);
    expect(asked[0].label).toBe("Where does it apply?");
    expect(asked[0].body).not.toContain("--scope");
    expect(listAllOperationalMemory()).toHaveLength(0);

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Operational Memory added");
    expect(listAllOperationalMemory()[0].content).toContain("short sentences");
  });

  it("keeps the usage line for scripts, which cannot answer a question", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });

    const refused = await handleUiCommand("/enterprise", ["update", "Probe Co"]);
    expect(refused[0].label).toBe("Usage");
    expect(isCommandMenuActive()).toBe(false);
  });
});

/**
 * The last six: a partial flag-form invocation of the wizard-backed commands.
 * Each continues its existing flow from the value it still needs.
 */
describe("a partial invocation of a wizard-backed command", () => {
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearCommandMenu();
    clearWorkers();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    clearWorkflows();
    savePolicyRules([]);
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearCommandMenu();
    clearWorkers();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    clearWorkflows();
    savePolicyRules([]);
  });

  /** One business with `count` Functions, optionally running. */
  function seedFunctions(count: number, running = false): void {
    const enterprise =
      createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });
    for (let index = 0; index < count; index += 1) {
      const label = `Function ${index + 1}`;
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:f${index}`,
        enterpriseId: enterprise.id,
        label,
        objective: `Do ${label}.`,
      });
      if (running) {
        attachRuntimeToBusinessFunctionDefinition(label, `runtime-${index}`);
        saveBusinessFunction({
          id: `runtime-${index}`,
          label,
          objective: `Do ${label}.`,
          ownerWorker: "W",
          refinements: [],
          state: "running",
          jobIds: [],
        });
      }
    }
  }

  it("continues the attach wizard from /artefact add \"<name>\"", async () => {
    const asked = await handleUiCommand("/artefact", ["add", "Client contract"]);
    expect(asked[0].label).toBe("What kind of file?");
    expect(asked[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("asks the cadence from /schedule add \"<outcome>\"", async () => {
    const asked = await handleUiCommand("/schedule", ["add", "Prepare a weekly summary."]);
    expect(asked[0].label).toBe("How often?");
    expect(asked[0].body).not.toContain("--every");
  });

  it("asks the effect from /governance policy add \"<description>\"", async () => {
    createAndSaveEnterprise({ name: "Probe Co", mission: "Probe." });

    const asked = await handleUiCommand("/governance", [
      "policy",
      "add",
      "Email needs approval",
    ]);
    expect(asked[0].label).toBe("What should happen?");
    expect(asked[0].body).not.toContain("--effect");
    // A policy decides whether governed work runs; nothing is stored until
    // every answer has been given.
    expect(loadPolicyRules()).toHaveLength(0);
  });

  it("asks the objective from /workflow create \"<name>\"", async () => {
    addWorker({
      name: "Researcher",
      kind: "ai",
      archetype: "researcher",
      capabilities: ["llm"],
      run: function* (input: unknown) {
        return input;
      },
    });

    const asked = await handleUiCommand("/workflow", ["create", "Fast Fashion"]);
    expect(asked[0].label).toBe("What is it for?");
    expect(asked[0].body).not.toContain("--step");
  });

  it("asks who needs help and who does it, from /delegation request \"<work>\"", async () => {
    seedFunctions(2, true);

    const fromAsk = await handleUiCommand("/delegation", [
      "request",
      "Check the supplied contract for a termination clause.",
    ]);
    expect(fromAsk[0].label).toBe("Which Function needs the help?");
    expect(fromAsk[0].body).not.toContain("--from");

    const toAsk = await handleCommandMenuReply("1");
    expect(toAsk?.[0].label).toContain("Function 1");

    // The work was given up front, so there is nothing further to ask.
    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Delegation requested");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks which Function an Event is about, from /event publish \"<name>\"", async () => {
    seedFunctions(2);

    const asked = await handleUiCommand("/event", ["publish", "evidence-ready"]);
    expect(asked[0].label).toBe("Which Function is this about?");
    expect(asked[0].body).not.toContain("--source");
  });

  it("publishes straight away when only one Function could be the source", async () => {
    seedFunctions(1);

    const done = await handleUiCommand("/event", ["publish", "evidence-ready"]);
    expect(done[0].label).toBe("Event published");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("keeps the usage line for scripts on every one of them", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    seedFunctions(2, true);

    for (const [command, args] of [
      ["/artefact", ["add", "Client contract"]],
      ["/schedule", ["add", "Prepare a weekly summary."]],
      ["/governance", ["policy", "add", "Email needs approval"]],
      ["/workflow", ["create", "Fast Fashion"]],
      ["/delegation", ["request", "Some work"]],
      ["/event", ["publish", "evidence-ready"]],
    ] as [string, string[]][]) {
      await handleUiCommand(command, args);
      expect(isCommandMenuActive(), `${command} started a menu`).toBe(false);
    }
  });
});
