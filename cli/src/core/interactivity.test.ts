import {
  describe,
  expect,
  it,
} from "vitest";

import {
  isInteractiveSession,
  nonInteractiveRefusal,
} from "./interactivity";

describe("isInteractiveSession", () => {
  it("is interactive on a TTY with no override", () => {
    expect(
      isInteractiveSession({}, { isTTY: true })
    ).toBe(true);
  });

  it("is non-interactive when the stream is not a TTY", () => {
    expect(
      isInteractiveSession({}, { isTTY: false })
    ).toBe(false);
    expect(
      isInteractiveSession({}, {})
    ).toBe(false);
  });

  it("is non-interactive under CI even on a TTY", () => {
    expect(
      isInteractiveSession({ CI: "true" }, { isTTY: true })
    ).toBe(false);
  });

  it("is non-interactive when ARTURO_NON_INTERACTIVE=true even on a TTY", () => {
    expect(
      isInteractiveSession({ ARTURO_NON_INTERACTIVE: "true" }, { isTTY: true })
    ).toBe(false);
  });

  it("treats non-'true' values as not overriding", () => {
    expect(
      isInteractiveSession({ CI: "false", ARTURO_NON_INTERACTIVE: "0" }, { isTTY: true })
    ).toBe(true);
  });
});

describe("nonInteractiveRefusal", () => {
  it("names the action and the alternative", () => {
    const message = nonInteractiveRefusal(
      "/enterprise create --advise",
      'Use --mission "..." instead.'
    );
    expect(message).toContain("/enterprise create --advise");
    expect(message).toContain('Use --mission');
    expect(message).toContain("ARTURO_NON_INTERACTIVE=true");
  });
});
