import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readArchetypeEntry,
} from "./uiArchetypeEntries";

describe("Worker archetype entries", () => {
  it("lists every available archetype with plain-language guidance", () => {
    const entry =
      readArchetypeEntry([]);

    expect(entry.label).toBe("Worker archetypes");
    expect(entry.body).toContain("researcher");
    expect(entry.body).toContain("guardian");
    expect(entry.body).toContain("It is not a permission");
    expect(entry.body).toContain("/archetypes guardian");
    expect(entry.body).toContain('/add-ai-worker "Toy Safety Worker" --archetype guardian');
    // The removed routing switch must not reappear in a copyable example.
    expect(entry.body).not.toContain("--model local");
  });

  it("explains one archetype, including what it can do and its limits", () => {
    const entry =
      readArchetypeEntry([
        "guardian",
      ]);

    expect(entry.label).toBe("Guardian archetype");
    expect(entry.body).toContain("Best for:");
    expect(entry.body).toContain("safety");
    expect(entry.body).toContain("an approved way of reaching a person");
    expect(entry.body).toContain("Built-in limits:");
    expect(entry.body).toContain("a person's approval");
  });

  it("supports list as an optional compatibility subcommand", () => {
    expect(
      readArchetypeEntry([
        "list",
      ]).label
    ).toBe("Worker archetypes");
  });

  it("accepts the inspect subcommand grammar the other commands use", () => {
    const entry =
      readArchetypeEntry([
        "inspect",
        "operator",
      ]);

    expect(entry.label).toBe("Operator archetype");
  });

  it("returns a useful error for an unknown archetype", () => {
    const entry =
      readArchetypeEntry([
        "wizard",
      ]);

    expect(entry.label).toBe("Archetype not found");
    expect(entry.body).toContain("Unknown archetype: wizard");
    expect(entry.body).toContain("Use /archetypes to compare them.");
  });
});
