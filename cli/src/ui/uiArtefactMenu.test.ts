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
  startArtefactMenu,
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
  clearArtefacts,
  createArtefact,
  getArtefactVersion,
} from "../artefacts/artefactStore";

/**
 * Sending a file for review used to need --reviewer, and recording the outcome
 * needed --decision, --as, and --notes together with an exact id@version the
 * operator had to copy from an earlier listing. The menu now offers the exact
 * versions in the right review state and asks for the rest in plain words.
 *
 * The decision stays bound to the exact version and the assigned reviewer —
 * the menu picks those, it does not relax them.
 */
describe("guided /artefact menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearArtefacts();
    clearEnterprises();
    clearWorkers();
  });
  afterEach(() => {
    clearCommandMenu();
    clearArtefacts();
    clearEnterprises();
    clearWorkers();
  });

  /** Registers a person who can be a reviewer. */
  function addPerson(name: string): void {
    addWorker(createHumanWorker(name, "reviewer", undefined, "available", undefined));
  }

  /** Attaches one file version, as the attach wizard would. */
  function attachFile(name: string): string {
    const enterprise =
      createAndSaveEnterprise({ name: "Threadline", mission: "Make clothes." });
    const artefact = createArtefact({
      enterpriseId: enterprise.id,
      name,
      kind: "design",
      uri: "https://example.com/look-01.svg",
      mediaType: "image/svg+xml",
      createdBy: "Design File Creator",
    });
    return `${artefact.id}@1`;
  }

  it("offers attach / version / send / record / see without any switches", () => {
    const start = startArtefactMenu();
    expect(start[0].label).toBe("Files");
    expect(start[0].body).toContain("2. Record a new version of a file you've attached");
    expect(start[0].body).toContain("3. Send a file to someone for review");
    // inspect and verify had no guided path at all before.
    expect(start[0].body).toContain("6. Look at one file and every version of it");
    expect(start[0].body).toContain("7. Check a file still matches what Arturo recorded");
    expect(start[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("records a new version, which starts unreviewed", async () => {
    addPerson("Design Approver");
    const reference = attachFile("Look 01 design");
    const [artefactId] = reference.split("@");

    startArtefactMenu();
    const pick = await handleCommandMenuReply("2");
    expect(pick?.[0].label).toBe("Which file has a new version?");
    expect(pick?.[0].body).toContain("currently at version 1");

    const whereAsk = await handleCommandMenuReply("1");
    expect(whereAsk?.[0].label).toBe("Where is the new version?");
    // A new version must never inherit the previous version's approval.
    expect(whereAsk?.[0].body).toContain("never inherits");

    const noteAsk = await handleCommandMenuReply("https://example.com/look-01-v2.svg");
    expect(noteAsk?.[0].label).toBe("What changed in this version?");

    const done = await handleCommandMenuReply("skip");
    expect(done?.[0].label).toBe("Artefact");
    expect(isCommandMenuActive()).toBe(false);

    const second = getArtefactVersion({ artefactId, version: 2 });
    expect(second).toBeDefined();
    expect(second?.reviewStatus).toBe("draft");
  });

  it("says there is nothing to version before anything is attached", async () => {
    startArtefactMenu();
    const none = await handleCommandMenuReply("2");
    expect(none?.[0].label).toBe("Nothing to version");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("still opens the attach wizard from the menu", async () => {
    startArtefactMenu();
    const attach = await handleCommandMenuReply("1");
    expect(attach?.[0].label).toBe("Attach a file");
  });

  it("sends the only draft version to the only reviewer", async () => {
    addPerson("Design Approver");
    const reference = attachFile("Look 01 design");

    startArtefactMenu();
    const pick = await handleCommandMenuReply("3");
    expect(pick?.[0].label).toBe("Which file version?");
    expect(pick?.[0].body).toContain("Look 01 design");
    expect(pick?.[0].body).toContain(reference);

    // Naming what to check is the last question: the reviewer sees it with the
    // file, and it was previously reachable only as --notes.
    const asked = await handleCommandMenuReply("1");
    expect(asked?.[0].label).toBe("What should Design Approver check?");

    const done = await handleCommandMenuReply("Check the written dimensions.");
    expect(done?.[0].label).toBe("Artefact");
    expect(isCommandMenuActive()).toBe(false);

    const [artefactId, version] = reference.split("@");
    const stored = getArtefactVersion({ artefactId, version: Number(version) });
    expect(stored?.reviewStatus).toBe("awaiting_review");
    expect(stored?.reviewer).toBe("Design Approver");
  });

  it("asks who should review it when several people are registered", async () => {
    addPerson("Design Approver");
    addPerson("Second Reviewer");
    attachFile("Look 01 design");

    startArtefactMenu();
    await handleCommandMenuReply("3");
    const who = await handleCommandMenuReply("1");
    expect(who?.[0].label).toBe("Who should review it?");
    expect(who?.[0].body).toContain("Design Approver");
    expect(who?.[0].body).toContain("Second Reviewer");
  });

  it("records a decision against the assigned reviewer and exact version", async () => {
    addPerson("Design Approver");
    addPerson("Second Reviewer");
    const reference = attachFile("Look 01 design");

    // Send it to the first reviewer: version, reviewer, then what to check.
    startArtefactMenu();
    await handleCommandMenuReply("3");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Check the dimensions.");

    startArtefactMenu();
    const pick = await handleCommandMenuReply("4");
    expect(pick?.[0].label).toBe("Which file version was reviewed?");

    // The reviewer it was assigned to is used, not asked for again.
    const decisionAsk = await handleCommandMenuReply("1");
    expect(decisionAsk?.[0].label).toBe("What did they decide?");
    expect(decisionAsk?.[0].body).toContain("Design Approver");
    expect(decisionAsk?.[0].body).not.toContain("Second Reviewer");

    const notesAsk = await handleCommandMenuReply("1"); // approve
    expect(notesAsk?.[0].label).toBe("Why?");

    const done = await handleCommandMenuReply("Checked against the brief; ready for costing.");
    expect(done?.[0].label).toBe("Artefact");
    expect(isCommandMenuActive()).toBe(false);

    const [artefactId, version] = reference.split("@");
    const stored = getArtefactVersion({ artefactId, version: Number(version) });
    expect(stored?.reviewStatus).toBe("approved");
    expect(stored?.reviewer).toBe("Design Approver");
    expect(stored?.reviewNotes).toContain("ready for costing");
  });

  it("will not record a decision without a reason", async () => {
    addPerson("Design Approver");
    attachFile("Look 01 design");
    startArtefactMenu();
    await handleCommandMenuReply("3");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Check the dimensions.");

    startArtefactMenu();
    await handleCommandMenuReply("4");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("1");
    const again = await handleCommandMenuReply("   ");
    expect(again?.[0].label).toBe("Why?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("says so when there is no one registered to review a file", async () => {
    attachFile("Look 01 design");
    startArtefactMenu();
    const refused = await handleCommandMenuReply("3");
    expect(refused?.[0].label).toBe("No one to review it");
    expect(refused?.[0].body).toContain("/add-human-worker");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("says so when nothing is waiting on a review", async () => {
    addPerson("Design Approver");
    attachFile("Look 01 design");
    startArtefactMenu();
    const none = await handleCommandMenuReply("4");
    expect(none?.[0].label).toBe("Nothing waiting on a review");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("asks for a note on a new version, and keeps it", async () => {
    // --notes was the single biggest source of switches in the artefact
    // scenario and had no guided path anywhere.
    addPerson("Design Approver");
    const reference = attachFile("Look 01 design");
    const [artefactId] = reference.split("@");

    startArtefactMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("1");
    const noteAsk = await handleCommandMenuReply("https://example.com/look-01-v2.svg");
    expect(noteAsk?.[0].label).toBe("What changed in this version?");

    const done = await handleCommandMenuReply("Corrected the dimensions.");
    expect(done?.[0].label).toBe("Artefact");
    expect(getArtefactVersion({ artefactId, version: 2 })?.notes).toContain(
      "Corrected the dimensions"
    );
  });

  it("lets the note be skipped", async () => {
    addPerson("Design Approver");
    const reference = attachFile("Look 01 design");
    const [artefactId] = reference.split("@");

    startArtefactMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("https://example.com/look-01-v2.svg");
    const done = await handleCommandMenuReply("skip");

    expect(done?.[0].label).toBe("Artefact");
    expect(getArtefactVersion({ artefactId, version: 2 })).toBeDefined();
    expect(isCommandMenuActive()).toBe(false);
  });

  it("looks at one file and its versions without an id being typed", async () => {
    attachFile("Look 01 design");

    startArtefactMenu();
    const shown = await handleCommandMenuReply("6");

    // Sole file, so nothing to pick.
    expect(shown?.[0].label).toBe("Artefact");
    expect(shown?.[0].body).toContain("Look 01 design");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("re-checks a version against its record without an id@version being typed", async () => {
    const reference = attachFile("Look 01 design");

    startArtefactMenu();
    const checked = await handleCommandMenuReply("7");

    expect(checked?.[0].label).toBe("Artefact");
    // A remote URI is never fetched, so this is the honest answer for one.
    expect(checked?.[0].body).toContain(reference.split("@")[0]);
    expect(isCommandMenuActive()).toBe(false);
  });

  it("says there is nothing to look at before anything is attached", async () => {
    startArtefactMenu();
    const none = await handleCommandMenuReply("6");
    expect(none?.[0].label).toBe("No files yet");
    expect(isCommandMenuActive()).toBe(false);
  });
});
