import { describe, expect, it } from "vitest";
import { isClientIntakeRequest } from "./clientRequests";

describe("recognising a request to take down a new client", () => {
  it("recognises the ways people ask", () => {
    for (const said of [
      "Please add a new client",
      "I need to add a new client",
      "I'd like to add a new client. Their email is jane@example.com. Their full name is Jane Smith.",
      "Add client Jane Smith, 021 555 0101",
      "I've got a new client on the phone",
      "New client: Jane Smith, wants a lease review",
      "Can you take down a new client for me?",
      "Record a new client please",
      // Ways the first version missed.
      "I need a new client added: Joe Bloggs ABC Street 555-6789",
      "Please add Joe Bloggs as a client",
      "add Joe Bloggs to our clients",
      "Put Joe Bloggs on the client list",
    ]) expect(isClientIntakeRequest(said), said).toBe(true);
  });

  it("leaves work for a client as ordinary work", () => {
    for (const said of [
      "Draft a welcome letter for my new client Jane",
      "Review the client's lease",
      "Write to the client about the deadline",
      "New client letter template, please",
      "Summarise what the client said about the landlord",
      "",
      // Ways the first version wrongly caught.
      "Create a client onboarding checklist",
      "Set up a client intake form",
      "Add a new client section to the engagement letter template",
      "Add a clause for the client about rent reviews",
      "Add a note to the client's file",
      "We have a new client meeting tomorrow, prepare an agenda",
    ]) expect(isClientIntakeRequest(said), said).toBe(false);
  });

  it("knows the business's own word for a client", () => {
    const authors = { singular: "author", plural: "authors" };
    expect(isClientIntakeRequest("New author: Priya Shah, priya@example.com", authors)).toBe(true);
    expect(isClientIntakeRequest("Add a new author: Priya Shah, illustrator, met her at the Bologna fair", authors)).toBe(true);
    expect(isClientIntakeRequest("add Priya to our authors", authors)).toBe(true);
    expect(isClientIntakeRequest("Write to my new author about the proofs", authors)).toBe(false);
    expect(isClientIntakeRequest("Add a new author: Priya Shah")).toBe(false);
    expect(isClientIntakeRequest("I need a new patient added: Ana Reyes, 021 555 0199", { singular: "patient", plural: "patients" })).toBe(true);
  });
});
