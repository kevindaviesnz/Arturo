import { describe, expect, it } from "vitest";
import {
  formatSuggestionFailureBody,
  formatTaskSuggestions,
  parseSuggestionSelection,
  SUGGESTION_ATTEMPTS,
} from "./uiSuggestEntries";

const suggestions = [
  { title: "Draft a letter", outcome: "Draft it.", reason: "Needed.", recurring: false, requiredInputs: [] },
  { title: "Review a contract", outcome: "Review it.", reason: "Risk.", recurring: true, requiredInputs: ["the contract to review"] },
  { title: "Summarise a file", outcome: "Summarise it.", reason: "Speed.", recurring: false, requiredInputs: [] },
];

describe("formatTaskSuggestions", () => {
  it("numbers suggestions so a subset can be chosen", () => {
    const body = formatTaskSuggestions("Client Intake", suggestions);

    expect(body).toContain("1. Draft a letter");
    expect(body).toContain("2. Review a contract");
    expect(body).toContain("3. Summarise a file");
  });

  it("marks recurring work", () => {
    expect(formatTaskSuggestions("Client Intake", suggestions)).toContain(
      "Review a contract  (recurring)"
    );
  });

  it("keeps the model-output caveat visible", () => {
    expect(formatTaskSuggestions("Client Intake", suggestions)).toContain(
      "unverified model suggestions"
    );
  });

  it("explains every reply the operator can give, numbers first", () => {
    const body = formatTaskSuggestions("Client Intake", suggestions);

    // The numbered form is what the list above it invites, so it leads. Every
    // other prompt in the product ends with cancel, and this one used to
    // accept only "no".
    expect(body).toContain("1,3");
    expect(body).toContain("yes for all");
    expect(body).toContain("cancel for none");
  });
});

describe("parseSuggestionSelection", () => {
  it("treats yes as every suggestion", () => {
    expect(parseSuggestionSelection("yes", 3)).toEqual([0, 1, 2]);
  });

  it("treats no as none", () => {
    expect(parseSuggestionSelection("no", 3)).toBe("none");
  });

  it("accepts cancel, the word every other prompt takes", () => {
    expect(parseSuggestionSelection("cancel", 3)).toBe("none");
    expect(parseSuggestionSelection("CANCEL", 3)).toBe("none");
  });

  it("parses a comma-separated subset into zero-based indexes", () => {
    expect(parseSuggestionSelection("1,3", 3)).toEqual([0, 2]);
  });

  it("tolerates spacing in the list", () => {
    expect(parseSuggestionSelection(" 2 , 3 ", 3)).toEqual([1, 2]);
  });

  it("removes duplicates so a Task is not created twice", () => {
    expect(parseSuggestionSelection("2,2", 3)).toEqual([1]);
  });

  it("rejects a selection entirely outside the range", () => {
    expect(parseSuggestionSelection("9", 3)).toBe("invalid");
  });

  it("rejects unrelated text so other handlers can try it", () => {
    expect(parseSuggestionSelection("what does this mean?", 3)).toBe("invalid");
  });
});

describe("formatSuggestionFailureBody", () => {
  it("offers a direct route when the model replied but was unusable", () => {
    const body = formatSuggestionFailureBody(
      new Error("Unexpected non-whitespace character after JSON at position 352"),
      "invoicing"
    );

    expect(body).toContain(`replied ${SUGGESTION_ATTEMPTS} times`);
    expect(body).toContain('/task create "<what you want done>" --function "invoicing"');
    expect(body).not.toContain("Check that it is running");
  });

  it("blames the provider only when it could not be reached", () => {
    const body = formatSuggestionFailureBody(
      new Error("connect ECONNREFUSED 127.0.0.1:11434"),
      "invoicing"
    );

    expect(body).toContain("could not reach the model provider");
    expect(body).not.toContain("/task create");
  });
});
