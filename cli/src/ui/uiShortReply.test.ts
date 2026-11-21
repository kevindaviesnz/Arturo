import { describe, expect, it } from "vitest";

import {
  isAffirmative,
  isNegative,
  normaliseShortReply,
} from "./uiShortReply";

describe("normaliseShortReply", () => {
  it("ignores case, surrounding space, and trailing punctuation", () => {
    expect(normaliseShortReply("  Yes!  ")).toBe("yes");
  });
});

describe("isAffirmative", () => {
  it.each(["yes", "Yes", "yep", "sure", "ok", "sounds good", "yes please."])(
    "accepts %s",
    (reply) => {
      expect(isAffirmative(reply)).toBe(true);
    }
  );

  it.each(["no", "maybe", "yes and also change the name"])(
    "does not accept %s",
    (reply) => {
      expect(isAffirmative(reply)).toBe(false);
    }
  );
});

describe("isNegative", () => {
  it.each(["no", "Nope", "nah", "no thanks", "not really"])(
    "declines %s",
    (reply) => {
      expect(isNegative(reply)).toBe(true);
    }
  );

  it("does not read an ordinary sentence as a decline", () => {
    expect(isNegative("no idea what you mean by that")).toBe(false);
  });
});
