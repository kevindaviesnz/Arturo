import { describe, it, expect } from "vitest";
import { parseCommand } from "./commandParser";

describe("commandParser", () => {
  it("parses simple command", () => {
    expect(parseCommand("/help")).toEqual({
      name: "/help",
      args: []
    });
  });

  it("parses args", () => {
    expect(parseCommand("/add worker alpha")).toEqual({
      name: "/add",
      args: ["worker", "alpha"]
    });
  });

  it("handles extra spaces", () => {
    expect(parseCommand("  /add   worker   alpha  ")).toEqual({
      name: "/add",
      args: ["worker", "alpha"]
    });
  });

  it("supports quoted strings", () => {
    expect(parseCommand('/add worker "alpha beta"')).toEqual({
      name: "/add",
      args: ["worker", "alpha beta"]
    });
  });

  it("returns null for empty input", () => {
    expect(parseCommand("   ")).toBeNull();
  });
});