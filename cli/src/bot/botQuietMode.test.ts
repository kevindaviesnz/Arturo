import { describe, expect, it } from "vitest";

import { attributeBotApproval, BOT_OPERATOR_NAME } from "./botOperator";
import { parseBotArguments } from "./botArgs";

/**
 * --quiet removes the bot's narration from a session being filmed: the opening
 * banner, the closing summary, and the asides it writes about its own refusals.
 *
 * It does not touch what a decision records. Those are different things: the
 * banner is the bot describing itself, and the attribution is the product
 * saying who decided. A recording with no banner is presentation; a recording
 * where a script's approval carries a person's name is a false claim about the
 * one control Arturo exists to provide.
 */
describe("--quiet", () => {
  it("is off unless asked for", () => {
    const result = parseBotArguments(["bot", "001"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.mode.kind === "scripted") {
      expect(result.mode.quiet).toBe(false);
    }
  });

  it("is on when asked for", () => {
    const result = parseBotArguments(["bot", "001", "--quiet"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.mode.kind === "scripted") {
      expect(result.mode.quiet).toBe(true);
    }
  });

  it("still attributes an approval to the bot, quiet or not", () => {
    // The attribution is not narration and has no flag. Without it the bare
    // /approve resolves to the only eligible human, and a script's decision is
    // recorded — inside the HMAC — under that person's name.
    expect(attributeBotApproval("/approve task-1")).toContain(BOT_OPERATOR_NAME);
  });
});
