import { describe, expect, it } from "vitest";
import { findFunctionLookalikes, nameStems, sameFunctionWords, sharedWorkStems, stemWord } from "./functionNames";

describe("business function names in other words", () => {
  it("cuts words back to the same stem whatever form they take", () => {
    for (const word of ["review", "reviews", "reviewing", "reviewed", "reviewer"]) expect(stemWord(word), word).toBe("review");
    for (const word of ["lease", "leases", "leasing"]) expect(stemWord(word), word).toBe("leas");
    for (const word of ["write", "writes", "writing", "writer"]) expect(stemWord(word), word).toBe("writ");
    expect(stemWord("plan")).toBe(stemWord("planning"));
    expect(stemWord("queries")).toBe("query");
    expect(stemWord("business")).toBe("business");
    expect(stemWord("status")).toBe("status");
    expect(stemWord("add")).toBe("add");
    expect(nameStems("Reader's report on the Moon Hare")).toEqual(["read", "report", "moon", "har"]);
  });

  it("says two names are the same words in any order and form, and nothing else", () => {
    expect(sameFunctionWords("Lease reviews", "Reviewing leases")).toBe(true);
    expect(sameFunctionWords("Lease review", "lease reviews")).toBe(true);
    expect(sameFunctionWords("Write book blurbs", "Book blurb writing")).toBe(true);
    expect(sameFunctionWords("Lease reviews", "Will reviews")).toBe(false);
    expect(sameFunctionWords("Accounts", "Customer accounts")).toBe(false);
    expect(sameFunctionWords("The", "A")).toBe(false);
  });

  it("finds the existing names that look like a new one, closest first", () => {
    const existing = [{ label: "Customer accounts" }, { label: "Lease reviews" }, { label: "Leave reviews" }, { label: "Manuscript reports" }];
    expect(findFunctionLookalikes("Reviewing leases", existing).map((match) => [match.definition.label, match.because])).toEqual([
      ["Lease reviews", "the same words"],
    ]);
    expect(findFunctionLookalikes("Lease reveiws", existing).map((match) => match.because)).toContain("a very similar name");
    expect(findFunctionLookalikes("Accounts", existing).map((match) => [match.definition.label, match.because])).toEqual([["Customer accounts", "a similar name"]]);
    expect(findFunctionLookalikes("Write book blurbs", existing)).toEqual([]);
    expect(findFunctionLookalikes("", existing)).toEqual([]);
  });

  it("finds the words a task shares with a business function, ignoring little ones", () => {
    expect(sharedWorkStems("Blurb for Moon Hare, please", "Write book blurbs")).toEqual(["blurb"]);
    expect(sharedWorkStems("Write a reader's report on Moon Hare", "Manuscript reports")).toEqual(["report"]);
    expect(sharedWorkStems("Check Mrs Patel's will", "Lease reviews")).toEqual([]);
  });
});
