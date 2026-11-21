import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearOperationalMemory,
  listOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  addOperationalMemoryEntryFromArgs,
  createMemoryUsageEntry,
  handleUiMemoryCommand,
  readOperationalMemoryEntry,
  formatOperationalMemoryWithProvenance,
} from "./uiMemoryEntries";

describe("uiMemoryEntries", () => {
  beforeEach(() => {
    clearOperationalMemory();
  });

  it("creates a UI entry for Operational Memory", () => {
    expect(
      readOperationalMemoryEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Operational Memory",
      body: [
        "Operational Memory",
        "",
        "No operational memory.",
      ].join("\n"),
    });
  });

  it("shows memory provenance and verification status", () => {
    addOperationalMemoryEntryFromArgs(["Customer prefers SMS reminders.", "--scope", "global"]);
    const body = formatOperationalMemoryWithProvenance(listOperationalMemory());
    expect(body).toContain("ID:");
    expect(body).toContain("Scope: global");
    expect(body).toContain("Source: manual");
    expect(body).toContain("A person typed this in. Nobody has checked it");
    expect(body).toContain("Given to Workers: Yes");
  });

  it("creates a usage entry", () => {
    expect(
      createMemoryUsageEntry()
    ).toEqual({
      actor: "Arturo",
      label: "Usage",
      body: [
        "Usage:",
        "  /memory",
        '  /memory add "<entry>" --scope "<enterprise-or-function|global>"',
        "  /memory remove <memory-id>",
      ].join("\n"),
    });
  });

  it("adds Operational Memory from args", () => {
    expect(
      addOperationalMemoryEntryFromArgs([
        "Customer prefers SMS reminders.",
        "--scope",
        "global",
      ])
    ).toEqual({
      actor: "Arturo",
      label: "Operational Memory added",
      body: [
        "✓ Operational Memory added",
        "",
        "Customer prefers SMS reminders.",
      ].join("\n"),
    });

    expect(
      listOperationalMemory().map(
        (entry) =>
          entry.content
      )
    ).toEqual([
      "Customer prefers SMS reminders.",
    ]);
  });

  it("returns usage when adding empty Operational Memory", () => {
    expect(
      addOperationalMemoryEntryFromArgs([])
    ).toEqual(
      createMemoryUsageEntry()
    );
  });

  it("handles /memory display", () => {
    expect(
      handleUiMemoryCommand([])
    ).toEqual(
      readOperationalMemoryEntry()
    );
  });

  it("handles /memory add", () => {
    expect(
      handleUiMemoryCommand([
        "add",
        "Reminder effectiveness improved at 9:00 AM.",
        "--scope",
        "global",
      ])
    ).toEqual({
      actor: "Arturo",
      label: "Operational Memory added",
      body: [
        "✓ Operational Memory added",
        "",
        "Reminder effectiveness improved at 9:00 AM.",
      ].join("\n"),
    });
  });

  it("returns usage for unknown memory subcommands", () => {
    expect(
      handleUiMemoryCommand([
        "unknown",
      ])
    ).toEqual(
      createMemoryUsageEntry()
    );
  });
});
