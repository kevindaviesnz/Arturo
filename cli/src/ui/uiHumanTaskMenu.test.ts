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
  startHumanTaskAction,
} from "./uiCommandHandlers";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
} from "../control/workers";

import {
  clearHumanTasks,
  createHumanTask,
  listHumanTasks,
} from "../runtime/humanTaskStore";

import {
  clearJobs,
  enqueueJob,
  markJobCompleted,
  replaceJob,
} from "../runtime/jobQueue";

import {
  formatHumanTaskSourceWork,
} from "../repl/humanTaskCommands";

/**
 * /create-human-task, /complete-human-task, /block-task, and /revise-task used to require
 * ids and switches (--assign-to, --as, --purpose) that an operator had to
 * copy-paste. Typed bare they now ask, in order, for exactly what they need.
 */
describe("guided Human Task flows", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearHumanTasks();
    clearWorkers();
    clearJobs();
  });
  afterEach(() => {
    clearCommandMenu();
    clearHumanTasks();
    clearWorkers();
    clearJobs();
  });

  /** A Task that has finished, with output for a person to act on. */
  function finishedJob(task: string, output: string): string {
    const queued = enqueueJob(task);
    replaceJob(markJobCompleted(queued, output, output, Date.now()));
    return queued.id;
  }

  function addPerson(name: string): void {
    addWorker(createHumanWorker(name, "guardian", undefined, "available", undefined));
  }

  it("creates a Human Task from a description and an assignee pick", async () => {
    addPerson("Priya");

    // One question about the work, not three. /task takes a description and
    // nothing else, and a Human Task is the same request made of a person.
    const start = startCreateHumanTaskMenu();
    expect(start[0].label).toBe("Description:");
    expect(start[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);

    const ownerAsk = await handleCommandMenuReply(
      "Open the packaging, photograph any damage, and record the serial number."
    );
    expect(ownerAsk?.[0].label).toBe("Worker:");
    expect(ownerAsk?.[0].body).toContain("1. Priya");
    expect(ownerAsk?.[0].body).toContain("Leave it unassigned");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Human task created");
    expect(isCommandMenuActive()).toBe(false);

    const [task] = listHumanTasks();
    expect(task.instructions).toContain("photograph any damage");
    // Named from what it asks for, so the listings and the completion prompt
    // still have something to quote back.
    expect(task.title).toBe("Open the packaging, photograph any damage, and record the serial nu...");
    expect(task.owner).toBe("Priya");
  });

  it("leaves the task unassigned when the operator picks that row", async () => {
    addPerson("Priya");
    startCreateHumanTaskMenu();
    await handleCommandMenuReply("Compare the invoice total against the quote.");
    const done = await handleCommandMenuReply("2"); // "Leave it unassigned for now"

    expect(done?.[0].label).toBe("Human task created");
    const [task] = listHumanTasks();
    expect(task.purpose).toBeUndefined();
    expect(task.owner).toBeUndefined();
  });

  it("creates the task with no assignee question when nobody is registered", async () => {
    startCreateHumanTaskMenu();
    const done = await handleCommandMenuReply(
      "Compare the invoice total against the quote."
    );

    expect(done?.[0].label).toBe("Human task created");
    expect(isCommandMenuActive()).toBe(false);
    expect(listHumanTasks()).toHaveLength(1);
  });

  it("strips quotes typed at the description prompt", async () => {
    startCreateHumanTaskMenu();
    await handleCommandMenuReply('"Inspect the returned unit"');

    expect(listHumanTasks()[0].instructions).toBe("Inspect the returned unit");
    expect(listHumanTasks()[0].title).toBe("Inspect the returned unit");
  });


  // An operator produced packing instructions with an AI Task, then had no way
  // to put them in front of the person on the floor: /task offers "continue
  // from a task that's already finished" and /create-human-task offered
  // nothing, so the only route was pasting the output into the instructions.
  it("hands a finished Task's result to the person", async () => {
    addPerson("Warehouse Lead");
    const jobId = finishedJob(
      "Produce the picking and packing instructions for order 4472.",
      "Pick List\n\n1. Ceramic Lamp\n\nBox Size: 12 x 10 x 8"
    );

    startCreateHumanTaskMenu();
    const followsAsk = await handleCommandMenuReply(
      "Follow the packing instructions and record anything that did not match."
    );

    expect(followsAsk?.[0].label).toBe("Is there finished work they should act on?");
    expect(followsAsk?.[0].body).toContain("1. No");
    expect(followsAsk?.[0].body).toContain(jobId);

    const ownerAsk = await handleCommandMenuReply("2");
    expect(ownerAsk?.[0].label).toBe("Worker:");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Human task created");

    const [task] = listHumanTasks();
    expect(task.handoverJobId).toBe(jobId);
    // Not sourceJobId: that means a Task parked on this person, and completing
    // the Human Task would try to advance a Task that has already finished.
    expect(task.sourceJobId).toBeUndefined();

    // The point of the whole thing: the person can read the work itself, not
    // an id pointing at it.
    const handover = formatHumanTaskSourceWork(task);
    expect(handover).toContain("Box Size: 12 x 10 x 8");
    expect(handover).toContain("not checked by anyone");
  });

  it("skips the question when nothing has finished", async () => {
    addPerson("Warehouse Lead");

    startCreateHumanTaskMenu();
    const next = await handleCommandMenuReply("Open the packaging and photograph any damage.");

    expect(next?.[0].label).toBe("Worker:");
  });

  it("records no source work when the operator answers No", async () => {
    addPerson("Warehouse Lead");
    finishedJob("Produce the packing instructions.", "Pick List");

    startCreateHumanTaskMenu();
    await handleCommandMenuReply("Open the packaging and photograph any damage.");
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("1");

    const [task] = listHumanTasks();
    expect(task.handoverJobId).toBeUndefined();
    expect(formatHumanTaskSourceWork(task)).toBeUndefined();
  });

  it("completes the only open task, attributing it to the only person", async () => {
    addPerson("Priya");
    const task = createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });

    const start = startHumanTaskAction("complete");
    expect(start[0].label).toBe('What was done for "Inspect the unit"?');

    const done = await handleCommandMenuReply("Inspected it; the casing is cracked.");
    expect(done?.[0].label).toBe("Human task completed");
    expect(isCommandMenuActive()).toBe(false);

    expect(listHumanTasks().find((entry) => entry.id === task.id)?.status).toBe("completed");
  });

  it("asks which task, then who did it, when both are ambiguous", async () => {
    addPerson("Priya");
    addPerson("Sam");
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });
    createHumanTask({ title: "Call the supplier", instructions: "Ask about the delay." });

    const pick = await Promise.resolve(startHumanTaskAction("complete"));
    expect(pick[0].label).toBe("Which task is finished?");
    expect(pick[0].body).toContain("Inspect the unit");
    expect(pick[0].body).toContain("Call the supplier");

    // Names the task the row number selected, so a mis-picked row is visible
    // before any notes are recorded against it.
    const notesAsk = await handleCommandMenuReply("2");
    expect(notesAsk?.[0].label).toBe('What was done for "Call the supplier"?');

    const asAsk = await handleCommandMenuReply("Spoke to the supplier; parts ship Friday.");
    expect(asAsk?.[0].label).toBe("Who did it?");
    expect(asAsk?.[0].body).toContain("Priya");
    expect(asAsk?.[0].body).toContain("Sam");

    const done = await handleCommandMenuReply("2");
    expect(done?.[0].label).toBe("Human task completed");
    const completed = listHumanTasks().find((entry) => entry.title === "Call the supplier");
    expect(completed?.status).toBe("completed");
    expect(completed?.completedBy).toBe("Sam");
  });

  it("blocks a task with a reason", async () => {
    const task = createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });

    const start = startHumanTaskAction("block");
    expect(start[0].label).toBe("What is blocking it?");

    const done = await handleCommandMenuReply("The unit has not arrived from the courier yet.");
    expect(done?.[0].label).toBe("Human task blocked");
    expect(listHumanTasks().find((entry) => entry.id === task.id)?.status).toBe("blocked");
  });

  it("re-asks rather than recording an empty reason", async () => {
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });
    startHumanTaskAction("block");
    const again = await handleCommandMenuReply("   ");
    expect(again?.[0].label).toBe("What is blocking it?");
    expect(isCommandMenuActive()).toBe(true);
    expect(listHumanTasks()[0].status).toBe("open");
  });

  it("says so plainly when there is nothing the action applies to", () => {
    addPerson("Priya");
    const start = startHumanTaskAction("complete");
    expect(start[0].label).toBe("Nothing waiting on a person");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("refuses to start completion when nobody is registered to attribute it to", () => {
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });
    const start = startHumanTaskAction("complete");
    expect(start[0].label).toBe("No one to attribute it to");
    expect(start[0].body).toContain("/add-human-worker");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("attributes completion to the assignee without asking, even with several people", async () => {
    addPerson("Priya");
    addPerson("Sam");
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it.", owner: "Sam" });

    startHumanTaskAction("complete");
    const done = await handleCommandMenuReply("Inspected; casing cracked.");

    expect(done?.[0].label).toBe("Human task completed");
    expect(listHumanTasks()[0].completedBy).toBe("Sam");
  });

  it("does not offer a completed task for completion", async () => {
    addPerson("Priya");
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });
    startHumanTaskAction("complete");
    await handleCommandMenuReply("Done — no damage found.");

    // The only task is now completed, so the picker has nothing left to offer.
    const again = startHumanTaskAction("complete");
    expect(again[0].label).toBe("Nothing waiting on a person");
  });

  it("cancels without changing anything", async () => {
    createHumanTask({ title: "Inspect the unit", instructions: "Look at it." });
    startHumanTaskAction("block");
    const cancelled = await handleCommandMenuReply("cancel");
    expect(cancelled?.[0].label).toBe("Cancelled");
    expect(listHumanTasks()[0].status).toBe("open");
  });
});
