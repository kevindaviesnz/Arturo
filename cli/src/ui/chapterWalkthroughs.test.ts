import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as llmClient from "../llm/llmClient";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByIdOrLabel,
} from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearWorkers, listWorkers } from "../control/workers";
import {
  clearEnterprises,
  getEnterpriseByIdOrName,
  listEnterprises,
} from "../enterprise/enterpriseStore";
import {
  clearJobCompletionEventRules,
  listJobCompletionEventRules,
} from "../events/jobCompletionEventRuleStore";
import {
  clearOperationalMemory,
  listAllOperationalMemory,
} from "../memory/operationalMemoryStore";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearRuntimeEventStore } from "../runtime/runtimeEventStore";
import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";
import {
  clearCommandMenu,
  handleCommandMenuReply,
  handleUiCommand,
  isCommandMenuActive,
} from "./uiCommandHandlers";
import {
  ensureTestSigner,
} from "../testing/cliTestSetup";

function clearChapterState(): void {
  clearCommandMenu();
  clearJobCompletionEventRules();
  clearOperationalMemory();
  clearJobs();
  clearRuntimeEventStore();
  clearStaffingAssignments();
  clearWorkers();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
}

// A reader follows these chapters at a real terminal. The suite pins isTTY off,
// where a bare /enterprise fails closed to usage text instead of opening the
// menu, so the walkthroughs have to say the session is interactive.
const realIsTTY = process.stdin.isTTY;

beforeEach(() => {
  clearChapterState();
  process.stdin.isTTY = true;
  // Walkthrough tests check menu structure and Event publication, never live
  // model output. Without a stub, a running local Ollama instance causes
  // Event evaluation to block on real inference and time out at 5 seconds.
  vi.spyOn(llmClient, "generateWithConfiguredLlm").mockResolvedValue({
    provider: "ollama",
    model: "test-model",
    response: JSON.stringify({
      shouldCreateJob: false,
      reason: "Test stub: no task needed for menu walkthrough.",
    }),
    routingMode: "local-first",
    escalated: false,
    usedAlias: false,
    externalCallUsed: false,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.stdin.isTTY = realIsTTY;
  clearChapterState();
});

/** Chapter 4's ending state: Product Safety declared, not yet running. */
async function createProductSafety(): Promise<void> {
  await handleUiCommand("/function", []);
  await handleCommandMenuReply("1");
  await handleCommandMenuReply("Product Safety");
  await handleCommandMenuReply(
    "Identify safety questions in supplied toy information and keep release decisions under Human control."
  );
  await handleCommandMenuReply("skip");
}

/** Chapter 3's ending state, which Chapter 4 begins from. */
async function createEthicalToys(): Promise<void> {
  await handleUiCommand("/setup", []);
  await handleCommandMenuReply("Ethical Toys");
  await handleCommandMenuReply(
    "Help families choose safe and responsibly made toys."
  );
  // The name and mission are already saved. Pause before step 2 (Functions).
  await handleCommandMenuReply("q");
}

/**
 * Chapters 3 and 4 teach the guided menus, because that is what an operator
 * uses. Prose can drift from a menu silently: both chapters shipped for a long
 * time teaching --switch forms the menus had replaced.
 *
 * These walk the exact answers each chapter prints. A renumbered option or a
 * removed question fails here rather than in front of a first-time reader.
 */
describe("Chapter 3 walkthrough", () => {
  it("creates Ethical Toys from the answers the chapter gives", async () => {
    const start = await handleUiCommand(
      "/setup",
      []
    );

    // The chapter starts with /setup (or /enterprise, the same flow).
    expect(start[0].label).toBe("Step 1 of 4");
    expect(start[0].body.replace(/\s+/g, " ")).toContain(
      "What is the business called?"
    );
    expect(isCommandMenuActive()).toBe(true);

    const missionAsk = await handleCommandMenuReply(
      "Ethical Toys"
    );
    expect(missionAsk?.[0].label).toBe("Step 1 of 4");
    expect((missionAsk?.[0].body ?? "").replace(/\s+/g, " ")).toContain(
      "what does Ethical Toys exist to do?"
    );
    // Nothing is written until the mission is answered.
    expect(listEnterprises()).toHaveLength(0);

    const whoAsk = await handleCommandMenuReply(
      "Help families choose safe and responsibly made toys."
    );
    expect(whoAsk?.[0].label).toBe("Step 1 of 4");
    expect((whoAsk?.[0].body ?? "").replace(/\s+/g, " ")).toContain(
      "What should Arturo call you?"
    );

    const [enterprise] = listEnterprises();
    expect(enterprise.name).toBe("Ethical Toys");
    expect(enterprise.mission).toContain(
      "responsibly made toys"
    );

    // The chapter says to type q here and leave Functions for later.
    await handleCommandMenuReply("q");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("lists the Enterprise with /enterprise list", async () => {
    await createEthicalToys();

    const listed = await handleUiCommand("/enterprise", ["list"]);

    expect(isCommandMenuActive()).toBe(false);
    expect(JSON.stringify(listed)).toContain(
      "Ethical Toys"
    );
  });

  it("shows the one Enterprise straight away with /enterprise inspect", async () => {
    await createEthicalToys();

    const inspected = await handleUiCommand("/enterprise", ["inspect"]);

    // The chapter says a single business is shown without a further question.
    expect(isCommandMenuActive()).toBe(false);
    expect(JSON.stringify(inspected)).toContain(
      "Ethical Toys"
    );
  });
});

describe("Chapter 4 walkthrough", () => {
  it("creates Product Safety from the answers the chapter gives", async () => {
    await createEthicalToys();

    const menu = await handleUiCommand(
      "/function",
      []
    );

    // The chapter reproduces this list, and tells the reader to answer 1.
    expect(menu[0].body).toContain(
      "1. Add a new Function"
    );
    expect(menu[0].body).toContain(
      "2. Start one running"
    );
    expect(menu[0].body).toContain(
      "3. Look at a Function you've set up"
    );
    expect(menu[0].body).toContain(
      "4. Change a Function's details"
    );
    expect(menu[0].body).toContain(
      "5. See all your Functions"
    );
    expect(isCommandMenuActive()).toBe(true);

    const nameAsk = await handleCommandMenuReply("1");
    expect(nameAsk?.[0].label).toBe("Name (eg 'Accounts', 'Product marketing'):");

    const objectiveAsk = await handleCommandMenuReply(
      "Product Safety"
    );
    expect(objectiveAsk?.[0].label).toBe("Objective:");

    const descriptionAsk = await handleCommandMenuReply(
      "Identify safety questions in supplied toy information and keep release decisions under Human control."
    );
    expect(descriptionAsk?.[0].label).toBe("Description:");

    await handleCommandMenuReply(
      "Reviews supplied toy information, identifies missing safety evidence, and sends important release decisions to a Human."
    );

    // The chapter says Arturo does not ask which business it belongs to,
    // because Ethical Toys is the only one. A fourth question here would
    // leave the reader's next line answering the wrong prompt.
    expect(isCommandMenuActive()).toBe(false);

    const definition =
      getBusinessFunctionDefinitionByIdOrLabel(
        "Product Safety"
      );
    expect(definition?.enterpriseId).toBe(
      getEnterpriseByIdOrName("Ethical Toys")?.id
    );
    // The chapter tells the reader to check for status "declared".
    expect(definition?.status).toBe("declared");
    expect(definition?.objective).toContain(
      "under Human control"
    );
    expect(definition?.description).toContain(
      "missing safety evidence"
    );
  });

  it("lists Product Safety without an --enterprise switch", async () => {
    await createEthicalToys();
    await createProductSafety();

    // The chapter now says "/function list", not the --enterprise form.
    const listed = await handleUiCommand(
      "/function",
      ["list"]
    );
    expect(JSON.stringify(listed)).toContain(
      "Product Safety"
    );
  });
});

/**
 * Chapter 6 asks for a Task before staff are in place, and the refusal it gets
 * back is the whole lesson of the chapter. If that message ever softens into
 * creating the Task anyway, the chapter stops making sense.
 */
describe("Chapter 6 walkthrough", () => {
  it("refuses the Task outright when the Enterprise has no Workers", async () => {
    await createEthicalToys();
    await createProductSafety();
    await handleUiCommand("/function", []);
    await handleCommandMenuReply("2");

    await handleUiCommand("/task", []);
    await handleCommandMenuReply("1");
    await handleCommandMenuReply(
      "Using only this description — a soft fabric activity cube for children aged three and over — list three safety questions that need evidence before a Human release decision."
    );
    const refused = await handleCommandMenuReply("1");

    // The chapter quotes the staff-check refusal, so both lines are pinned.
    expect(refused?.[0].label).toBe("Refused");
    expect(refused?.[0].body).toContain(
      "Product Safety needs an AI worker and someone who can sign off."
    );
    expect(refused?.[0].body).toContain(
      "Nothing was created and no AI was asked."
    );
    expect(listJobs()).toHaveLength(0);
  });
});

describe("Chapter 7 walkthrough", () => {
  /** Chapter 5's ending state: Product Safety running. */
  async function startProductSafety(): Promise<void> {
    await createEthicalToys();
    await createProductSafety();
    await handleUiCommand("/function", []);
    await handleCommandMenuReply("2");
  }

  it("adds Product Safety Worker from the two guided questions", async () => {
    await startProductSafety();

    const nameAsk = await handleUiCommand(
      "/add-ai-worker",
      []
    );
    expect(nameAsk[0].body).toContain(
      "What should this AI Worker be called?"
    );

    const roleAsk = await handleCommandMenuReply(
      "Product Safety Worker"
    );
    expect(roleAsk?.[0].body).toContain(
      'What should "Product Safety Worker" do?'
    );

    // The chapter says to pick "the number beside guardian" rather than a
    // fixed number, because the role list is generated and can be reordered.
    const guardianLine = roleAsk?.[0].body
      .split("\n")
      .find((line) => line.includes("guardian"));
    expect(guardianLine).toBeDefined();
    const guardianNumber =
      /^\s*(\d+)\./.exec(
        guardianLine ?? ""
      )?.[1];
    expect(guardianNumber).toBeDefined();

    await handleCommandMenuReply(
      guardianNumber ?? ""
    );
    expect(isCommandMenuActive()).toBe(false);

    const worker = listWorkers().find(
      (candidate) =>
        candidate.name === "Product Safety Worker"
    );
    expect(worker?.archetype).toBe("guardian");
  });

  /** Chapter 7 step 2, with guardian's number re-derived from the list. */
  async function addProductSafetyWorker(): Promise<void> {
    await handleUiCommand("/add-ai-worker", []);
    const roleAsk = await handleCommandMenuReply(
      "Product Safety Worker"
    );
    const guardianNumber =
      /^\s*(\d+)\./.exec(
        roleAsk?.[0].body
          .split("\n")
          .find((line) => line.includes("guardian")) ?? ""
      )?.[1] ?? "";
    await handleCommandMenuReply(guardianNumber);
  }

  it("refuses the Task, naming /staff, when the Worker is only registered", async () => {
    await startProductSafety();
    await addProductSafetyWorker();

    // Chapter 7 section 4 makes the point that registering a Worker is not
    // enough: the reader tries again and is refused by the staff check, which
    // is what the staff step or /staff then fixes (a signer and an assigned
    // AI worker).
    await handleUiCommand("/task", []);
    await handleCommandMenuReply("1");
    await handleCommandMenuReply(
      "List three safety questions for a soft fabric activity cube."
    );
    const refused = await handleCommandMenuReply("1");

    expect(refused?.[0].label).toBe("Refused");
    expect(refused?.[0].body).toContain(
      "Product Safety needs an AI worker and someone who can sign off."
    );
    expect(refused?.[0].body).toContain(
      "Nothing was created and no AI was asked."
    );
    expect(listJobs()).toHaveLength(0);
  });

  it("creates the bounded Task once the Function is staffed", async () => {
    await startProductSafety();
    await addProductSafetyWorker();
    ensureTestSigner({ enterpriseId: getEnterpriseByIdOrName("Ethical Toys")!.id });

    // What /staff persists. The command itself asks a model for the proposal,
    // so the chapter tells the reader the wording will vary; the assignment
    // it writes is the part the next step depends on.
    const definition =
      getBusinessFunctionDefinitionByIdOrLabel(
        "Product Safety"
      );
    saveStaffingAssignment({
      businessFunctionId: definition?.id ?? "",
      workerName: "Product Safety Worker",
      role: "ai",
      rationale: "Accepted from the /staff proposal.",
    });

    const menu = await handleUiCommand(
      "/task",
      []
    );
    expect(menu[0].body).toContain(
      "1. Create a task"
    );

    const requestAsk = await handleCommandMenuReply("1");
    expect(requestAsk?.[0].label).toBe("Description:");

    const evidenceAsk = await handleCommandMenuReply(
      "Using only this description — a soft fabric activity cube for children aged three and over — list three safety questions that need evidence before a Human release decision. Do not claim testing, certification, or legal compliance."
    );
    // The chapter names this answer in words, not by number.
    expect(evidenceAsk?.[0].body).toContain(
      "No, it has everything it needs"
    );

    const noneNumber =
      /^\s*(\d+)\./.exec(
        evidenceAsk?.[0].body
          .split("\n")
          .find((line) =>
            line.includes("No, it has everything it needs")
          ) ?? ""
      )?.[1] ?? "";
    await handleCommandMenuReply(noneNumber);

    // Start a task now asks for a work type, then a go-ahead, before anything
    // is created. Nothing is pre-selected.
    const typeAsk = await handleCommandMenuReply("");
    expect((typeAsk?.[0].body ?? "").replace(/\s+/g, " ")).toContain("What kind of work is this?");
    const goAhead = await handleCommandMenuReply("1");
    expect((goAhead?.[0].body ?? "").replace(/\s+/g, " ")).toContain("Work type:");
    await handleCommandMenuReply("1");

    expect(isCommandMenuActive()).toBe(false);
    expect(listJobs().length).toBeGreaterThan(0);
  });
});

describe("Chapter 5 walkthrough", () => {
  it("starts Product Safety from menu choice 2", async () => {
    await createEthicalToys();
    await createProductSafety();

    expect(
      getBusinessFunctionDefinitionByIdOrLabel(
        "Product Safety"
      )?.status
    ).toBe("declared");

    await handleUiCommand("/function", []);
    // Product Safety is the only Function, so the chapter says Arturo starts
    // it without asking which one.
    await handleCommandMenuReply("2");
    expect(isCommandMenuActive()).toBe(false);

    const definition =
      getBusinessFunctionDefinitionByIdOrLabel(
        "Product Safety"
      );
    expect(definition?.status).toBe("active");
    expect(definition?.runtimeId).toBeDefined();
  });

  it("publishes an Event from the /event menu", async () => {
    await createEthicalToys();
    await createProductSafety();
    await handleUiCommand("/function", []);
    await handleCommandMenuReply("2");

    const menu = await handleUiCommand(
      "/event",
      []
    );
    expect(menu[0].body).toContain(
      "1. Announce that something has happened"
    );

    const ask = await handleCommandMenuReply("1");
    // "What should the announcement be called?" read as a request for a title,
    // and its examples for a slug. The chapter prints this wording.
    expect(ask?.[0].body).toContain(
      "Describe the event."
    );

    await handleCommandMenuReply(
      "New fabric activity cube submitted for safety review"
    );

    // One Function, so no "which Function is this about?" question.
    expect(isCommandMenuActive()).toBe(false);

    const timeline = await handleUiCommand(
      "/timeline",
      []
    );
    const shown = JSON.stringify(timeline);
    expect(shown).toContain(
      "New fabric activity cube submitted for safety review"
    );
    // The heading used to be built from the operator's own label.
    expect(shown).not.toContain(
      "Business new fabric"
    );
  });
});

describe("Chapter 8 walkthrough", () => {
  /** Chapter 4's ending state, which Chapter 8 begins from. */
  async function ethicalToysWithProductSafety(): Promise<void> {
    await createEthicalToys();
    await createProductSafety();
  }

  it("writes, reads back, and removes a note using only the menu", async () => {
    await ethicalToysWithProductSafety();

    const menu = await handleUiCommand("/memory", []);
    // The chapter reproduces these three options.
    expect(menu[0].body).toContain("1. Write a note down");
    expect(menu[0].body).toContain("2. Show me everything in memory");
    expect(menu[0].body).toContain("3. Remove a note");

    const textAsk = await handleCommandMenuReply("1");
    expect(textAsk?.[0].body).toContain(
      "What should Arturo remember?"
    );

    const scopeAsk = await handleCommandMenuReply(
      "Ethical Toys uses example product descriptions in this teaching exercise."
    );
    expect(scopeAsk?.[0].body).toContain(
      "Which work should this note be used for?"
    );

    // The chapter names both rows in words rather than by number, because the
    // list is built from whatever Functions and businesses exist.
    expect(scopeAsk?.[0].body).toContain(
      "Ethical Toys — everything this business does"
    );
    expect(scopeAsk?.[0].body).toContain(
      "Product Safety — only this Function's work"
    );

    const enterpriseRow =
      /^\s*(\d+)\./.exec(
        scopeAsk?.[0].body
          .split("\n")
          .find((line) =>
            line.includes("Ethical Toys — everything this business does")
          ) ?? ""
      )?.[1] ?? "";
    await handleCommandMenuReply(enterpriseRow);
    expect(isCommandMenuActive()).toBe(false);
    expect(listAllOperationalMemory()).toHaveLength(1);

    // Answer 2 must show the note itself, not the menu again.
    await handleUiCommand("/memory", []);
    const shown = await handleCommandMenuReply("2");
    expect(JSON.stringify(shown)).toContain(
      "example product descriptions"
    );

    // The chapter promises removal picks from a list rather than needing an ID.
    await handleUiCommand("/memory", []);
    const removePick = await handleCommandMenuReply("3");
    expect(removePick?.[0].body).toContain(
      "example product descriptions"
    );

    await handleCommandMenuReply("1");
    expect(listAllOperationalMemory()).toHaveLength(0);
  });

  it("files a note against one Function when that row is chosen", async () => {
    await ethicalToysWithProductSafety();

    await handleUiCommand("/memory", []);
    await handleCommandMenuReply("1");
    const scopeAsk = await handleCommandMenuReply(
      "Product Safety reviews must separate supplied facts from missing evidence."
    );

    const functionRow =
      /^\s*(\d+)\./.exec(
        scopeAsk?.[0].body
          .split("\n")
          .find((line) =>
            line.includes("Product Safety — only this Function's work")
          ) ?? ""
      )?.[1] ?? "";
    await handleCommandMenuReply(functionRow);

    const [entry] = listAllOperationalMemory();
    expect(entry.content).toContain("supplied facts");
    // Scope is what the chapter says decides who later reads it.
    expect(JSON.stringify(entry)).toContain("Product Safety");
  });
});

describe("Chapter 10 walkthrough", () => {
  it("answers a bare /health directly when there is one Function", async () => {
    await createEthicalToys();
    await createProductSafety();

    const [entry] = await handleUiCommand("/health", []);

    // Bare /health used to print usage text, alone among the commands the
    // manual teaches from a menu.
    expect(entry.label).not.toBe("Usage");
    expect(JSON.stringify(entry)).toContain("Product Safety");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks which Function once there is more than one", async () => {
    await createEthicalToys();
    await createProductSafety();

    const enterprise = getEnterpriseByIdOrName("Ethical Toys");
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise?.id}:evidence-gathering`,
      enterpriseId: enterprise?.id ?? "",
      label: "Evidence Gathering",
      objective: "Collect the evidence safety reviews ask for.",
    });

    const asked = await handleUiCommand("/health", []);
    expect(asked[0].label).toBe("Which Function's health?");
    expect(asked[0].body).toContain("Product Safety");
    expect(asked[0].body).toContain("Evidence Gathering");

    // The chapter tells the reader to pick the Function, so a name works too.
    const health = await handleCommandMenuReply("Product Safety");
    expect(JSON.stringify(health)).toContain("Product Safety");
    expect(isCommandMenuActive()).toBe(false);
  });
});

describe("Chapter 9 walkthrough", () => {
  /** Chapter 7's ending state: Product Safety running. */
  async function runningProductSafety(): Promise<void> {
    await createEthicalToys();
    await createProductSafety();
    await handleUiCommand("/function", []);
    await handleCommandMenuReply("2");
  }

  it("publishes an Event from the two answers the chapter gives", async () => {
    await runningProductSafety();

    const menu = await handleUiCommand("/event", []);
    // The chapter reproduces all four options.
    expect(menu[0].body).toContain(
      "1. Announce that something has happened"
    );
    expect(menu[0].body).toContain(
      "2. Announce it automatically whenever work finishes"
    );
    expect(menu[0].body).toContain(
      "3. See the automatic announcements"
    );
    expect(menu[0].body).toContain(
      "4. Stop an automatic announcement"
    );

    const describeAsk = await handleCommandMenuReply("1");
    expect(describeAsk?.[0].body).toContain("Describe the event.");

    // One Function, so the chapter says Arturo publishes without asking which.
    await handleCommandMenuReply(
      "A revised fabric activity cube was submitted for safety review"
    );
    expect(isCommandMenuActive()).toBe(false);
  });

  it("saves an automatic announcement without publishing it yet", async () => {
    await runningProductSafety();

    await handleUiCommand("/event", []);
    const announceAsk = await handleCommandMenuReply("2");

    // With one Function the "whose work?" question is skipped, exactly as the
    // publish flow skips it, so the chapter's second row is what appears.
    expect(announceAsk?.[0].body).toContain(
      "When Product Safety finishes a piece of work, what should Arturo announce?"
    );

    // A third question the chapter has to print, or the reader's next line
    // answers a prompt they were never shown.
    const scopeAsk = await handleCommandMenuReply("safety review finished");
    expect(scopeAsk?.[0].body).toContain(
      "Should this fire for every finished task, or only some kinds?"
    );
    expect(scopeAsk?.[0].body).toContain("1. Every finished task");

    await handleCommandMenuReply("1");
    expect(isCommandMenuActive()).toBe(false);

    // The chapter is explicit that saving a rule publishes nothing.
    const rules = listJobCompletionEventRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].publishedEventLabel).toContain(
      "safety review finished"
    );
  });

  it("lists the saved rule under 3", async () => {
    await runningProductSafety();
    await handleUiCommand("/event", []);
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("safety review finished");
    await handleCommandMenuReply("1");

    await handleUiCommand("/event", []);
    const listed = await handleCommandMenuReply("3");

    expect(JSON.stringify(listed)).toContain(
      "safety review finished"
    );
  });
});
