import { describe, expect, it } from "vitest";
import {
  buildTaskSuggestionPrompt,
  containsPlaceholder,
  needsSuppliedRecords,
  parseTaskSuggestions,
  unsupportedExternalAction,
} from "./taskSuggestionAdvisor";

const context = {
  enterpriseName: "Harbour Legal",
  mission: "Run a sole legal practice well.",
  functionLabel: "Client Intake",
  functionObjective: "Turn enquiries into properly scoped engagements.",
  staffedCapabilities: ["analysis", "drafting"],
};

describe("buildTaskSuggestionPrompt", () => {
  it("includes the Enterprise, Function, and staffed capabilities", () => {
    const prompt = buildTaskSuggestionPrompt(context);

    expect(prompt).toContain("Harbour Legal");
    expect(prompt).toContain("Client Intake");
    expect(prompt).toContain("Turn enquiries into properly scoped engagements.");
    expect(prompt).toContain("- analysis");
    expect(prompt).toContain("- drafting");
  });

  it("constrains suggestions to what the Workers can actually do", () => {
    const prompt = buildTaskSuggestionPrompt(context);

    expect(prompt).toContain("cannot browse, email, phone, file");
    expect(prompt).toMatch(/Do not invent laws, cases, prices/);
  });

  it("records when no capabilities are staffed rather than omitting the section", () => {
    expect(
      buildTaskSuggestionPrompt({ ...context, staffedCapabilities: [] })
    ).toContain("(none recorded)");
  });
});

describe("parseTaskSuggestions", () => {
  const valid = JSON.stringify({
    suggestions: [
      {
        title: "Draft an engagement letter template",
        outcome: "Draft a reusable engagement letter template.",
        reason: "Every new client needs one.",
        recurring: false,
      },
    ],
  });

  it("parses a valid response", () => {
    const [suggestion] = parseTaskSuggestions(valid);

    expect(suggestion.title).toBe("Draft an engagement letter template");
    expect(suggestion.recurring).toBe(false);
  });

  it("tolerates markdown fences around the JSON", () => {
    expect(
      parseTaskSuggestions("```json\n" + valid + "\n```")
    ).toHaveLength(1);
  });

  it("defaults recurring to false when the model omits it", () => {
    const [suggestion] = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [{ title: "T", outcome: "O", reason: "R" }],
      })
    );

    expect(suggestion.recurring).toBe(false);
  });

  it("rejects a response with no suggestions rather than returning nothing", () => {
    expect(() =>
      parseTaskSuggestions(JSON.stringify({ suggestions: [] }))
    ).toThrow(/no suggestions/i);
  });

  it("rejects a suggestion missing its outcome", () => {
    expect(() =>
      parseTaskSuggestions(
        JSON.stringify({ suggestions: [{ title: "T", reason: "R" }] })
      )
    ).toThrow();
  });

  it("rejects a response that is not an object", () => {
    expect(() => parseTaskSuggestions("[]")).toThrow();
  });

  it("drops fill-in templates but keeps the usable suggestions", () => {
    const parsed = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [
          { title: "Welcome letter", outcome: "Draft a letter for Client Name: [[]]" },
          { title: "Case summary", outcome: "Summarise the current case file." },
        ],
      })
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Case summary");
  });

  it("fails when every suggestion is a template rather than showing blanks", () => {
    expect(() =>
      parseTaskSuggestions(
        JSON.stringify({
          suggestions: [
            { title: "A", outcome: "Fill in [[ ]]" },
            { title: "B", outcome: "Enter {{value}} here" },
          ],
        })
      )
    ).toThrow(/template|no usable suggestions/i);
  });

  it("collapses a multi-line outcome onto one line", () => {
    const [suggestion] = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [
          { title: "T", outcome: "Draft a letter.\n\n  Include the fee basis." },
        ],
      })
    );

    expect(suggestion.outcome).toBe("Draft a letter. Include the fee basis.");
  });

  it("captures what the operator must supply", () => {
    const [suggestion] = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [
          {
            title: "Review",
            outcome: "Review the supplied contract and list negotiation points.",
            requiredInputs: ["the contract to review", "  "],
          },
        ],
      })
    );

    expect(suggestion.requiredInputs).toEqual(["the contract to review"]);
  });

  it("defaults requiredInputs to empty when the model omits it", () => {
    const [suggestion] = parseTaskSuggestions(
      JSON.stringify({ suggestions: [{ title: "T", outcome: "Do it." }] })
    );

    expect(suggestion.requiredInputs).toEqual([]);
  });
});

describe("containsPlaceholder", () => {
  it.each([
    "Client Name: [[]]",
    "Enter {{name}}",
    "Draft for [CLIENT NAME]",
    "Summarise the key terms of the [contract to review]",
    "Send to <client email>",
    "Name: ___",
  ])("detects %s as a template", (value) => {
    expect(containsPlaceholder(value)).toBe(true);
  });

  it("does not flag ordinary prose", () => {
    expect(
      containsPlaceholder("Review the supplied contract and list its risks.")
    ).toBe(false);
  });

  it("does not flag a numeric citation marker", () => {
    expect(
      containsPlaceholder("Review the agreement [1] and list its risks.")
    ).toBe(false);
  });
});

describe("unsupportedExternalAction", () => {
  it("flags sending email when no email capability is staffed", () => {
    expect(
      unsupportedExternalAction(
        "Send an email to the client summarising progress on their case.",
        ["analysis", "review"]
      )
    ).toBe("send email");
  });

  it("allows it once an email capability is staffed", () => {
    expect(
      unsupportedExternalAction(
        "Send an email to the client summarising progress on their case.",
        ["analysis", "email"]
      )
    ).toBeUndefined();
  });

  it("flags web research when the capability is absent", () => {
    expect(
      unsupportedExternalAction(
        "Research the latest case law online and summarise it.",
        ["analysis"]
      )
    ).toBe("search the web");
  });

  it("does not flag ordinary drafting work", () => {
    expect(
      unsupportedExternalAction(
        "Draft a client welcome letter outlining the practice's process.",
        ["analysis"]
      )
    ).toBeUndefined();
  });
});

describe("parseTaskSuggestions capability filtering", () => {
  it("drops a suggestion that needs a capability no Worker holds", () => {
    const parsed = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [
          { title: "Email update", outcome: "Send an email to the client with an update." },
          { title: "Draft letter", outcome: "Draft a client welcome letter." },
        ],
      }),
      ["analysis"]
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Draft letter");
  });

  it("fails closed when no capabilities are known", () => {
    // An unknown capability set is treated as holding nothing, so an external
    // action is refused rather than proposed on the assumption it will work.
    expect(() =>
      parseTaskSuggestions(
        JSON.stringify({
          suggestions: [
            { title: "Email update", outcome: "Send an email to the client with an update." },
          ],
        })
      )
    ).toThrow(/no usable suggestions/i);
  });
});

describe("needsSuppliedRecords", () => {
  it.each([
    "Create a report listing all slow-moving books with quantity in stock.",
    "Compile sales data for the past six months.",
    "Reconcile the current inventory against the supplier orders.",
    "Tally all outstanding invoices.",
  ])("detects %s as needing the Enterprise's records", (outcome) => {
    expect(needsSuppliedRecords(outcome)).toBe(true);
  });

  it("does not flag work that needs only judgement", () => {
    expect(
      needsSuppliedRecords(
        "Draft a checklist for deciding whether a title should be returned."
      )
    ).toBe(false);
  });
});

describe("parseTaskSuggestions record-dependency filtering", () => {
  const bulkReport = {
    title: "Slow-moving stock report",
    outcome: "Create a report listing all slow-moving books with quantity in stock.",
  };

  it("drops a records-based Task that declares no inputs", () => {
    expect(() =>
      parseTaskSuggestions(
        JSON.stringify({ suggestions: [bulkReport] }),
        ["analysis"]
      )
    ).toThrow(/no usable suggestions/i);
  });

  it("keeps the same Task once it declares the records it needs", () => {
    const parsed = parseTaskSuggestions(
      JSON.stringify({
        suggestions: [
          { ...bulkReport, requiredInputs: ["the current stock list"] },
        ],
      }),
      ["analysis"]
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].requiredInputs).toEqual(["the current stock list"]);
  });

  it("keeps judgement-only work untouched", () => {
    expect(
      parseTaskSuggestions(
        JSON.stringify({
          suggestions: [
            {
              title: "Return criteria",
              outcome: "Draft a checklist for deciding whether a title should be returned.",
            },
          ],
        }),
        ["analysis"]
      )
    ).toHaveLength(1);
  });
});

