import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearOperationalMemory,
} from "../memory/operationalMemoryStore";

import {
  formatOperationalMemory,
  formatOperationalMemoryAdded,
  handleMemoryCommand,
} from "./memoryCommands";

describe("memoryCommands", () => {
  beforeEach(() => {
    clearOperationalMemory();
    vi.restoreAllMocks();
  });

  it("formats empty Operational Memory", () => {
    expect(
      formatOperationalMemory([])
    ).toBe(
      [
        "Operational Memory",
        "",
        "No operational memory.",
      ].join("\n")
    );
  });

  it("formats Operational Memory entries", () => {
    expect(
      formatOperationalMemory([
        {
          id: "memory-1",
          scopeId: "global",
          content: "Customer prefers SMS reminders.",
          source: undefined,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "memory-2",
          scopeId: "global",
          content: "Reminder effectiveness improved at 9:00 AM.",
          source: undefined,
          createdAt: 2,
          updatedAt: 2,
        },
      ])
    ).toBe(
      [
        "Operational Memory",
        "",
        "Customer prefers SMS reminders.",
        "",
        "Reminder effectiveness improved at 9:00 AM.",
      ].join("\n")
    );
  });

  it("prints honest empty Operational Memory", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleMemoryCommand();

    expect(
      log
    ).toHaveBeenCalledWith(
      [
        "Operational Memory",
        "",
        "No operational memory.",
      ].join("\n")
    );
  });

  it("formats added Operational Memory", () => {
  expect(
    formatOperationalMemoryAdded({
      id: "memory-1",
      scopeId: "global",
      content: "Customer prefers SMS reminders.",
      source: "manual",
      createdAt: 1,
      updatedAt: 1,
    })
  ).toBe(
    [
      "✓ Operational Memory added",
      "",
      "Customer prefers SMS reminders.",
    ].join("\n")
  );
});

it("prints usage for empty memory add", () => {
  const log =
    vi.spyOn(
      console,
      "log"
    ).mockImplementation(
      () => undefined
    );

  handleMemoryCommand([
    "add",
  ]);

  expect(
    log
  ).toHaveBeenCalledWith(
    'Usage: /memory add "<entry>"'
  );
});

it("adds manual Operational Memory", () => {
  const log =
    vi.spyOn(
      console,
      "log"
    ).mockImplementation(
      () => undefined
    );

  handleMemoryCommand([
    "add",
    "Customer prefers SMS reminders.",
  ]);

  expect(
    log
  ).toHaveBeenCalledWith(
    [
      "✓ Operational Memory added",
      "",
      "Customer prefers SMS reminders.",
    ].join("\n")
  );
});
  
});
