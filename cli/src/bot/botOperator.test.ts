import { describe, expect, it } from "vitest";

import {
  attributeBotApproval,
  BOT_OPERATOR_DISCLOSURE,
  BOT_OPERATOR_NAME,
  isBotOperatorName,
} from "./botOperator";

describe("naming the bot operator", () => {
  it("says what it is in the name itself", () => {
    // The name travels inside the signed decision and is shown wherever an
    // approver is shown. Anyone reading it should not have to be told.
    expect(BOT_OPERATOR_NAME).toContain("not a person");
    expect(BOT_OPERATOR_DISCLOSURE).toContain("not by a person");
  });

  it("recognises its own decisions, and nobody else's", () => {
    expect(isBotOperatorName(BOT_OPERATOR_NAME)).toBe(true);
    expect(isBotOperatorName(` ${BOT_OPERATOR_NAME} `)).toBe(true);
    expect(isBotOperatorName("Ada Fenwick")).toBe(false);
    expect(isBotOperatorName(undefined)).toBe(false);
    // Close is not the same: a real person could be called this.
    expect(isBotOperatorName("Arturo Bot")).toBe(false);
  });
});

describe("attributing an approval to the bot", () => {
  it("names the bot on a bare approval", () => {
    // Without this, resolveApprovalCommandIdentity auto-selects the sole
    // eligible human and the script's decision is signed under their name.
    expect(attributeBotApproval("/approve task-1")).toBe(
      `/approve task-1 --as "${BOT_OPERATOR_NAME}"`
    );
  });

  it("names the bot on a rejection too", () => {
    expect(attributeBotApproval("/reject task-1")).toBe(
      `/reject task-1 --as "${BOT_OPERATOR_NAME}"`
    );
  });

  it("leaves a line that already says who alone", () => {
    const line = '/approve task-1 --as "Ada Fenwick"';
    expect(attributeBotApproval(line)).toBe(line);
  });

  it("keeps the rest of the line, including a quoted reason", () => {
    expect(attributeBotApproval('/approve task-1 --reason "looks right"')).toBe(
      `/approve task-1 --reason "looks right" --as "${BOT_OPERATOR_NAME}"`
    );
  });

  it("leaves a bare /approve alone, because it opens the menu", () => {
    // Attributing it made the command malformed — it printed usage — and
    // registered the bot as a Worker for a decision that never happened.
    expect(attributeBotApproval("/approve")).toBe("/approve");
    expect(attributeBotApproval("/reject")).toBe("/reject");
  });

  it("touches nothing but approvals", () => {
    for (const line of ["/overview", "/task create", "/approvals", "yes", "1"]) {
      expect(attributeBotApproval(line)).toBe(line);
    }
  });

  it("is not fooled by case or surrounding space", () => {
    expect(attributeBotApproval("  /APPROVE task-1  ")).toBe(
      `/APPROVE task-1 --as "${BOT_OPERATOR_NAME}"`
    );
  });
});
