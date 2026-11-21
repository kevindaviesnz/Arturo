import { describe, expect, it } from "vitest";
import {
  AUTHORSHIP_BOUNDARY,
  DATA_PROVENANCE_BOUNDARY,
  findClaimedRecordChange,
  OUTPUT_BOUNDARIES,
  RECORDS_BOUNDARY,
  findInventedSignatory,
} from "./outputBoundaries";
import { buildWorkerPrompt } from "./buildWorkerPrompt";
import { buildWorkflowStepPrompt } from "./buildWorkflowStepPrompt";

/**
 * Every builder whose output an operator could act on. A new one added here
 * without the boundaries fails this suite, which is the point: the Workflow
 * path shipped without them and produced a fabricated customer quote.
 */
const deliverableBuilders: readonly {
  readonly name: string;
  readonly build: () => string;
}[] = [
  {
    name: "buildWorkerPrompt (with archetype)",
    build: () =>
      buildWorkerPrompt(
        { name: "Quote Writer", archetype: "creator" } as never,
        "Write a quote for a bathroom installation."
      ),
  },
  {
    name: "buildWorkerPrompt (no archetype)",
    build: () =>
      buildWorkerPrompt(
        { name: "legacy" } as never,
        "Write a quote for a bathroom installation."
      ),
  },
  {
    name: "buildWorkflowStepPrompt",
    build: () =>
      buildWorkflowStepPrompt(
        "Write a detailed quote for the bathroom installation.",
        ""
      ),
  },
];

describe("output boundaries", () => {
  it.each(deliverableBuilders)(
    "$name refuses invented data",
    ({ build }) => {
      expect(build()).toContain(
        "Never invent a figure, quantity, price"
      );
    }
  );

  it.each(deliverableBuilders)(
    "$name refuses a claimed data source",
    ({ build }) => {
      expect(build()).toContain(
        "Never state or imply that anything came from records"
      );
    }
  );

  it.each(deliverableBuilders)(
    "$name refuses to commit the Enterprise",
    ({ build }) => {
      expect(build()).toContain(
        "Never commit the Enterprise to a price"
      );
    }
  );

  it.each(deliverableBuilders)(
    "$name forbids emitting money it was not given",
    ({ build }) => {
      expect(build()).toContain("never write a monetary amount");
    }
  );

  it.each(deliverableBuilders)(
    "$name says it cannot change records",
    ({ build }) => {
      expect(build()).toContain("You cannot add, change or remove any record");
    }
  );

  it.each(deliverableBuilders)(
    "$name forbids signing as Arturo",
    ({ build }) => {
      expect(build()).toContain("not as Arturo");
    }
  );
});

describe("boundary content", () => {
  it("names the phrase that appeared in the fabricated quote", () => {
    expect(DATA_PROVENANCE_BOUNDARY).toContain(
      "based on the provided records"
    );
  });

  it("refuses a caveated example price, which is still copied and sent", () => {
    expect(DATA_PROVENANCE_BOUNDARY).toContain(
      "A labelled example is still copied and sent"
    );
  });

  it("covers the commercial terms a Worker must never agree to", () => {
    for (const term of ["deposit", "warranty", "refund", "deadline"]) {
      expect(DATA_PROVENANCE_BOUNDARY).toContain(term);
    }
  });

  it("combines every boundary in order", () => {
    expect(OUTPUT_BOUNDARIES).toBe(
      `${DATA_PROVENANCE_BOUNDARY}\n${RECORDS_BOUNDARY}\n${AUTHORSHIP_BOUNDARY}`
    );
  });
});

describe("catching an invented signatory", () => {
  it("catches the line a completed guide actually ended with", () => {
    // Verbatim from a live run. The placeholder was left blank as the boundary
    // asks, and a human job title was invented around it — on a document an AI
    // Worker wrote.
    expect(
      findInventedSignatory(
        "This document was prepared by [Name], Human Researcher for BrightSky Solar, on behalf of the Enterprise."
      )
    ).toContain("Human Researcher");
  });

  it("catches a fully invented signatory and title", () => {
    expect(findInventedSignatory("Prepared by: Jane Fenwick, Senior Analyst")).toBeDefined();
    expect(findInventedSignatory("Reviewed by Dr Alan Grant, Lead Scientist")).toBeDefined();
    expect(findInventedSignatory("Signed by A. Patel, Chartered Accountant")).toBeDefined();
  });

  it("allows the signature block the boundary asks for", () => {
    // A placeholder for a person to complete is the compliant form, and the
    // previous run of the same scenario produced exactly this.
    expect(findInventedSignatory("Prepared by: [Name], [Title]")).toBeUndefined();
    expect(findInventedSignatory("Prepared by [Please fill in your name]")).toBeUndefined();
    expect(findInventedSignatory("Prepared by <name>, <role>")).toBeUndefined();
    expect(
      findInventedSignatory("Name    [Please fill in your name]\nTitle   [Please fill in your title]")
    ).toBeUndefined();
  });

  it("leaves an attribution with no title alone", () => {
    expect(findInventedSignatory("Prepared by [Name] on behalf of the Enterprise.")).toBeUndefined();
  });

  it("does not fire on prose that merely mentions a role", () => {
    // The check is for a title in apposition to an attribution, not for the
    // word "researcher" appearing in a document about research.
    expect(
      findInventedSignatory(
        "A researcher should verify each claim. Analysts often disagree about payback periods."
      )
    ).toBeUndefined();
    expect(
      findInventedSignatory("The guide was requested by the Customer Education function.")
    ).toBeUndefined();
  });

  it("does not fire on a list that happens to follow a comma", () => {
    expect(
      findInventedSignatory("Prepared by [Name], then checked against the source documents.")
    ).toBeUndefined();
  });
});

describe("a Worker asked to change a record", () => {
  const KEVIN = "I need a new client added: Joe Bloggs ABC Street 555-6789";

  it("is told it cannot, and not to write steps for software it knows nothing about", () => {
    expect(RECORDS_BOUNDARY).toContain("You cannot add, change or remove any record");
    expect(RECORDS_BOUNDARY).toContain("Do not write steps for using software you know nothing about.");
  });

  it("is caught claiming it made the change", () => {
    for (const claim of [
      "I've added Joe Bloggs to the system.",
      "I have successfully entered Joe Bloggs as a new client.",
      "Joe Bloggs has been added to your client list.",
      "We have now recorded his phone number.",
    ]) expect(findClaimedRecordChange(KEVIN, claim), claim).toBeDefined();
    expect(findClaimedRecordChange("Update Jane's phone in the system to 021 555 0102", "Done: I've updated Jane's phone.")).toBe("I've updated Jane's phone");
  });

  it("is not caught saying it could not, or when the Task asked for no change", () => {
    for (const fine of [
      "I cannot add Joe Bloggs: a person must. Name: Joe Bloggs. Address: ABC Street. Phone: 555-6789.",
      "Nothing has been added. Here are the details for you to check.",
      "I can't confirm he has been added anywhere.",
    ]) expect(findClaimedRecordChange(KEVIN, fine), fine).toBeUndefined();
    // A drafted welcome letter may say so in the business's voice; that is the letter, not a claim.
    expect(findClaimedRecordChange("Draft a welcome letter for Joe Bloggs", "Dear Joe, we have added your details to our records.")).toBeUndefined();
  });
});
