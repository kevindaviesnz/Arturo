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
  isCommandMenuActive,
  startFunctionsMenu,
  startRunMenu,
  startWorkflowMenu,
} from "./uiCommandHandlers";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

import {
  clearWorkflows,
  getWorkflow,
  listWorkflows,
} from "../control/workflows";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

/**
 * /workflow create needed a repeated --step "<worker>" "<instruction>" pair per
 * step, /run needed the normalized Workflow name, and /start-functions refused
 * to do anything without the bare --ready flag. All three now ask.
 */
describe("guided /workflow menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearWorkers();
    clearWorkflows();
  });
  afterEach(() => {
    clearCommandMenu();
    clearWorkers();
    clearWorkflows();
  });

  function addAiWorker(name: string): void {
    addWorker({
      name,
      kind: "ai",
      // A deterministic step is built from the Worker's archetype, so it has
      // to be a real registered role rather than a bare name.
      archetype: "researcher",
      capabilities: ["llm", "writing"],
      run: function* (input: unknown) {
        return input;
      },
    });
  }

  it("offers plan-it-for-me / set-the-steps / list without any switches", () => {
    const start = startWorkflowMenu();
    expect(start[0].label).toBe("Workflows");
    expect(start[0].body).toContain("2. Set the steps myself, in order");
    expect(start[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("builds an ordered Workflow one step at a time", async () => {
    addAiWorker("Trend Researcher");
    addAiWorker("Design Brief Creator");

    startWorkflowMenu();
    const nameAsk = await handleCommandMenuReply("2");
    expect(nameAsk?.[0].label).toBe("Name the Workflow");

    const objectiveAsk = await handleCommandMenuReply("Fast Fashion Production");
    expect(objectiveAsk?.[0].label).toBe("What is it for?");

    const firstStep = await handleCommandMenuReply(
      "Turn trend evidence into a bounded design brief."
    );
    expect(firstStep?.[0].label).toBe("Who does the first step?");
    expect(firstStep?.[0].body).toContain("1. Trend Researcher");
    // No "save it" option until there is at least one step.
    expect(firstStep?.[0].body).not.toContain("That's all the steps");

    const instructionAsk = await handleCommandMenuReply("1");
    expect(instructionAsk?.[0].label).toBe("What does that step do?");
    expect(instructionAsk?.[0].body).toContain("Trend Researcher");

    const nextStep = await handleCommandMenuReply("Summarise only supplied dated trend evidence.");
    expect(nextStep?.[0].label).toBe("Who does the next step?");
    // The steps so far are shown back, so the order is visible while building.
    expect(nextStep?.[0].body).toContain("1. Trend Researcher — Summarise only supplied dated trend evidence.");
    expect(nextStep?.[0].body).toContain("3. That's all the steps — save it");

    await handleCommandMenuReply("2");
    const secondStepDone = await handleCommandMenuReply("Create design briefs from the preceding evidence.");
    expect(secondStepDone?.[0].body).toContain("2. Design Brief Creator");

    const done = await handleCommandMenuReply("3"); // save it
    expect(isCommandMenuActive()).toBe(false);
    expect(listWorkflows()).toHaveLength(1);

    // The Workflow is stored under its normalized name, which /run then offers.
    const saved = listWorkflows()[0];
    expect(saved.name).toBe("fast-fashion-production");
    expect(saved.steps).toHaveLength(2);
    // Each step names the Worker it was assigned to, in the order given.
    expect(done?.[0].body).toContain("Trend Researcher");
    expect(done?.[0].body).toContain("Design Brief Creator");
  });

  it("re-asks rather than saving a Workflow with no steps", async () => {
    addAiWorker("Trend Researcher");
    startWorkflowMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("Fast Fashion Production");
    await handleCommandMenuReply("skip");

    // "2" would be the save option once a step exists; with none it is out of range.
    const again = await handleCommandMenuReply("2");
    expect(again?.[0].label).toBe("Who does the first step?");
    expect(isCommandMenuActive()).toBe(true);
    expect(listWorkflows()).toHaveLength(0);
  });

  it("sends the operator to /staff when no Worker could perform a step", async () => {
    startWorkflowMenu();
    const refused = await handleCommandMenuReply("2");
    expect(refused?.[0].label).toBe("No Workers yet");
    expect(refused?.[0].body).toContain("/staff");
    expect(isCommandMenuActive()).toBe(false);
  });
});

describe("guided /run picker", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearWorkflows();
  });
  afterEach(() => {
    clearCommandMenu();
    clearWorkflows();
  });

  it("says there is nothing saved to run", () => {
    const start = startRunMenu();
    expect(start[0].label).toBe("No Workflows yet");
    expect(start[0].body).toContain("/workflow");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("offers the saved Workflows by number, then asks for run context", async () => {
    expect(getWorkflow).toBeDefined();
    // Saved through the guided build path, so the picker has something to offer.
    addWorker({
      name: "Trend Researcher",
      kind: "ai",
      archetype: "researcher",
      capabilities: ["llm"],
      run: function* (input: unknown) {
        return input;
      },
    });
    startWorkflowMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("Fast Fashion Production");
    await handleCommandMenuReply("skip");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Summarise the supplied trend evidence.");
    await handleCommandMenuReply("2"); // save it
    clearWorkers();

    const start = startRunMenu();
    expect(start[0].label).toBe("Which Workflow should run?");
    expect(isCommandMenuActive()).toBe(true);

    // No Worker holds the researcher role any more, so /run asks before
    // creating one rather than doing it behind an --auto-workers switch.
    const missing = await handleCommandMenuReply("1");
    expect(missing?.[0].label).toBe("Some steps have no Worker");
    expect(missing?.[0].body).toContain("researcher");
    expect(missing?.[0].body).not.toContain("--auto-workers");

    const contextAsk = await handleCommandMenuReply("1");
    expect(contextAsk?.[0].label).toBe("Anything to add?");
    expect(contextAsk?.[0].body).toContain("skip");
  });

  it("stops without creating Workers when the operator declines", async () => {
    addWorker({
      name: "Trend Researcher",
      kind: "ai",
      archetype: "researcher",
      capabilities: ["llm"],
      run: function* (input: unknown) {
        return input;
      },
    });
    startWorkflowMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("Fast Fashion Production");
    await handleCommandMenuReply("skip");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Summarise the supplied trend evidence.");
    await handleCommandMenuReply("2"); // save it
    clearWorkers();

    startRunMenu();
    await handleCommandMenuReply("1");
    const stopped = await handleCommandMenuReply("2");
    expect(stopped?.[0].label).toBe("Nothing started");
    expect(stopped?.[0].body).toContain("/staff");
    expect(isCommandMenuActive()).toBe(false);
  });
});

describe("guided /start-functions confirmation", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });

  it("asks for the go-ahead the --ready flag stood for", () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    const start = startFunctionsMenu();
    expect(start[0].label).toBe("Start everything that is ready?");
    expect(start[0].body).toContain("1. Yes, start them");
    expect(start[0].body).not.toContain("--ready");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("starts nothing when the operator declines", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startFunctionsMenu();
    const declined = await handleCommandMenuReply("2");
    expect(declined?.[0].label).toBe("Nothing started");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("re-asks on anything that is not a yes or a no", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startFunctionsMenu();
    const again = await handleCommandMenuReply("maybe");
    expect(again?.[0].label).toBe("Start everything that is ready?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("asks which business first when there is more than one", async () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });

    const start = startFunctionsMenu();
    expect(start[0].label).toBe("Which business?");
    expect(start[0].body).toContain("3. All of them");

    const confirm = await handleCommandMenuReply("2");
    expect(confirm?.[0].body).toContain("Second Co");
  });
});
