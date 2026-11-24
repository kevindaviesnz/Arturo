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
  startCreateHumanTaskMenu,
  startTaskMenu,
  menuPick,
  menuReferences,
} from "./uiCommandHandlers";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
} from "../control/workers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  ensureTestSigner,
} from "../testing/cliTestSetup";

import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";

import {
  clearArtefacts,
  createArtefact,
  submitArtefactVersionForReview,
} from "../artefacts/artefactStore";

import {
  clearHumanTasks,
  listHumanTasks,
} from "../runtime/humanTaskStore";

/**
 * The last flag-only paths: --after-artefact-approval and --procedure on
 * /task create, and --artefact on /create-human-task and /complete-human-task. Each is now
 * a numbered pick, offered only when there is something to pick.
 */
describe("the last flag-only Task paths", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearStaffingAssignments();
    clearWorkers();
    clearJobs();
    clearArtefacts();
    clearHumanTasks();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearStaffingAssignments();
    clearWorkers();
    clearJobs();
    clearArtefacts();
    clearHumanTasks();
  });

  /** An Enterprise with one Function staffed by one capable AI Worker. */
  function seedStaffedFunction(): string {
    const enterprise =
      createAndSaveEnterprise({ name: "Threadline", mission: "Make clothes." });
    ensureTestSigner({ enterpriseId: enterprise.id });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:design`,
      enterpriseId: enterprise.id,
      label: "Design",
      objective: "Produce garment designs.",
    });
    addWorker({
      name: "Design Worker",
      kind: "ai",
      capabilities: ["llm", "writing", "human-contact"],
      run: function* (input: unknown) {
        return input;
      },
    });
    saveStaffingAssignment({
      businessFunctionId: definition.id,
      workerName: "Design Worker",
      role: "ai",
      rationale: "For this test.",
    });
    return enterprise.id;
  }

  /** Attaches one file version and returns its exact reference. */
  function attachFile(enterpriseId: string, name: string): string {
    const artefact = createArtefact({
      enterpriseId,
      name,
      kind: "design",
      uri: "https://example.com/look-01.svg",
      mediaType: "image/svg+xml",
      createdBy: "Design Worker",
    });
    return `${artefact.id}@1`;
  }

  it("offers only the evidence options that apply, and nothing else", async () => {
    seedStaffedFunction();
    startTaskMenu();
    await handleCommandMenuReply("1");
    const ask = await handleCommandMenuReply("Draft a welcome email.");

    // No files attached and no Procedures registered, so only these two.
    expect(ask?.[0].body).toContain("1. No, it has everything it needs");
    expect(ask?.[0].body).toContain("2. Search the public web first");
    expect(ask?.[0].body).not.toContain("Work from a file");
    expect(ask?.[0].body).not.toContain("Wait until a file has been approved");
    expect(ask?.[0].body).not.toContain("Procedure");
    expect(ask?.[0].body).not.toContain("--");
  });

  it("holds a Task until a file is approved, instead of --after-artefact-approval", async () => {
    const enterpriseId = seedStaffedFunction();
    const reference = attachFile(enterpriseId, "Look 01 design");
    submitArtefactVersionForReview(
      { artefactId: reference.split("@")[0], version: 1 },
      "Design Approver",
      ""
    );

    startTaskMenu();
    await handleCommandMenuReply("1");
    const ask = await handleCommandMenuReply("Cost the approved design.");
    const waitOption = ask![0].body
      .split("\n")
      .find((line) => line.includes("Wait until a file has been approved"));
    expect(waitOption).toBeDefined();

    const pick = await handleCommandMenuReply(
      waitOption!.trim().match(/^(\d+)\./)![1]
    );
    expect(pick?.[0].label).toBe("Which file must be approved first?");
    expect(pick?.[0].body).toContain("Look 01 design");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Task created");
    expect(isCommandMenuActive()).toBe(false);
    expect(listJobs()).toHaveLength(1);
  });

  it("asks which file a person must look at, instead of --artefact", async () => {
    const enterpriseId = seedStaffedFunction();
    attachFile(enterpriseId, "Look 01 design");
    addWorker(createHumanWorker("Priya", "guardian", undefined, "available", undefined));

    startCreateHumanTaskMenu();
    await handleCommandMenuReply("Check the design");
    await handleCommandMenuReply("Confirm the seam allowances are buildable.");
    await handleCommandMenuReply("skip");

    // Assigning to Priya leads straight into the file question.
    const fileAsk = await handleCommandMenuReply("1");
    expect(fileAsk?.[0].label).toBe("Must they look at a file?");
    expect(fileAsk?.[0].body).toContain("Look 01 design");
    expect(fileAsk?.[0].body).not.toContain("--artefact");

    const done = await handleCommandMenuReply("2");
    // A created Human Task must not be reported as "not created": the hand-off
    // block used to print "From: (unknown)", which read as a refusal.
    expect(done?.[0].label).toBe("Human task created");
    expect(isCommandMenuActive()).toBe(false);

    const [task] = listHumanTasks();
    expect(task.inputArtefactRefs?.length ?? 0).toBeGreaterThan(0);
  });

  it("skips the file question entirely when nothing is attached", async () => {
    seedStaffedFunction();
    addWorker(createHumanWorker("Priya", "guardian", undefined, "available", undefined));

    startCreateHumanTaskMenu();
    await handleCommandMenuReply("Check the invoice");
    await handleCommandMenuReply("Compare the total against the quote.");
    await handleCommandMenuReply("skip");
    const done = await handleCommandMenuReply("1");

    expect(done?.[0].label).toBe("Human task created");
    expect(isCommandMenuActive()).toBe(false);
  });
});

describe("working from more than one file", () => {
  const shown = ["artefact-2@2", "artefact-1@1", "artefact-3@1"] as const;

  it("reads 1,3 as two choices", () => {
    // --input-artefact has always taken a list; the menu could only offer one,
    // so "the specification and the engineer's comments" needed switches.
    expect(menuReferences("1,3", shown)).toEqual(["artefact-2@2", "artefact-3@1"]);
    expect(menuReferences("1 3", shown)).toEqual(["artefact-2@2", "artefact-3@1"]);
    expect(menuReferences("2", shown)).toEqual(["artefact-1@1"]);
  });

  it("ignores a repeat rather than sending it twice", () => {
    expect(menuReferences("2,2", shown)).toEqual(["artefact-1@1"]);
    // The same file named both ways is still one choice.
    expect(menuReferences("2,artefact-1@1", shown)).toEqual(["artefact-1@1"]);
  });

  it("refuses anything out of range, rather than silently dropping it", () => {
    expect(menuReferences("1,4", shown)).toBeUndefined();
    expect(menuReferences("0", shown)).toBeUndefined();
    expect(menuReferences("", shown)).toBeUndefined();
    expect(menuReferences("first", shown)).toBeUndefined();
    // A file that is not on offer is refused, not resolved to a neighbour.
    expect(menuReferences("artefact-9@1", shown)).toBeUndefined();
  });

  it("takes the file's own reference, because a row number moves", () => {
    // A version's row number changes the moment it is approved — approved
    // versions sort above drafts — so a number that was right a moment ago
    // silently picks a different file. This is how a caller says which one it
    // actually meant. Scenario 051 gated a Task on the wrong document this way.
    expect(menuReferences("artefact-3@1", shown)).toEqual(["artefact-3@1"]);
    expect(menuReferences("ARTEFACT-3@1", shown)).toEqual(["artefact-3@1"]);
    expect(menuReferences("artefact-2@2,artefact-3@1", shown)).toEqual([
      "artefact-2@2",
      "artefact-3@1",
    ]);
    // Mixing the two is fine: they name positions in the same list.
    expect(menuReferences("1,artefact-3@1", shown)).toEqual([
      "artefact-2@2",
      "artefact-3@1",
    ]);
  });
});

describe("answering a picker by name", () => {
  const rows = ["Demand Monitoring", "Capacity Planning", "Pathway Analysis"];

  it("takes the row number, as it always did", () => {
    expect(menuPick("2", rows)).toBe(2);
    expect(menuPick(" 3 ", rows)).toBe(3);
  });

  it("takes the name on the row, so a stale number cannot mean another record", () => {
    // Scenario 051 gated a Task on the wrong document this way: every wrong
    // number was a valid choice for a different record, so nothing looked
    // wrong. Naming what you mean cannot drift.
    expect(menuPick("Pathway Analysis", rows)).toBe(3);
    expect(menuPick("pathway analysis", rows)).toBe(3);
    expect(menuPick("  Capacity Planning  ", rows)).toBe(2);
  });

  it("matches the name on a row that explains itself", () => {
    // Memory scopes read "Pathway Analysis — only this Function's work".
    expect(
      menuPick("Pathway Analysis", [
        "Demand Monitoring — only this Function's work",
        "Pathway Analysis — only this Function's work",
      ])
    ).toBe(2);
  });

  it("refuses a number out of range and a name not on offer", () => {
    expect(menuPick("4", rows)).toBeUndefined();
    expect(menuPick("0", rows)).toBeUndefined();
    expect(menuPick("Quality Review", rows)).toBeUndefined();
    expect(menuPick("", rows)).toBeUndefined();
  });
});
