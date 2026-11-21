import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearBusinessFunctionDefinitions, saveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import { clearJobs, enqueueJob, replaceJob } from "./jobQueue";
import { clearResultSignOffs } from "./resultSignOff";
import { clearHumanTasks, listHumanTasks } from "./humanTaskStore";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { signOffTaskResult } from "../task/taskSignOff";
import { formatHumanTaskSourceWork } from "../repl/humanTaskCommands";
import { runtimeDb } from "../storage/runtimeDatabase";
import { handleUiFunctionUpdateSubcommand } from "../ui/uiCommandHandlers";
import { getBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import {
  clearHandOffs,
  deliverHandOff,
  getHandOff,
  listHandOffDeliveries,
  refuseHandOff,
  removeHandOff,
  setHandOff,
} from "./handOff";
import { loadHandOffs, saveHandOff } from "../storage/handOffRepository";

const FUNCTION_ID = "e-1:design-briefs";
const AI = "Evidence status: UNVERIFIED MODEL SYNTHESIS\nExternal tools used: none\n\n";

const reset = () => {
  clearJobs();
  clearResultSignOffs();
  clearHumanTasks();
  clearHandOffs();
  clearStaffingAssignments();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

/** Records that a person works at a business, as setting them up there would. */
const worksAt = (workerName: string, enterpriseId: string) =>
  runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run(workerName, enterpriseId);

describe("handing a signed-off result to the next person", () => {
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Kevin", "guardian"));
    addWorker(createHumanWorker("Dana", "guardian"));
    worksAt("Kevin", "e-1");
    worksAt("Dana", "e-1");
    saveBusinessFunctionDefinition(createBusinessFunctionDefinition({ id: FUNCTION_ID, enterpriseId: "e-1", label: "Design Briefs" }));
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "Kevin", role: "human-approver", rationale: "Owner." });
  });
  afterEach(reset);

  const brief = (text = "Brief: burgundy.") =>
    replaceJob({
      ...enqueueJob("Write one brief.", "Design Brief Creator", { businessFunctionId: FUNCTION_ID, enterpriseId: "e-1", inputArtefactRefs: ["artefact-5@1"] }),
      status: "completed",
      output: `${AI}${text}`,
    });

  it("refuses a hand-off to someone who is not a registered person, or with nothing to do", () => {
    expect(refuseHandOff({ to: "Design Bot", task: "Design it." })).toContain("Design Bot is not a registered person");
    expect(refuseHandOff({ to: "Dana", task: "  " })).toContain("Say what the person should do");
    expect(refuseHandOff({ to: "Dana", task: "x".repeat(501) })).toContain("under 500");
    expect(setHandOff({ functionId: "nope", to: "Dana", task: "Design it.", as: "Kevin" })).toEqual({ refused: "No Function found with id nope." });
    expect(getHandOff(FUNCTION_ID)).toBeUndefined();
  });

  it("never hands one business's results to another business's person, from the terminal or anywhere else", () => {
    addWorker(createHumanWorker("Zed", "guardian"));
    worksAt("Zed", "e-2");
    addWorker(createHumanWorker("Nobody Yet", "guardian"));

    for (const to of ["Zed", "Nobody Yet"]) {
      expect(refuseHandOff({ to, task: "Design it.", enterpriseId: "e-1" })).toContain(`${to} does not work at e-1`);
      expect(setHandOff({ functionId: FUNCTION_ID, to, task: "Design it.", as: "Kevin" })).toMatchObject({ refused: expect.stringContaining("does not work at") });
    }
    expect(getHandOff(FUNCTION_ID)).toBeUndefined();

    // The terminal refuses before changing anything else it was asked to change.
    const said = handleUiFunctionUpdateSubcommand([FUNCTION_ID, "--objective", "Changed.", "--hand-off-to", "Zed", "--hand-off-task", "Design it."]);
    expect(said[0]).toMatchObject({ label: "Hand-off not set", body: expect.stringContaining("Zed does not work at e-1") });
    expect(getBusinessFunctionDefinition(FUNCTION_ID)?.objective).not.toBe("Changed.");
    expect(getHandOff(FUNCTION_ID)).toBeUndefined();

    // Someone who works there is accepted.
    expect(setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Kevin" })).toMatchObject({ handOff: { to: "Dana" } });
  });

  it("does nothing until the result is signed off, then gives it to the named person once", () => {
    setHandOff({ functionId: FUNCTION_ID, to: "dana", task: "Design the garment this brief describes", as: "Kevin" });
    const job = brief();

    // Not signed off: an AI-written result never reaches a person's desk.
    expect(deliverHandOff(job, "Kevin")).toMatchObject({ handed: false, message: expect.stringContaining("could not be confirmed") });
    expect(listHumanTasks()).toHaveLength(0);

    const outcome = signOffTaskResult([job.id, "--as", "Kevin"]);
    expect(outcome.signedOff).toBe(true);
    expect(outcome.message).toContain("Handed to Dana as human-task-1: Design the garment this brief describes");

    const [task] = listHumanTasks();
    expect(task).toMatchObject({
      owner: "Dana",
      handoverJobId: job.id,
      inputArtefactRefs: ["artefact-5@1"],
      title: `Design the garment this brief describes (from ${job.id})`,
    });
    expect(task.instructions).toContain(`which Kevin signed off`);
    // The person reads that it was signed off, not that nobody checked it.
    expect(formatHumanTaskSourceWork(task)).toMatch(new RegExp(`^Work to act on \\(from ${job.id}, written by an AI Worker and signed off by Kevin on .+, which records that they accepted it, not that it is correct\\):\nBrief: burgundy\\.`));
    expect(listHandOffDeliveries()).toMatchObject([{ jobId: job.id, humanTaskId: task.id, signedOffBy: "Kevin", to: "Dana" }]);

    // A second path cannot hand the same result over again.
    expect(deliverHandOff(job, "Kevin")).toEqual({ handed: false });
    expect(signOffTaskResult([job.id, "--as", "Kevin"]).signedOff).toBe(false);
    expect(listHumanTasks()).toHaveLength(1);
  });

  it("hands nothing over when the sign-off itself is refused", () => {
    setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Kevin" });
    const job = brief();

    expect(signOffTaskResult([job.id, "--as", "Dana"]).signedOff).toBe(false);
    expect(listHumanTasks()).toHaveLength(0);
  });

  it("stops handing over once it is turned off, and leaves what it created", () => {
    setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Kevin" });
    signOffTaskResult([brief().id, "--as", "Kevin"]);
    expect(removeHandOff(FUNCTION_ID)).toBe(true);
    expect(removeHandOff(FUNCTION_ID)).toBe(false);

    const later = signOffTaskResult([brief("Brief: ballet flats.").id, "--as", "Kevin"]);
    expect(later.signedOff).toBe(true);
    expect(later.message).not.toContain("Handed to");
    expect(listHumanTasks()).toHaveLength(1);
  });

  describe("a standing permission, checked live when it would act (B9)", () => {
    it("is set only by someone at the business who can sign off, signed with their name", () => {
      expect(setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "" })).toMatchObject({ refused: expect.any(String) });
      expect(setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Nobody" })).toMatchObject({ refused: expect.any(String) });
      expect(getHandOff(FUNCTION_ID)).toBeUndefined();
      // The terminal refuses before changing anything else it was asked to change.
      const said = handleUiFunctionUpdateSubcommand([FUNCTION_ID, "--objective", "Changed.", "--hand-off-to", "Dana", "--hand-off-task", "Design it."]);
      expect(said[0]).toMatchObject({ label: "Hand-off not set" });
      expect(getBusinessFunctionDefinition(FUNCTION_ID)?.objective).not.toBe("Changed.");
      expect(handleUiFunctionUpdateSubcommand([FUNCTION_ID, "--hand-off-to", "Dana", "--hand-off-task", "Design it.", "--as", "Kevin"])[0].label).not.toBe("Hand-off not set");
      expect(getHandOff(FUNCTION_ID)).toMatchObject({ setBy: "Kevin" });
      expect(setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "kevin" })).toMatchObject({ handOff: { setBy: "Kevin", version: 1, signature: expect.any(String) } });
    });

    it("counts a hand-off saved before hand-offs were signed, or edited since, as off", () => {
      setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Kevin" });
      const [stored] = loadHandOffs();
      const { signature: _signature, version: _version, setBy: _setBy, ...legacy } = stored;
      saveHandOff(legacy);
      const outcome = signOffTaskResult([brief().id, "--as", "Kevin"]);
      expect(outcome.signedOff).toBe(true);
      expect(outcome.message).toContain("Not handed to Dana: The hand-off set on Design Briefs could not be verified, so it counts as off.");
      expect(listHumanTasks()).toHaveLength(0);

      saveHandOff({ ...stored, task: "Send it to the printer." });
      expect(deliverHandOff(brief("Brief: navy."), "Kevin")).toMatchObject({ handed: false });
      expect(listHumanTasks()).toHaveLength(0);
    });

    it("lapses when the person who set it can no longer sign off here", () => {
      addWorker(createHumanWorker("Lee", "guardian"));
      worksAt("Lee", "e-1");
      setHandOff({ functionId: FUNCTION_ID, to: "Dana", task: "Design it.", as: "Lee" });
      runtimeDb.prepare("DELETE FROM enterprise_worker_memberships WHERE worker_name = ?").run("Lee");
      const outcome = signOffTaskResult([brief().id, "--as", "Kevin"]);
      expect(outcome.signedOff).toBe(true);
      expect(outcome.message).toContain("Not handed to Dana: The hand-off set on Design Briefs was set by Lee, who can no longer sign off work here, so it lapsed and counts as withdrawn.");
      expect(listHumanTasks()).toHaveLength(0);
    });
  });
});
