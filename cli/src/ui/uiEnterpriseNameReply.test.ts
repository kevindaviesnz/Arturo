import { describe, expect, it } from "vitest";
import {
  extractNameCandidate,
  formatNameConfirmationPrompt,
  interpretEnterpriseNameReply,
} from "./uiEnterpriseNameReply";

describe("interpretEnterpriseNameReply", () => {
  it("accepts a bare name directly", () => {
    expect(interpretEnterpriseNameReply("Marlowe Books")).toEqual({
      kind: "name",
      name: "Marlowe Books",
    });
  });

  it("accepts a longer but still name-shaped reply", () => {
    expect(
      interpretEnterpriseNameReply("Marlowe Books and Coffee House")
    ).toEqual({
      kind: "name",
      name: "Marlowe Books and Coffee House",
    });
  });

  it("does not store a whole sentence as the name", () => {
    const result = interpretEnterpriseNameReply(
      "It's already called Marlowe Books"
    );

    expect(result.kind).toBe("needs-confirmation");
    expect(result.kind === "needs-confirmation" && result.candidate).toBe(
      "Marlowe Books"
    );
  });

  it.each([
    "we're called Marlowe Books",
    "the name is Marlowe Books",
    "call it Marlowe Books",
    "It is Marlowe Books",
  ])("extracts the name from %s", (reply) => {
    const result = interpretEnterpriseNameReply(reply);

    expect(result.kind === "needs-confirmation" && result.candidate).toBe(
      "Marlowe Books"
    );
  });

  it("strips surrounding quotes from a bare name", () => {
    expect(interpretEnterpriseNameReply('"Marlowe Books"')).toEqual({
      kind: "name",
      name: "Marlowe Books",
    });
  });

  it("asks again when nothing name-shaped can be recovered", () => {
    const result = interpretEnterpriseNameReply(
      "I don't know, what do you think would work best for a bookshop?"
    );

    expect(result.kind).toBe("needs-confirmation");
    expect(result.kind === "needs-confirmation" && result.candidate).toBe("");
  });

  it("treats a reply ending in a full stop as prose", () => {
    expect(interpretEnterpriseNameReply("Marlowe Books.").kind).toBe(
      "needs-confirmation"
    );
  });
});

describe("extractNameCandidate", () => {
  it("removes trailing punctuation", () => {
    expect(extractNameCandidate("Marlowe Books!")).toBe("Marlowe Books");
  });

  it("leaves an ordinary name untouched", () => {
    expect(extractNameCandidate("Marlowe Books")).toBe("Marlowe Books");
  });
});

describe("formatNameConfirmationPrompt", () => {
  it("quotes the candidate it intends to use", () => {
    expect(formatNameConfirmationPrompt("Marlowe Books")).toContain(
      '"Marlowe Books"'
    );
  });

  it("asks for the name alone when there is no candidate", () => {
    expect(formatNameConfirmationPrompt("")).toContain(
      "type just the name"
    );
  });

  it("keeps every way out visible when re-prompting with a standing suggestion", () => {
    // The re-prompt may be three exchanges past the original question, so it
    // must restate the "yes" option, the type-a-name option, and cancel —
    // a walkthrough looped on a bare "type just the name" with no exit named.
    const prompt = formatNameConfirmationPrompt("", "SmileSync");
    expect(prompt).toContain('"SmileSync"');
    expect(prompt).toContain('"yes"');
    expect(prompt).toContain('"cancel"');
  });

  it("still names cancel when there is no standing suggestion", () => {
    expect(formatNameConfirmationPrompt("")).toContain('"cancel"');
  });
});
