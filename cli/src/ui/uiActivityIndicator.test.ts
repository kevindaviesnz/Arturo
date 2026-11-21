import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_HINT_AFTER_SECONDS,
  describeActivity,
  formatActivityLine,
  startActivityIndicator,
} from "./uiActivityIndicator";

describe("describeActivity", () => {
  it("names the work for a known slow command", () => {
    expect(describeActivity("/staff --enterprise \"Koru Toys\"")).toBe(
      "Preparing a staffing proposal"
    );
  });

  it("falls back to the command name for an unmapped command", () => {
    expect(describeActivity("/timeline")).toBe("Running /timeline");
  });

  it("treats plain input as thinking", () => {
    expect(describeActivity("yes")).toBe("Thinking");
  });
});

describe("formatActivityLine", () => {
  it("shows the label and elapsed whole seconds", () => {
    expect(formatActivityLine("Working", 0, 3_400)).toContain("Working…  3s");
  });

  it("adds an interrupt hint once the command runs long", () => {
    const line = formatActivityLine(
      "Working",
      0,
      ACTIVITY_HINT_AFTER_SECONDS * 1000
    );

    expect(line).toContain("Ctrl+C to interrupt");
  });

  it("omits the interrupt hint while the command is still quick", () => {
    expect(formatActivityLine("Working", 0, 900)).not.toContain("Ctrl+C");
  });

  it("advances the spinner frame", () => {
    const first = formatActivityLine("Working", 0, 0);
    const second = formatActivityLine("Working", 1, 0);

    expect(first).not.toBe(second);
  });
});

describe("startActivityIndicator", () => {
  it("writes nothing when the stream is not a TTY", () => {
    const write = vi.fn();

    const indicator = startActivityIndicator("Working", {
      isTTY: false,
      write,
    });
    indicator.stop();

    expect(write).not.toHaveBeenCalled();
  });

  it("draws immediately and clears the line on stop", () => {
    const writes: string[] = [];

    const indicator = startActivityIndicator("Working", {
      isTTY: true,
      write: (chunk) => writes.push(chunk),
    });

    expect(writes.some((chunk) => chunk.includes("Working"))).toBe(true);

    indicator.stop();

    expect(writes.at(-1)).toContain("2K");
  });

  it("stops cleanly when called more than once", () => {
    const indicator = startActivityIndicator("Working", {
      isTTY: true,
      write: () => undefined,
    });

    indicator.stop();

    expect(() => indicator.stop()).not.toThrow();
  });
});
