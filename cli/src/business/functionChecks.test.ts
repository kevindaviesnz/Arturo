import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearArtefacts, listArtefacts } from "../artefacts/artefactStore";
import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition, getBusinessFunctionDefinition } from "./businessFunctionDefinitionStore";
import { handleUiFunctionInspectSubcommand, handleUiFunctionUpdateSubcommand } from "../ui/uiCommandHandlers";
import { removeBusinessFunction } from "./businessFunctionRemoval";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { assignWorkerOwnership } from "../identity/organisationIdentity";
import { createTempTextArtefact } from "../testing/cliTestSetup";
import { createTask } from "../repl/taskRoutingCommands";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import {
  clearFunctionChecks,
  countWords,
  describeFunctionChecks,
  getFunctionChecks,
  MAX_WORD_LIMIT,
  refuseWorkUnderChecks,
  setFunctionChecks,
} from "./functionChecks";

const reset = () => {
  clearJobs(); clearArtefacts(); clearWorkers(); clearStaffingAssignments(); clearFunctionChecks();
  clearBusinessFunctionDefinitions(); clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};

const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");

describe("checks Arturo makes itself on work asked of an area", () => {
  let enterpriseId: string;
  let reviews: string;
  let accounts: string;

  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const enterprise = createAndSaveEnterprise({ name: "Silverdale Publishing", mission: "Children's books." });
    enterpriseId = enterprise.id;
    reviews = createAndSaveBusinessFunctionDefinition({ id: `${enterpriseId}:reviews`, enterpriseId, label: "Manuscript review", objective: "Review manuscripts." }).id;
    accounts = createAndSaveBusinessFunctionDefinition({ id: `${enterpriseId}:accounts`, enterpriseId, label: "Accounts", objective: "Keep the books." }).id;
    addWorker({ name: "Review Officer", kind: "ai", archetype: "reviewer", run: function* (input: unknown) { return input; } });
    for (const id of [reviews, accounts]) saveStaffingAssignment({ businessFunctionId: id, workerName: "Review Officer", role: "ai", rationale: "Works here." });
    addWorker(createHumanWorker("John Smith", "guardian"));
    assignWorkerOwnership({ workerName: "John Smith", enterpriseId });
  });
  afterEach(() => { vi.restoreAllMocks(); reset(); });

  const ask = (over: { functionId?: string; instruction?: string; file?: { name: string; text: string } } = {}) => {
    const args = [
      over.instruction ?? "Review this manuscript.",
      "--function", over.functionId ?? reviews,
      "--enterprise", enterpriseId,
      "--asked-by", "John Smith",
    ];
    if (over.file) {
      const artefact = createTempTextArtefact({
        enterpriseId,
        fileName: over.file.name,
        content: over.file.text,
        createdBy: "John Smith",
      });
      args.push("--input-artefact", artefact.ref);
    }
    return createTask(args);
  };
  const file = (name: string, text: string) => ({ name, text });

  it("counts words as a word processor does", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one\ttwo\nthree   four\r\n\r\nfive ")).toBe(5);
    expect(countWords("well-known isn't two words")).toBe(4);
  });

  describe("setting them", () => {
    it("records, replaces and removes a Function's checks", () => {
      const set = setFunctionChecks({ functionId: reviews, needsDocument: true, maxWords: 5000, setBy: "John Smith", now: 7 });
      expect(set).toEqual({ checks: { functionId: reviews, enterpriseId, needsDocument: true, maxWords: 5000, setBy: "John Smith", setAt: 7 } });
      expect(getFunctionChecks(reviews)).toMatchObject({ maxWords: 5000 });
      expect(getFunctionChecks(accounts)).toBeUndefined();
      expect(describeFunctionChecks(getFunctionChecks(reviews))).toEqual(["Work needs a document attached.", "A document over 5,000 words is not taken on."]);

      setFunctionChecks({ functionId: reviews, needsDocument: false, maxWords: 8000, setBy: "John Smith" });
      expect(describeFunctionChecks(getFunctionChecks(reviews))).toEqual(["A document over 8,000 words is not taken on."]);

      expect(setFunctionChecks({ functionId: reviews, needsDocument: false, setBy: "John Smith" })).toEqual({ checks: undefined });
      expect(getFunctionChecks(reviews)).toBeUndefined();
      expect(describeFunctionChecks(undefined)).toEqual([]);
    });

    it("refuses, writing nothing, an unknown Function and a limit that is not a sensible whole number", () => {
      expect(setFunctionChecks({ functionId: "nope", needsDocument: true, setBy: "x" })).toMatchObject({ refused: expect.stringContaining("No Function found") });
      for (const maxWords of [0, -5, 2.5, Number.NaN, MAX_WORD_LIMIT + 1]) {
        expect(setFunctionChecks({ functionId: reviews, needsDocument: true, maxWords, setBy: "x" })).toMatchObject({ refused: expect.stringContaining("whole number") });
      }
      expect(getFunctionChecks(reviews)).toBeUndefined();
    });

    it("is set, changed and read back from the terminal, one check at a time", () => {
      const body = (entries: readonly { body: string }[]) => entries.map((entry) => entry.body).join("\n");

      const first = body(handleUiFunctionUpdateSubcommand([reviews, "--needs-document", "on", "--as", "John Smith"]));
      expect(first).toContain("Work needs a document attached.");
      expect(getFunctionChecks(reviews)).toMatchObject({ needsDocument: true, setBy: "John Smith" });
      expect(getFunctionChecks(reviews)?.maxWords).toBeUndefined();

      // Asking only for a limit leaves "needs a document" as it was.
      const second = body(handleUiFunctionUpdateSubcommand([reviews, "--max-words", "5,000", "--as", "John Smith"]));
      expect(second).toContain("A document over 5,000 words is not taken on.");
      expect(getFunctionChecks(reviews)).toMatchObject({ needsDocument: true, maxWords: 5000 });

      expect(body(handleUiFunctionInspectSubcommand([reviews]))).toContain("Checks Arturo makes before any AI is asked:");

      body(handleUiFunctionUpdateSubcommand([reviews, "--max-words", "off"]));
      expect(getFunctionChecks(reviews)).toMatchObject({ needsDocument: true });
      expect(getFunctionChecks(reviews)?.maxWords).toBeUndefined();

      const cleared = body(handleUiFunctionUpdateSubcommand([reviews, "--needs-document", "off"]));
      expect(cleared).toContain("has no checks");
      expect(getFunctionChecks(reviews)).toBeUndefined();
      expect(body(handleUiFunctionInspectSubcommand([reviews]))).not.toContain("Checks Arturo makes");
    });

    it("refuses a limit it cannot read, and a switch that is not on or off, changing nothing", () => {
      setFunctionChecks({ functionId: reviews, needsDocument: true, maxWords: 100, setBy: "John Smith" });
      for (const bad of ["lots", "0", "-3", "2.5", "1000001", "5 000"]) {
        const result = handleUiFunctionUpdateSubcommand([reviews, "--max-words", bad, "--objective", "Changed"]);
        expect(result[0].body, bad).toContain("Nothing was changed.");
      }
      const usage = handleUiFunctionUpdateSubcommand([reviews, "--needs-document", "maybe"]);
      expect(usage[0].label).toBe("Usage");
      expect(getFunctionChecks(reviews)).toMatchObject({ needsDocument: true, maxWords: 100 });
      // The objective was not touched by the refused commands.
      expect(getBusinessFunctionDefinition(reviews)?.objective).toBe("Review manuscripts.");
    });

    it("goes when the area is removed", () => {
      setFunctionChecks({ functionId: accounts, needsDocument: true, setBy: "John Smith" });
      expect(removeBusinessFunction(accounts, enterpriseId)).toMatchObject({ ok: true });
      expect(getFunctionChecks(accounts)).toBeUndefined();
    });
  });

  describe("needs a document", () => {
    beforeEach(() => { setFunctionChecks({ functionId: reviews, needsDocument: true, setBy: "John Smith" }); });

    it("refuses work with nothing attached, before any Task exists", () => {
      const terminal = ask();
      expect(terminal.created).toBe(false);
      expect(terminal.message).toBe("Manuscript review needs a document, and none was attached, so nothing was started. Attach the document and send it again.");
      expect(listJobs()).toHaveLength(0);
    });

    it("lets work with a document through, and work in another area with none", () => {
      expect(ask({ file: file("manuscript.txt", words(10)) }).created).toBe(true);
      expect(ask({ functionId: accounts, instruction: "Reconcile the bank statement." }).created).toBe(true);
      expect(listJobs()).toHaveLength(2);
    });

    it("does not ask for a document on work that continues earlier work", () => {
      expect(refuseWorkUnderChecks({ functionId: reviews, functionLabel: "Manuscript review", documents: [], continuesEarlierWork: true })).toBeUndefined();
      expect(refuseWorkUnderChecks({ functionId: reviews, functionLabel: "Manuscript review", documents: [], continuesEarlierWork: false })).toContain("needs a document");
    });
  });

  describe("a word limit", () => {
    beforeEach(() => { setFunctionChecks({ functionId: reviews, needsDocument: false, maxWords: 10, setBy: "John Smith" }); });

    it("refuses a document over the limit, says how long it is, and starts nothing", () => {
      const outcome = ask({ file: file("The Door.txt", words(11)) });
      expect(outcome.created).toBe(false);
      expect(outcome.message).toContain("The Door.txt is 11 words. Manuscript review does not take on a document over 10 words (set by John Smith), so nothing was started.");
      expect(listJobs()).toHaveLength(0);
      expect(listArtefacts()).toHaveLength(1);
    });

    it("takes a document at the limit, and one under it", () => {
      expect(ask({ file: file("exact.txt", words(10)) }).created).toBe(true);
      expect(ask({ file: file("short.txt", words(3)) }).created).toBe(true);
      expect(listJobs()).toHaveLength(2);
    });

    it("counts the document itself, not the instruction", () => {
      const long = "Review this manuscript. ".repeat(20);
      expect(ask({ instruction: long, file: file("short.txt", words(3)) }).created).toBe(true);
    });

    it("refuses when any one of several documents is over", () => {
      const first = ask({ file: file("fine.txt", words(4)) });
      expect(first.created).toBe(true);
      const [fine] = listArtefacts();
      const outcome = createTask(["Review these.", "--function", reviews, "--enterprise", enterpriseId, "--input-artefact", `${fine.id}@1`]);
      expect(outcome.created).toBe(true);
      const long = ask({ instruction: "Review this.", file: file("long.txt", words(50)) });
      expect(long.created).toBe(false);
      const [, longDocument] = listArtefacts();
      const both = createTask(["Review both.", "--function", reviews, "--enterprise", enterpriseId, "--input-artefact", `${fine.id}@1,${longDocument.id}@1`]);
      expect(both.created).toBe(false);
      expect(both.message).toContain("long.txt is 50 words");
      expect(listJobs()).toHaveLength(2);
    });

    it("refuses, rather than lets through, a document it cannot count", () => {
      const refusal = refuseWorkUnderChecks({ functionId: reviews, functionLabel: "Manuscript review", documents: ["artefact-404@1"], continuesEarlierWork: false });
      expect(refusal).toContain("Arturo cannot count the words in artefact-404@1");
      expect(refusal).toContain("nothing was started");
    });

    it("does not apply to another area, or when no limit is set", () => {
      expect(ask({ functionId: accounts, instruction: "Reconcile.", file: file("big.txt", words(500)) }).created).toBe(true);
      setFunctionChecks({ functionId: reviews, needsDocument: true, setBy: "John Smith" });
      expect(ask({ file: file("big.txt", words(500)) }).created).toBe(true);
    });
  });

  it("applies no checks to an area that has none", () => {
    expect(ask().created).toBe(true);
    expect(ask({ file: file("big.txt", words(100000)) }).created).toBe(true);
  });
});
