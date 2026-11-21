import { copyFileSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearArtefacts,
  createArtefact,
  expandHomeDirectory,
  formatArtefactContextForWorker,
  readSuppliedArtefactTexts,
} from "./artefactStore";
import { parseArtefactReference } from "./artefact";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";

/** Registers a copy of a fixture as an Artefact, the way `/artefact add --file` does. */
function register(fixture: string): string {
  const enterprise = createAndSaveEnterprise({ name: "Docx Test Co", mission: "Read Word documents." });
  const file = join(mkdtempSync(join(tmpdir(), "arturo-docx-")), fixture);
  copyFileSync(join(__dirname, "..", "..", "scenario_harness", "assets", fixture), file);

  const artefact = createArtefact({
    enterpriseId: enterprise.id,
    name: "Draft services agreement",
    kind: "other",
    file,
    createdBy: "Principal Lawyer",
  });
  return `${artefact.id}@1`;
}

describe("a Word document supplied to a Worker", () => {
  beforeEach(() => {
    clearArtefacts();
    clearEnterprises();
  });
  afterEach(() => {
    clearArtefacts();
    clearEnterprises();
  });

  it("is shown to the Worker as its text, numbered", () => {
    const reference = parseArtefactReference(register("draft-services-agreement.docx"));
    const context = formatArtefactContextForWorker([reference]);

    expect(context).toContain("Media type: application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(context).toContain("Integrity: verified");
    expect(context).toContain("4. Liability. The Supplier's total liability under this agreement is limited to NZ$500.");
    expect(context).not.toContain("Content: not included");
  });

  it("is available to the checks made on the Worker's result", () => {
    const [text] = readSuppliedArtefactTexts([parseArtefactReference(register("draft-services-agreement.docx"))]);

    expect(text).toContain("11. Governing law. Not stated.");
  });

  it("stops the Task being built on a document that cannot be read, and says why", () => {
    const reference = register("oversized-document-part.docx");

    expect(() => formatArtefactContextForWorker([parseArtefactReference(reference)])).toThrow(
      `The Word document ${reference} could not be read because it is too large to read.`
    );
  });

  it("does not say text is missing from a short document in a large file", () => {
    // A two-paragraph article with a picture in it: the file is over the limit, its text is not.
    const context = formatArtefactContextForWorker([parseArtefactReference(register("short-text-large-file.docx"))]);

    expect(context).toContain("It has two paragraphs and nothing is missing.");
    expect(context).not.toContain("[truncated");
  });

  it("says so when a long document's text really is cut off", () => {
    const context = formatArtefactContextForWorker([parseArtefactReference(register("long-text.docx"))]);

    expect(context).toContain("Paragraph 1 of a long document");
    expect(context).not.toContain("Paragraph 1500 of a long document");
    expect(context).toContain("[truncated at 65536 bytes]");
  });
});

describe("registering a document", () => {
  beforeEach(() => {
    clearArtefacts();
    clearEnterprises();
  });
  afterEach(() => {
    clearArtefacts();
    clearEnterprises();
  });

  const add = (file: string) =>
    createArtefact({
      enterpriseId: createAndSaveEnterprise({ name: "Docx Test Co", mission: "Read Word documents." }).id,
      name: "Agreement",
      kind: "other",
      file,
      createdBy: "Principal Lawyer",
    });

  it("says in words that the file is not there", () => {
    expect(() => add("/no/such/folder/agreement.docx")).toThrow(
      "No file was found at /no/such/folder/agreement.docx. Check the folder and the file's name, including its ending (for example .docx)."
    );
  });

  it("does not use up a number on a document that was never registered", () => {
    const fixture = join(__dirname, "..", "..", "scenario_harness", "assets", "draft-services-agreement.docx");
    const first = add(fixture);

    expect(() => add("/no/such/folder/agreement.docx")).toThrow();
    const next = add(fixture);

    expect(Number(next.id.replace("artefact-", ""))).toBe(Number(first.id.replace("artefact-", "")) + 1);
  });

  it("reads a leading ~ as the home folder", () => {
    expect(expandHomeDirectory("~/agreement.docx")).toBe(join(homedir(), "agreement.docx"));
    expect(expandHomeDirectory("/tmp/~/agreement.docx")).toBe("/tmp/~/agreement.docx");
    expect(expandHomeDirectory("~other/agreement.docx")).toBe("~other/agreement.docx");
    expect(() => add("~/no-such-file-for-this-test.docx")).toThrow(
      `No file was found at ${join(homedir(), "no-such-file-for-this-test.docx")}.`
    );
  });
});

