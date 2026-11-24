import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  handleUiCommand,
  clearCommandMenu,
  handleCommandMenuReply,
  isCommandMenuActive,
  startAiWorkerAdd,
  startArtefactAdd,
  startEnterpriseMenu,
  startFunctionMenu,
  startRefineWorker,
  startScheduleMenu,
  startSuggestMenu,
  startTaskMenu,
  stripSurroundingQuotes,
} from "./uiCommandHandlers";

import {
  suggestFunctionChoices,
} from "./uiSuggestEntries";

import {
  getWorker,
} from "../control/workers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  clearJobs,
  enqueueJob,
  listJobs,
} from "../runtime/jobQueue";

import {
  clearHumanTasks,
  completeHumanTask,
  createHumanTask,
} from "../runtime/humanTaskStore";

import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  ensureTestSigner,
} from "../testing/cliTestSetup";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

describe("interactive /enterprise and /function menus", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearJobs();
    clearStaffingAssignments();
    clearWorkers();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearJobs();
    clearStaffingAssignments();
    clearWorkers();
  });

  /** Sets up an Enterprise + Function staffed by one capable AI Worker. */

  function seedStaffedFunctionWithSigner(): { enterpriseId: string; functionId: string } {
    const seeded = seedStaffedFunction();
    ensureTestSigner({ enterpriseId: seeded.enterpriseId });
    return seeded;
  }

  function seedStaffedFunction(): { enterpriseId: string; functionId: string } {
    const enterprise = createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:enquiries`,
      enterpriseId: enterprise.id,
      label: "Customer Enquiries",
      objective: "Answer customer questions.",
    });
    addWorker({
      name: "Enquiry Assistant",
      kind: "ai",
      capabilities: ["llm", "writing", "human-contact"],
      run: function* (input: unknown) {
        return input;
      },
    });
    saveStaffingAssignment({
      businessFunctionId: definition.id,
      workerName: "Enquiry Assistant",
      role: "ai",
      rationale: "For this test.",
    });
    return { enterpriseId: enterprise.id, functionId: definition.id };
  }

  it("offers set-up / talk-it-through / look-at / list without any switches", () => {
    const entry = startEnterpriseMenu();
    expect(entry[0].label).toBe("Please select an option:");
    expect(entry[0].body).toContain("1. Set up a new business");
    expect(entry[0].body).toContain("2. Talk it through with Arturo");
    expect(entry[0].body).toContain("3. Look at a business");
    expect(entry[0].body).toContain("4. Change a business's details");
    expect(entry[0].body).toContain("5. See all your businesses");
    expect(entry[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("sets a business up from a name and a sentence, with no model call", async () => {
    startEnterpriseMenu();

    const nameAsk = await handleCommandMenuReply("1");
    expect(nameAsk?.[0].label).toBe("Name:");

    const missionAsk = await handleCommandMenuReply("BrightSky Solar");
    expect(missionAsk?.[0].label).toBe("Mission:");

    const descriptionAsk = await handleCommandMenuReply(
      "Help homeowners make good decisions about residential solar."
    );
    expect(descriptionAsk?.[0].label).toBe("Description:");

    const done = await handleCommandMenuReply(
      "Independent, no installer referrals, and always names what it cannot verify."
    );
    expect(isCommandMenuActive()).toBe(false);
    expect(JSON.stringify(done)).toContain("BrightSky Solar");

    const [enterprise] = listEnterprises();
    expect(enterprise.name).toBe("BrightSky Solar");
    expect(enterprise.mission).toContain("residential solar");
    expect(enterprise.description).toContain("no installer referrals");
  });

  it("lets the operator skip the description", async () => {
    startEnterpriseMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("BrightSky Solar");
    await handleCommandMenuReply("Help homeowners with solar.");
    const done = await handleCommandMenuReply("skip");

    expect(JSON.stringify(done)).toContain("BrightSky Solar");
    expect(isCommandMenuActive()).toBe(false);
    expect(listEnterprises()[0].description ?? "").toBe("");
  });

  it("strips quotes typed at the business name prompt", async () => {
    startEnterpriseMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply('"BrightSky Solar"');
    await handleCommandMenuReply("Help homeowners with solar.");
    await handleCommandMenuReply("skip");
    expect(listEnterprises()[0].name).toBe("BrightSky Solar");
  });

  it("lists businesses when the operator picks 5", async () => {
    createAndSaveEnterprise({ name: "Sal's Street Eats", mission: "Tacos." });
    startEnterpriseMenu();
    const result = await handleCommandMenuReply("5");
    expect(result?.[0].label).toBe("Enterprises");
    expect(result?.[0].body).toContain("Sal's Street Eats");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("tells the operator to set one up first when looking at a business with none", async () => {
    startEnterpriseMenu();
    const result = await handleCommandMenuReply("3");
    expect(result?.[0].label).toBe("No businesses yet");
    expect(result?.[0].body).toContain("choose 1");
  });

  it("inspects the only business directly when picking 3", async () => {
    createAndSaveEnterprise({ name: "Waggy Tails", mission: "Grooming." });
    startEnterpriseMenu();
    const result = await handleCommandMenuReply("3");
    // handleUiEnterpriseInspectSubcommand renders the enterprise detail.
    expect(JSON.stringify(result)).toContain("Waggy Tails");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks which business when there is more than one, then inspects the pick", async () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });
    startEnterpriseMenu();

    const pick = await handleCommandMenuReply("3");
    expect(pick?.[0].body).toContain("1. First Co");
    expect(pick?.[0].body).toContain("2. Second Co");
    expect(isCommandMenuActive()).toBe(true);

    const inspected = await handleCommandMenuReply("2");
    expect(JSON.stringify(inspected)).toContain("Second Co");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("changes a business's mission by number, with no switch", async () => {
    createAndSaveEnterprise({ name: "Waggy Tails", mission: "Grooming." });
    startEnterpriseMenu();

    const fieldAsk = await handleCommandMenuReply("4");
    expect(fieldAsk?.[0].label).toBe("Change Waggy Tails");
    expect(fieldAsk?.[0].body).toContain("1. What it does (its mission)");
    expect(fieldAsk?.[0].body).not.toContain("--mission");

    const valueAsk = await handleCommandMenuReply("1");
    expect(valueAsk?.[0].label).toBe("Mission:");

    await handleCommandMenuReply("Groom dogs and cats for local owners.");
    expect(isCommandMenuActive()).toBe(false);
    expect(listEnterprises()[0].mission).toContain("Groom dogs and cats");
  });

  it("renames a business without detaching its Functions", async () => {
    const enterprise =
      createAndSaveEnterprise({ name: "Waggy Tails", mission: "Grooming." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:grooming`,
      enterpriseId: enterprise.id,
      label: "Grooming Bookings",
      objective: "Book grooming appointments.",
    });

    startEnterpriseMenu();
    await handleCommandMenuReply("4");
    await handleCommandMenuReply("3"); // its name
    await handleCommandMenuReply("Waggy Tails Grooming");

    expect(listEnterprises()[0].name).toBe("Waggy Tails Grooming");
    expect(listEnterprises()[0].id).toBe(enterprise.id);
  });

  it("changes a Function's objective by number", async () => {
    const enterprise =
      createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:enquiries`,
      enterpriseId: enterprise.id,
      label: "Customer Enquiries",
      objective: "Answer customer questions.",
    });

    startFunctionMenu();
    const fieldAsk = await handleCommandMenuReply("4");
    expect(fieldAsk?.[0].label).toBe("Change Customer Enquiries");
    expect(fieldAsk?.[0].body).not.toContain("--objective");

    const valueAsk = await handleCommandMenuReply("1");
    expect(valueAsk?.[0].label).toBe("What should it keep doing?");

    const done = await handleCommandMenuReply("Answer billing questions within one working day.");
    expect(isCommandMenuActive()).toBe(false);
    expect(JSON.stringify(done)).toContain("billing questions");
  });

  it("says there is nothing to change when no Function exists", async () => {
    startFunctionMenu();
    const none = await handleCommandMenuReply("4");
    expect(none?.[0].label).toBe("No Functions yet");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("still lists Functions, now under 5", async () => {
    const enterprise =
      createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:enquiries`,
      enterpriseId: enterprise.id,
      label: "Customer Enquiries",
      objective: "Answer customer questions.",
    });

    startFunctionMenu();
    const listed = await handleCommandMenuReply("5");
    expect(JSON.stringify(listed)).toContain("Customer Enquiries");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("starts a Function from choice 2, the step after adding one", async () => {
    const enterprise =
      createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:enquiries`,
      enterpriseId: enterprise.id,
      label: "Customer Enquiries",
      objective: "Answer customer questions.",
    });

    startFunctionMenu();
    await handleCommandMenuReply("2");

    expect(isCommandMenuActive()).toBe(false);
    expect(
      getBusinessFunctionDefinitionByIdOrLabel(
        "Customer Enquiries"
      )?.status
    ).toBe("active");
  });

  it("guides a Function through name then objective, then creates it", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startFunctionMenu();

    const nameAsk = await handleCommandMenuReply("1");
    expect(nameAsk?.[0].label).toBe("Name (eg 'Accounts', 'Product marketing'):");

    const objAsk = await handleCommandMenuReply("Customer Enquiries");
    expect(objAsk?.[0].label).toBe("Objective:");

    const descriptionAsk = await handleCommandMenuReply("Reply to customer questions.");
    expect(descriptionAsk?.[0].label).toBe("Description:");

    const done = await handleCommandMenuReply("skip");
    expect(done?.[0].label).toBe("Function created");
    expect(done?.[0].body).toContain("Customer Enquiries");
    // The created block no longer prints the fields, so the answers are
    // checked where they were stored.
    const [definition] = listBusinessFunctionDefinitions();
    expect(definition.label).toBe("Customer Enquiries");
    expect(definition.objective).toBe("Reply to customer questions.");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("lets the operator skip the Function objective", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startFunctionMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Weekly Report");
    await handleCommandMenuReply("skip"); // objective
    const done = await handleCommandMenuReply("skip"); // description
    expect(done?.[0].label).toBe("Function created");
  });

  // The Description prompts are bare labels now — nothing on screen offers
  // "skip". Enter on its own has to be the way past, or the flow traps the
  // operator with ESC (which discards every answer) as the only exit.
  it("takes Enter on its own as leaving the Enterprise description blank", async () => {
    startEnterpriseMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("BrightSky Solar");
    await handleCommandMenuReply("Fit rooftop solar.");
    const done = await handleCommandMenuReply("");

    expect(done?.[0].label).toBe("Enterprise created");
    expect(isCommandMenuActive()).toBe(false);
    const [enterprise] = listEnterprises();
    expect(enterprise.description ?? "").toBe("");
  });

  it("takes Enter on its own as leaving the Function description blank", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startFunctionMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Weekly Report");
    await handleCommandMenuReply("Summarise the week.");
    const done = await handleCommandMenuReply("");

    expect(done?.[0].label).toBe("Function created");
    expect(isCommandMenuActive()).toBe(false);
    const [definition] = listBusinessFunctionDefinitions();
    expect(definition.description ?? "").toBe("");
  });

  // "Description:" is the label on two optional fields moments earlier, so an
  // operator can reasonably try the word here. Taken literally it would queue
  // a Task whose whole instruction is "skip".
  it("refuses skip as a Task description", async () => {
    startTaskMenu();
    await handleCommandMenuReply("1");
    const again = await handleCommandMenuReply("skip");

    expect(again?.[0].label).toBe("Description:");
    expect(again?.[0].body).toContain("cannot be skipped");
    expect(isCommandMenuActive()).toBe(true);
  });

  /**
   * The Sensor pattern: a person is the instrument and the AI reasons about
   * what they found. Blueprint 3's header claimed the AI was "given the
   * person's findings verbatim" while the plan had the operator retyping every
   * measurement into the instruction — so a slip in the retyping was theirs,
   * and invisible.
   */
  it("offers a completed Human Task as work to continue from", async () => {
    seedStaffedFunctionWithSigner();
    clearHumanTasks();
    const inspection = createHumanTask({
      title: "Inspect the violin",
      instructions: "Measure the back and note repairs.",
    });
    completeHumanTask(
      inspection.id,
      "Back length 356mm. Old repaired crack, stable.",
      "Workshop Luthier"
    );

    startTaskMenu();
    await handleCommandMenuReply("1");
    const evidence = await handleCommandMenuReply(
      "Say what these findings mean for value."
    );

    expect(evidence?.[0].label).toBe("Does this task need anything else?");
    expect(evidence?.[0].body).toContain("Continue from work that's already finished");

    const picker = await handleCommandMenuReply("2");
    expect(picker?.[0].label).toBe("Which finished work should it continue from?");
    expect(picker?.[0].body).toContain("what a person found");
    expect(picker?.[0].body).toContain(inspection.id);

    const created = await handleCommandMenuReply("1");
    expect(created?.[0].label).toBe("Task created");

    const [job] = listJobs();
    expect(job.sourceHumanTaskId).toBe(inspection.id);
    expect(job.sourceTaskId).toBeUndefined();
  });

  // Nothing in it for a Worker to work from, so offering it would produce a
  // Task that reports having been given nothing.
  it("leaves out a Human Task completed without notes", async () => {
    seedStaffedFunction();
    clearHumanTasks();
    const inspection = createHumanTask({
      title: "Look at it",
      instructions: "Have a look.",
    });
    completeHumanTask(inspection.id, "", "Workshop Luthier");

    startTaskMenu();
    await handleCommandMenuReply("1");
    const evidence = await handleCommandMenuReply("Reason about it.");

    expect(evidence?.[0].body).not.toContain("Continue from work that's already finished");
  });

  it("re-asks on an out-of-range number rather than doing the wrong thing", async () => {
    startEnterpriseMenu();
    const again = await handleCommandMenuReply("9");
    expect(again?.[0].body).toContain("Please reply 1, 2, 3, 4, or 5");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("cancels cleanly", async () => {
    startFunctionMenu();
    const cancelled = await handleCommandMenuReply("cancel");
    expect(cancelled?.[0].label).toBe("Cancelled");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("creates a task from a plain description, no switches", async () => {
    seedStaffedFunctionWithSigner();
    startTaskMenu();

    const ask = await handleCommandMenuReply("1");
    expect(ask?.[0].label).toBe("Description:");
    expect(ask?.[0].body).not.toContain("--");

    // Only one Function, so it's inferred — straight to what it works from.
    const evidenceAsk = await handleCommandMenuReply("Draft a welcome email for a new customer.");
    expect(evidenceAsk?.[0].label).toBe("Does this task need anything else?");
    expect(evidenceAsk?.[0].body).not.toContain("--");

    const done = await handleCommandMenuReply("1"); // nothing to work from
    expect(done?.[0].label).toBe("Task created");
    expect(done?.[0].body).toContain("task queued");
    expect(done?.[0].body).toContain("Customer Enquiries");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks which Function for a task when there is more than one", async () => {
    const { enterpriseId } = seedStaffedFunction();
    createAndSaveBusinessFunctionDefinition({
      id: `${enterpriseId}:reporting`,
      enterpriseId,
      label: "Weekly Reporting",
      objective: "Report weekly.",
    });
    startTaskMenu();
    await handleCommandMenuReply("1");
    const pick = await handleCommandMenuReply("Do something");
    expect(pick?.[0].body).toContain("Customer Enquiries");
    expect(pick?.[0].body).toContain("Weekly Reporting");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("offers a web search instead of a --search-query switch", async () => {
    seedStaffedFunctionWithSigner();
    startTaskMenu();
    await handleCommandMenuReply("1");
    const evidenceAsk = await handleCommandMenuReply("Find out what competitors charge.");
    expect(evidenceAsk?.[0].body).toContain("Search the public web first");
    // Nothing is attached, so the file option is not offered at all.
    expect(evidenceAsk?.[0].body).not.toContain("Work from a file");

    const queryAsk = await handleCommandMenuReply("2");
    expect(queryAsk?.[0].label).toBe("What should it search for?");
    // The search is still governed; the menu does not promise it will run.
    expect(queryAsk?.[0].body).toContain("authorised");

    // The business has not turned web search on, so the web step is refused before anything is written (W3).
    const done = await handleCommandMenuReply("competitor pricing 2026");
    expect(done?.[0].body).toContain("Web search is off for");
    expect(isCommandMenuActive()).toBe(false);
  });

  /**
   * Options 2 and 3 ran the same code and printed the same list, so the menu
   * offered a choice that was not one — and there was no route from the menu to
   * a single task's full record at all, even though /task inspect exists.
   */
  it("separates looking at one task from listing them all", async () => {
    seedStaffedFunction();
    const first = enqueueJob("Draft a welcome email for a new customer.");
    enqueueJob("Compare two suppliers on price and lead time.");

    startTaskMenu();
    const picker = await handleCommandMenuReply("2");

    expect(picker?.[0].label).toBe("Which task?");
    expect(picker?.[0].body).toContain("Draft a welcome email");
    expect(picker?.[0].body).toContain("Compare two suppliers");

    const detail = await handleCommandMenuReply("1");
    expect(detail?.[0].body).toContain(first.id);
    expect(isCommandMenuActive()).toBe(false);
  });

  it("goes straight to the record when there is only one task", async () => {
    seedStaffedFunction();
    const only = enqueueJob("Draft a welcome email for a new customer.");

    startTaskMenu();
    const detail = await handleCommandMenuReply("2");

    expect(detail?.[0].body).toContain(only.id);
    expect(isCommandMenuActive()).toBe(false);
  });

  it("still lists every task under 3", async () => {
    seedStaffedFunction();
    enqueueJob("Draft a welcome email for a new customer.");
    enqueueJob("Compare two suppliers on price and lead time.");

    startTaskMenu();
    const listed = await handleCommandMenuReply("3");

    expect(listed?.[0].body).toContain("Draft a welcome email");
    expect(listed?.[0].body).toContain("Compare two suppliers");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("says so when there is nothing to look at", async () => {
    seedStaffedFunction();

    startTaskMenu();
    const none = await handleCommandMenuReply("2");

    expect(none?.[0].label).toBe("No tasks yet");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("re-asks the evidence question on an out-of-range number", async () => {
    seedStaffedFunction();
    startTaskMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Do a thing");
    const again = await handleCommandMenuReply("9");
    expect(again?.[0].label).toBe("Does this task need anything else?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("walks a schedule through description, cadence, and time", async () => {
    seedStaffedFunctionWithSigner();
    startScheduleMenu();

    const menu = await handleCommandMenuReply("1");
    expect(menu?.[0].label).toBe("Schedule a task");

    const cadenceAsk = await handleCommandMenuReply("Prepare a weekly summary.");
    expect(cadenceAsk?.[0].body).toContain("Every day");
    expect(cadenceAsk?.[0].body).toContain("Once a week");

    // "Every day" → straight to the time question.
    const timeAsk = await handleCommandMenuReply("1");
    expect(timeAsk?.[0].label).toBe("What time?");

    // One Function → inferred, schedule is created.
    const done = await handleCommandMenuReply("09:00");
    expect(done?.[0].label).toBe("Task schedule added");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks which day for a weekly schedule", async () => {
    seedStaffedFunctionWithSigner();
    startScheduleMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Prepare a weekly summary.");
    const dayAsk = await handleCommandMenuReply("2");
    expect(dayAsk?.[0].label).toBe("Which day?");
    expect(dayAsk?.[0].body).toContain("1. Monday");

    const timeAsk = await handleCommandMenuReply("1"); // Monday
    expect(timeAsk?.[0].label).toBe("What time?");
    const done = await handleCommandMenuReply("09:00");
    expect(done?.[0].label).toBe("Task schedule added");
  });

  it("rejects a bad time and re-asks rather than failing", async () => {
    seedStaffedFunction();
    startScheduleMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Do a thing");
    await handleCommandMenuReply("1");
    const retry = await handleCommandMenuReply("nine o'clock");
    expect(retry?.[0].label).toBe("What time?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("walks the artefact wizard: name, kind, where, worker, then attaches it", async () => {
    seedStaffedFunction(); // gives one Enterprise + one Worker

    const start = startArtefactAdd();
    expect(start[0].label).toBe("Attach a file");

    const kindAsk = await handleCommandMenuReply("Client contract");
    expect(kindAsk?.[0].label).toBe("What kind of file?");
    expect(kindAsk?.[0].body).toContain("evidence");

    const whereAsk = await handleCommandMenuReply("2"); // evidence
    expect(whereAsk?.[0].label).toBe("Where is the file?");

    // A https URL avoids touching the filesystem; one Worker + one Enterprise
    // are inferred, so the only question left is the note.
    const noteAsk = await handleCommandMenuReply("https://example.com/contract.pdf");
    expect(noteAsk?.[0].label).toBe("Anything worth noting about it?");

    const done = await handleCommandMenuReply("skip");
    expect(done?.[0].label).toBe("Artefact");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks who produced the file when there is more than one Worker", async () => {
    seedStaffedFunction();
    addWorker({
      name: "Second Worker",
      kind: "ai",
      capabilities: ["llm"],
      run: function* (input: unknown) {
        return input;
      },
    });
    startArtefactAdd();
    await handleCommandMenuReply("A design");
    await handleCommandMenuReply("1"); // design
    const pick = await handleCommandMenuReply("https://example.com/x.svg");
    expect(pick?.[0].label).toBe("Who produced this file?");
    expect(pick?.[0].body).toContain("Enquiry Assistant");
    expect(pick?.[0].body).toContain("Second Worker");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("adds an AI Worker by name then role, no switches", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });

    const start = startAiWorkerAdd();
    expect(start[0].label).toBe("Add an AI Worker");
    expect(isCommandMenuActive()).toBe(true);

    const roleAsk = await handleCommandMenuReply("Contract Review Specialist");
    expect(roleAsk?.[0].label).toBe("What is its role?");
    expect(roleAsk?.[0].body).toContain("1. ");
    expect(roleAsk?.[0].body).not.toContain("--");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].body).toContain("Contract Review Specialist");
    expect(isCommandMenuActive()).toBe(false);
    expect(getWorker("Contract Review Specialist")).toBeDefined();
  });

  it("strips surrounding quotes typed at the AI Worker name prompt", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });

    startAiWorkerAdd();
    // Every example Arturo prints quotes the name, so users type the quotes too.
    const roleAsk = await handleCommandMenuReply('"Customer Evidence Researcher"');
    expect(roleAsk?.[0].body).toContain('"Customer Evidence Researcher"');
    expect(roleAsk?.[0].body).not.toContain('""');

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].body).toContain("Customer Evidence Researcher");
    expect(getWorker("Customer Evidence Researcher")).toBeDefined();
    expect(getWorker('"Customer Evidence Researcher"')).toBeUndefined();
  });

  it("re-asks the AI Worker role on an out-of-range number", async () => {
    startAiWorkerAdd();
    await handleCommandMenuReply("Helper");
    const again = await handleCommandMenuReply("999");
    expect(again?.[0].label).toBe("What is its role?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("refines a Worker picked from a list", async () => {
    seedStaffedFunction(); // adds the "Enquiry Assistant" AI Worker

    const start = startRefineWorker();
    expect(start[0].label).toBe("Refine a Worker");
    expect(start[0].body).toContain("Enquiry Assistant");
    expect(isCommandMenuActive()).toBe(true);

    // The heading names the Worker the row number selected, so a mis-picked
    // row is visible before a specialisation is written against it.
    const textAsk = await handleCommandMenuReply("1");
    expect(textAsk?.[0].label).toBe("How should Enquiry Assistant specialise?");

    const done = await handleCommandMenuReply("Focus on billing questions and label uncertainty.");
    expect(isCommandMenuActive()).toBe(false);
    expect(getWorker("Enquiry Assistant")?.refinement).toContain("billing questions");
  });

  it("tells the operator there is nothing to refine when no Workers exist", () => {
    const start = startRefineWorker();
    expect(start[0].label).toBe("No Workers yet");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("lists the Function labels /suggest could act on, filtered by Enterprise", () => {
    const { enterpriseId } = seedStaffedFunction(); // "Customer Enquiries"
    createAndSaveBusinessFunctionDefinition({
      id: `${enterpriseId}:reporting`,
      enterpriseId,
      label: "Weekly Reporting",
      objective: "Report weekly.",
    });
    // A Function under a different Enterprise must not leak in.
    const other = createAndSaveEnterprise({ name: "Other Co", mission: "Other." });
    createAndSaveBusinessFunctionDefinition({
      id: `${other.id}:misc`,
      enterpriseId: other.id,
      label: "Misc",
      objective: "Do misc.",
    });

    const all = suggestFunctionChoices(undefined);
    expect(all).toContain("Customer Enquiries");
    expect(all).toContain("Weekly Reporting");
    expect(all).toContain("Misc");

    const scoped = suggestFunctionChoices("Solo Co");
    expect(scoped).toContain("Customer Enquiries");
    expect(scoped).toContain("Weekly Reporting");
    expect(scoped).not.toContain("Misc");
  });

  it("offers a numbered Function pick for /suggest, no copy-paste flags", () => {
    const start = startSuggestMenu(["Client Onboarding", "Coaching Sessions"], undefined);
    expect(start[0].label).toBe("Which Function should Arturo suggest work for?");
    expect(start[0].body).toContain("1. Client Onboarding");
    expect(start[0].body).toContain("2. Coaching Sessions");
    expect(start[0].body).not.toContain("--function");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("re-asks the /suggest pick on an out-of-range number", async () => {
    startSuggestMenu(["Client Onboarding", "Coaching Sessions"], undefined);
    const again = await handleCommandMenuReply("9");
    expect(again?.[0].label).toBe("Which Function?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("passes replies through when no menu is active", async () => {
    expect(await handleCommandMenuReply("anything")).toBeUndefined();
  });
});

describe("stripSurroundingQuotes", () => {
  it("removes one matching pair of double or single quotes", () => {
    expect(stripSurroundingQuotes('"Contract Review Specialist"')).toBe(
      "Contract Review Specialist"
    );
    expect(stripSurroundingQuotes("'Solo Co'")).toBe("Solo Co");
  });

  it("leaves unquoted or mismatched values untouched", () => {
    expect(stripSurroundingQuotes("Customer Education Writer")).toBe(
      "Customer Education Writer"
    );
    // A trailing-only or mismatched quote is not a wrapping pair.
    expect(stripSurroundingQuotes('"unterminated')).toBe('"unterminated');
    expect(stripSurroundingQuotes("\"mixed'")).toBe("\"mixed'");
  });

  it("preserves interior apostrophes", () => {
    expect(stripSurroundingQuotes("O'Brien's Roofing")).toBe(
      "O'Brien's Roofing"
    );
  });
});

/**
 * A partly-specified create used to succeed silently: `/enterprise create
 * "Harbour Youth Trust"` stored a business whose Mission read "(none)", and
 * `/function create "X"` stored a Function with no objective. Both values are
 * the context every Worker is later given, so a blank one quietly degrades
 * everything downstream. Arturo now asks for what was not supplied.
 */
describe("a create that leaves out a value", () => {
  // The prompts are interactive-only: under a pipe or CI, commands must never
  // block waiting for input. Present a TTY so the interactive path is the one
  // under test.
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });

  it("keeps the non-interactive path silent, so scripts never block", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });

    const done = await handleUiCommand("/enterprise", [
      "create",
      "Harbour Youth Trust",
    ]);

    expect(done[0].label).toBe("Enterprise created");
    expect(isCommandMenuActive()).toBe(false);
    expect(listEnterprises()).toHaveLength(1);
  });

  it("asks for the mission when /enterprise create supplies only a name", async () => {
    const asked = await handleUiCommand("/enterprise", [
      "create",
      "Harbour Youth Trust",
    ]);

    expect(asked[0].label).toBe("Mission:");
    expect(asked[0].body).toContain("Harbour Youth Trust");
    expect(isCommandMenuActive()).toBe(true);
    // Nothing is stored until the question is answered.
    expect(listEnterprises()).toHaveLength(0);

    const descriptionAsk = await handleCommandMenuReply(
      "Support young people in the harbour district with training and mentoring."
    );
    expect(descriptionAsk?.[0].label).toBe("Description:");

    const done = await handleCommandMenuReply("skip");
    expect(JSON.stringify(done)).toContain("Harbour Youth Trust");
    expect(listEnterprises()[0].mission).toContain("mentoring");
  });

  it("still creates the business when the operator skips the mission", async () => {
    await handleUiCommand("/enterprise", ["create", "Harbour Youth Trust"]);
    await handleCommandMenuReply("skip"); // mission
    const done = await handleCommandMenuReply("skip"); // description

    expect(JSON.stringify(done)).toContain("Harbour Youth Trust");
    expect(isCommandMenuActive()).toBe(false);
    expect(listEnterprises()).toHaveLength(1);
    expect(listEnterprises()[0].mission ?? "").toBe("");
  });

  it("does not ask when the mission was supplied", async () => {
    const done = await handleUiCommand("/enterprise", [
      "create",
      "Harbour Youth Trust",
      "--mission",
      "Support young people.",
    ]);

    expect(done[0].label).toBe("Enterprise created");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks for the objective when /function create supplies only a name", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });

    const asked = await handleUiCommand("/function", ["create", "Weekly Report"]);
    expect(asked[0].label).toBe("Objective:");
    expect(asked[0].body).toContain("Weekly Report");
    expect(isCommandMenuActive()).toBe(true);
    expect(listBusinessFunctionDefinitions()).toHaveLength(0);

    await handleCommandMenuReply("Publish a weekly summary every Friday.");
    const done = await handleCommandMenuReply("skip");
    expect(done?.[0].label).toBe("Function created");
    expect(listBusinessFunctionDefinitions()[0].objective).toContain("Friday");
  });

  it("asks which business first, by number, when several exist", async () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });

    const asked = await handleUiCommand("/function", ["create", "Weekly Report"]);
    expect(asked[0].label).toBe("Which business is this for?");
    expect(asked[0].body).toContain("1. First Co");
    // The old message told the operator to re-run with --enterprise.
    expect(asked[0].body).not.toContain("--enterprise");

    const objectiveAsk = await handleCommandMenuReply("2");
    expect(objectiveAsk?.[0].label).toBe("Objective:");

    await handleCommandMenuReply("Publish a weekly summary.");
    const done = await handleCommandMenuReply("skip");
    expect(done?.[0].label).toBe("Function created");
    const [definition] = listBusinessFunctionDefinitions();
    expect(definition.enterpriseId).toBe(listEnterprises()[1].id);
  });
});

/**
 * /task-cap is a compatibility alias named after a --capability flag that no
 * longer exists. Three chapters of the manual still print its old form, so both
 * paths a reader can arrive by have to lead somewhere useful: typing it bare,
 * and typing it with the flags the book shows.
 *
 * Before this, bare /task-cap called /task create with no outcome — no menu and
 * no guidance — and the flag form was refused under the label "Task created",
 * announcing a rejected command as a success.
 */
describe("the /task-cap compatibility alias", () => {
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });
  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });

  it("opens the same guided flow as /task when typed on its own", async () => {
    const opened =
      await handleUiCommand("/task-cap", []);

    expect(opened[0].label).toBe("Please select an option:");
    expect(opened[0].body).toContain("Create a task");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("refuses the removed switches by name, and does not call it a success", async () => {
    const refused =
      await handleUiCommand("/task-cap", [
        "Review the supplied evidence.",
        "--capability",
        "safety",
      ]);

    expect(refused[0].label).not.toBe("Task created");
    expect(refused[0].body).toContain("--capability is no longer used");
    expect(refused[0].body).toContain("/task");
  });
});
