import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DocxReadError, extractDocxText } from "./docxText";
import { findDocumentPreamble, findNumberedClauses } from "../agents/clauseCoverage";

const asset = (name: string): Buffer =>
  readFileSync(join(__dirname, "..", "..", "scenario_harness", "assets", name));

/**
 * The fixture is the demonstration agreement as a lawyer would have it: typed
 * in Word, its clauses numbered by Word's list numbering and not by hand, two
 * sub-clauses under clause 9, and one tracked change in clause 8.
 */
describe("extractDocxText", () => {
  const text = extractDocxText(asset("draft-services-agreement.docx"));

  it("writes out the clause numbers Word draws but does not store as text", () => {
    expect(text).toContain("1. Services. The Supplier will design and build a website");
    expect(text).toContain("4. Liability. The Supplier's total liability under this agreement is limited to NZ$500.");
    expect(text).toContain("11. Governing law. Not stated.");
  });

  it("numbers sub-clauses under their clause and keeps them with it", () => {
    expect(text).toContain(
      "9. Termination.\n   9.1 The Supplier may terminate at any time on 7 days' notice.\n   9.2 The Client may terminate only for"
    );
  });

  it("reads the document as it stands with tracked changes accepted", () => {
    expect(text).toContain("8. Payment default. Overdue amounts bear interest at 5% per month.");
    expect(text).not.toContain("2% per month");
  });

  it("decodes quotation marks and other escaped characters", () => {
    expect(text).toContain('Tidewater Design Limited ("Supplier") and Kauri Street Bakery Limited ("Client").');
  });

  it("gives the clause checks the same structure the plain-text agreement has", () => {
    const clauses = findNumberedClauses(text);
    const plain = findNumberedClauses(asset("draft-services-agreement.txt").toString("utf8"));

    expect(clauses.map((clause) => clause.heading)).toEqual(plain.map((clause) => clause.heading));
    expect(clauses[8].text).toContain("9.2 The Client may terminate only for the Supplier's unremedied material breach");
    expect(clauses[10].text).toBe("11. Governing law. Not stated.");
    expect(findDocumentPreamble(text)).toContain('Kauri Street Bakery Limited ("Client")');
  });
});

describe("a Word file that cannot be read", () => {
  const reason = (file: Buffer): string => {
    try {
      extractDocxText(file);
      return "no error";
    } catch (error) {
      expect(error).toBeInstanceOf(DocxReadError);
      return (error as Error).message;
    }
  };

  it("refuses a small file that would expand to something enormous", () => {
    const bomb = asset("oversized-document-part.docx");

    expect(bomb.length).toBeLessThan(100 * 1024);
    expect(reason(bomb)).toBe("it is too large to read");
  });

  it("says a file is not a Word document when it is not a ZIP at all", () => {
    expect(reason(Buffer.from("Plain text saved with a .docx name, long enough to hold a ZIP end record."))).toContain(
      "not a Word document"
    );
    expect(reason(Buffer.alloc(0))).toContain("not a Word document");
  });

  it("says so when the ZIP holds no document", () => {
    expect(reason(asset("no-document-part.docx"))).toBe("it is not a Word document (it has no document part)");
  });

  it("does not read past the end of a truncated file", () => {
    const whole = asset("draft-services-agreement.docx");

    expect(reason(whole.subarray(0, whole.length - 400))).toMatch(/not a Word document|damaged/);
  });
});
