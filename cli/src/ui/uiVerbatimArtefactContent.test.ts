import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import {
  computeBodyValueColumn,
  verbatimBodyLines,
} from "./lineInterface";

import {
  clearArtefacts,
  createArtefact,
  formatArtefactContextForWorker,
  SUPPLIED_ARTEFACTS_END,
} from "../artefacts/artefactStore";

import { parseArtefactReference } from "../artefacts/artefact";

/**
 * A quoted document is shown as it is, not as Arturo would have written it.
 *
 * The body renderer turns any `Label: value` line into an aligned two-column
 * row with the colon removed. That is right for Arturo's own records and wrong
 * for the contents of a file — which are printed directly beneath "Integrity
 * verified — The local file matches the recorded SHA-256 hash".
 *
 * Seen live in scenario 051: the client brief reads "Project: single-storey
 * rear extension to a terraced house." on disk and was displayed as
 * "Project                single-storey rear extension to a terraced house."
 */
describe("quoted Artefact contents in a terminal entry", () => {
  let directory: string;

  beforeEach(() => {
    clearArtefacts();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "arturo-verbatim-"));
  });
  afterEach(() => {
    clearArtefacts();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  /** Attaches a local text file and returns its exact reference. */
  function attach(name: string, body: string): string {
    const localPath = path.join(directory, `${name}.txt`);
    fs.writeFileSync(localPath, body, "utf8");
    const artefact = createArtefact({
      enterpriseId: "enterprise-1",
      name,
      kind: "specification",
      file: localPath,
      mediaType: "text/plain",
      createdBy: "Client Liaison",
    });
    return `${artefact.id}@1`;
  }

  /** The block as an entry body would carry it. */
  function blockLines(references: readonly string[]): readonly string[] {
    return formatArtefactContextForWorker(
      references.map(parseArtefactReference)
    ).split("\n");
  }

  it("marks the file's own lines, and only those", () => {
    const reference = attach(
      "client-brief",
      ["Project: single-storey rear extension.", "Client: Sample Client."].join("\n")
    );
    const lines = blockLines([reference]);
    const verbatim = verbatimBodyLines(lines);

    const quoted = lines.filter((_, index) => verbatim[index]);
    expect(quoted).toContain("Project: single-storey rear extension.");
    expect(quoted).toContain("Client: Sample Client.");

    // Arturo's own rows in the same block stay records, and are still aligned.
    const rendered = lines.filter((_, index) => !verbatim[index]);
    expect(rendered.some((line) => line.startsWith("Reference: "))).toBe(true);
    expect(rendered.some((line) => line.startsWith("Review: "))).toBe(true);
    expect(rendered).toContain("Supplied Artefacts");
    expect(rendered).toContain(SUPPLIED_ARTEFACTS_END);
  });

  it("keeps two files apart across the --- between them", () => {
    const first = attach("brief", "Project: an extension.");
    const second = attach("comments", "Reviewed: the specification.");
    const lines = blockLines([first, second]);
    const verbatim = verbatimBodyLines(lines);
    const quoted = lines.filter((_, index) => verbatim[index]);

    expect(quoted).toContain("Project: an extension.");
    expect(quoted).toContain("Reviewed: the specification.");
    // The separator itself is Arturo's, not either document's.
    expect(quoted).not.toContain("---");
    // And the second file's metadata is a record again, not quoted.
    const secondReference = `Reference: ${second}`;
    expect(lines.filter((_, i) => !verbatim[i])).toContain(secondReference);
  });

  it("stops quoting after the block, so the result is formatted again", () => {
    const reference = attach("brief", "Project: an extension.");
    const lines = [
      "Instruction: Analyse the brief.",
      "",
      ...blockLines([reference]),
      "",
      "Evidence status: UNVERIFIED MODEL SYNTHESIS",
      "External tools used: none",
    ];
    const verbatim = verbatimBodyLines(lines);
    const quoted = lines.filter((_, index) => verbatim[index]);

    expect(quoted).toContain("Project: an extension.");
    // What follows the block is Arturo's and the Worker's, not the file's.
    expect(quoted).not.toContain("Evidence status: UNVERIFIED MODEL SYNTHESIS");
    expect(quoted).not.toContain("External tools used: none");
    expect(quoted).not.toContain("Instruction: Analyse the brief.");
  });

  it("does not let a document's words set the gutter for Arturo's rows", () => {
    // A file label longer than any of Arturo's used to widen every real row to
    // fit it — which is exactly what pushed "Reference" and "Review" out to a
    // gutter sized by the client brief's own wording.
    const reference = attach(
      "brief",
      "Stated budget and scope: not disclosed at this stage."
    );
    const lines = blockLines([reference]);

    const withQuoting = computeBodyValueColumn(lines);
    const ifQuotedLinesCounted = computeBodyValueColumn(
      lines,
      lines.map(() => false)
    );

    expect(withQuoting).toBeLessThan(ifQuotedLinesCounted);
  });

  it("treats a Task stored before the end marker as quoted to the end", () => {
    // Old records have no terminator. Quoting too much costs an alignment;
    // quoting too little would restyle a document, so this is the safe way
    // round.
    const reference = attach("brief", "Project: an extension.");
    const lines = blockLines([reference]).filter(
      (line) => line.trim() !== SUPPLIED_ARTEFACTS_END
    );
    const verbatim = verbatimBodyLines([...lines, "Evidence status: none"]);

    expect(verbatim[verbatim.length - 1]).toBe(true);
  });

  it("leaves a body with no Artefacts entirely alone", () => {
    const lines = [
      "Worker: Design Documentation Analyst",
      "Status: Completed",
      "Content:",
      "Project: this is not inside a block, so it is a record",
    ];
    expect(verbatimBodyLines(lines).every((flag) => !flag)).toBe(true);
  });
});

/**
 * A Human Task's instructions are the operator's own sentence, and the body
 * renderer treats "<=32 chars>: rest" as a label and a value and deletes the
 * colon. "Examine the instrument in person: the grain, the varnish..." reached
 * the screen with the colon gone, while /human-tasks rendered the same text
 * correctly -- two views disagreeing about what was typed.
 */
describe("quoted operator prose", () => {
  it("marks a Human Task's instructions verbatim", () => {
    const lines = [
      "Human task created  human-task-1",
      "",
      "Purpose",
      "Only a person can physically examine an instrument.",
      "",
      "Instructions:",
      "Examine the instrument in person: the grain, the varnish and the seams.",
      "",
      "Commands",
    ];

    const verbatim = verbatimBodyLines(lines);

    expect(verbatim[6]).toBe(true);
    // The heading itself is Arturo's, and so is everything after the field.
    expect(verbatim[5]).toBe(false);
    expect(verbatim[8]).toBe(false);
  });

  it("leaves an ordinary record line alignable", () => {
    const lines = [
      "Human task  human-task-1",
      "Status      open",
    ];

    expect(verbatimBodyLines(lines)).toEqual([false, false]);
  });
});
