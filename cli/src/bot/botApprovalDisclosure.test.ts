import { describe, expect, it } from "vitest";

import { createApprovalChain, type ApprovalChain } from "../runtime/approvalChainStore";
import { formatApprovalChain } from "../runtime/approvalFormatter";
import { createApprovalWorkStreamEntry } from "../ui/uiApprovalEntries";
import { attributeBotApproval, BOT_OPERATOR_NAME } from "./botOperator";

/**
 * The disclosure, end to end.
 *
 * Arturo's approval chain exists to prove an accountable *person* authorised
 * consequential work. A bot satisfying that gate makes it prove something
 * weaker, which is acceptable for a demonstration only while nothing in the
 * record implies a human signed. These are the places an operator actually
 * reads an approver's name.
 */

function chainApprovedBy(worker: string): ApprovalChain {
  const chain = createApprovalChain("task-1", 1);
  chain.decisions.push({ worker, decision: "approved", timestamp: Date.now() });
  chain.status = "approved";
  return chain;
}

describe("a decision the bot signed", () => {
  it("is marked in the approval chain", () => {
    expect(formatApprovalChain(chainApprovedBy(BOT_OPERATOR_NAME))).toContain(
      "(a bot, not a person)"
    );
  });

  it("is marked in /approvals", () => {
    const body = createApprovalWorkStreamEntry(chainApprovedBy(BOT_OPERATOR_NAME)).body;
    expect(body).toContain("signed by a bot, not a person");
    expect(body).toContain(BOT_OPERATOR_NAME);
  });
});

describe("a decision a person signed", () => {
  it("is not marked in either place", () => {
    // The marker has to mean something. If it appeared on every approval it
    // would say nothing about this one.
    expect(formatApprovalChain(chainApprovedBy("Ada Fenwick"))).not.toContain("bot");
    expect(createApprovalWorkStreamEntry(chainApprovedBy("Ada Fenwick")).body).not.toContain(
      "signed by a bot"
    );
  });
});

describe("what reaches the signing code", () => {
  it("carries the bot's name, so the name is what gets signed", () => {
    // resolveApprovalCommandIdentity auto-selects the sole eligible human when
    // --as is absent. Everything above depends on the name reaching the
    // decision in the first place, and this is where that happens.
    const submitted = attributeBotApproval("/approve task-1");
    expect(submitted).toContain(`--as "${BOT_OPERATOR_NAME}"`);
    expect(BOT_OPERATOR_NAME).toContain("not a person");
  });

  it("carries the bot's name onto a result sign-off as well", () => {
    expect(attributeBotApproval("/task signoff task-1")).toBe(`/task signoff task-1 --as "${BOT_OPERATOR_NAME}"`);
    expect(attributeBotApproval('/task signoff task-1 --as "Priya"')).toBe('/task signoff task-1 --as "Priya"');
    expect(attributeBotApproval('/task setaside task-1 "Wrong."')).toBe(`/task setaside task-1 "Wrong." --as "${BOT_OPERATOR_NAME}"`);
    expect(attributeBotApproval("/task inspect task-1")).toBe("/task inspect task-1");
  });
});
