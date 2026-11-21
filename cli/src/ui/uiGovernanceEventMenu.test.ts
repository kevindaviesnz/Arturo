import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearCommandMenu,
  handleCommandMenuReply,
  isCommandMenuActive,
  startEventMenu,
  startGovernanceMenu,
} from "./uiCommandHandlers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearJobCompletionEventRules,
  listJobCompletionEventRules,
} from "../events/jobCompletionEventRuleStore";

import {
  loadPolicyRules,
  savePolicyRules,
} from "../storage/policyRepository";

/** Finds the menu number for the option line containing `needle`. */
function optionNumber(body: string, needle: string): string {
  const line = body
    .split("\n")
    .find((candidate) => candidate.includes(needle));
  const number = line?.trim().match(/^(\d+)\./)?.[1];
  if (!number) throw new Error(`no numbered option matching: ${needle}`);
  return number;
}

/**
 * /governance and /event were the last two switch-heavy commands an operator
 * met on the normal path: writing a rule meant typing --effect, --capability,
 * --risk, and --scope, and setting up a signal meant --when/--job/--publish.
 * Typed bare they now ask for each of those in plain words.
 *
 * The menus only collect answers — every check still happens in the policy and
 * event-rule engines they delegate to.
 */
describe("guided /governance menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    savePolicyRules([]);
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    savePolicyRules([]);
  });

  it("offers add / see / remove without any switches", () => {
    const start = startGovernanceMenu();
    expect(start[0].label).toBe("Governance");
    expect(start[0].body).toContain("1. Add a rule");
    expect(start[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("writes a require-approval rule from plain answers", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startGovernanceMenu();

    const descriptionAsk = await handleCommandMenuReply("1");
    expect(descriptionAsk?.[0].label).toBe("Add a rule");

    const effectAsk = await handleCommandMenuReply("Sending email needs my approval first.");
    expect(effectAsk?.[0].label).toBe("What should happen?");
    expect(effectAsk?.[0].body).toContain("Wait for a person to say yes");
    expect(effectAsk?.[0].body).not.toContain("--effect");

    const capabilityAsk = await handleCommandMenuReply("1");
    expect(capabilityAsk?.[0].label).toBe("What does it apply to?");
    // The list is split by whether Arturo can recognise the capability in a
    // task the operator types. A rule on one it cannot will not match a typed
    // Task, and picking one unknowingly produced a rule that never fired.
    expect(capabilityAsk?.[0].body).toContain("Arturo can spot these in a task you type");
    expect(capabilityAsk?.[0].body).toContain("It will not spot these in a task you type");
    expect(capabilityAsk?.[0].body).toContain("email-send");

    const body = capabilityAsk![0].body;
    const spottable = body.indexOf("Arturo can spot these");
    const notSpottable = body.indexOf("It will not spot these");
    // "analysis" is recognisable; "email-send" is not, and must not be listed
    // among the ones that are.
    expect(body.indexOf("analysis —")).toBeGreaterThan(spottable);
    expect(body.indexOf("analysis —")).toBeLessThan(notSpottable);
    expect(body.indexOf("email-send —")).toBeGreaterThan(notSpottable);

    const riskAsk = await handleCommandMenuReply(
      optionNumber(capabilityAsk![0].body, "email-send —")
    );
    expect(riskAsk?.[0].label).toBe("Only at a certain risk level?");

    // One Enterprise, so the scope question is skipped.
    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Governance policy added");
    expect(isCommandMenuActive()).toBe(false);

    const [rule] = loadPolicyRules();
    expect(rule.effect).toBe("require-approval");
    expect(rule.match.capabilityId).toBe("email-send");
    expect(rule.match.riskLevel).toBeUndefined();
    // Enterprise scope is stored under the policy engine's "organization" type.
    expect(rule.scope?.type).toBe("organization");
  });

  it("narrows a rule to one risk level", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startGovernanceMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("High-risk shell work is refused.");
    const capabilityAsk = await handleCommandMenuReply("2"); // deny
    await handleCommandMenuReply(
      optionNumber(capabilityAsk![0].body, "shell-execute —")
    );
    const done = await handleCommandMenuReply("4"); // high

    expect(done?.[0].label).toBe("Governance policy added");
    const [rule] = loadPolicyRules();
    expect(rule.effect).toBe("deny");
    expect(rule.match.riskLevel).toBe("high");
  });

  it("asks which business, and offers every business, when there is more than one", async () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });
    startGovernanceMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Email needs approval.");
    const capabilityAsk = await handleCommandMenuReply("1"); // require approval
    const riskAsk = await handleCommandMenuReply(
      optionNumber(capabilityAsk![0].body, "email-send —")
    );
    expect(riskAsk?.[0].label).toBe("Only at a certain risk level?");

    const scopeAsk = await handleCommandMenuReply("1");
    expect(scopeAsk?.[0].label).toBe("Which business?");
    expect(scopeAsk?.[0].body).toContain("1. First Co");
    expect(scopeAsk?.[0].body).toContain("Every business on this computer");

    const done = await handleCommandMenuReply("3"); // every business → global
    expect(done?.[0].label).toBe("Governance policy added");
    expect(loadPolicyRules()[0].scope?.type).toBe("global");
  });

  it("re-asks an out-of-range effect rather than guessing", async () => {
    startGovernanceMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Something.");
    const again = await handleCommandMenuReply("9");
    expect(again?.[0].label).toBe("What should happen?");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("says there is nothing to remove when no rule exists", async () => {
    startGovernanceMenu();
    const none = await handleCommandMenuReply("3");
    expect(none?.[0].label).toBe("No rules yet");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("cancels without writing a rule", async () => {
    startGovernanceMenu();
    await handleCommandMenuReply("1");
    const cancelled = await handleCommandMenuReply("cancel");
    expect(cancelled?.[0].label).toBe("Cancelled");
    expect(loadPolicyRules()).toHaveLength(0);
  });
});

describe("guided /event menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearJobCompletionEventRules();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearJobCompletionEventRules();
  });

  function seedFunction(label: string): void {
    const enterprise =
      createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:${label.toLowerCase().replace(/\s+/g, "-")}`,
      enterpriseId: enterprise.id,
      label,
      objective: `Keep doing ${label}.`,
    });
  }

  it("offers the four things an operator can do with signals", () => {
    const start = startEventMenu();
    expect(start[0].label).toBe("Signals");
    expect(start[0].body).toContain("1. Announce that something has happened");
    expect(start[0].body).not.toContain("--");
  });

  it("sets up an automatic announcement without --when/--job/--publish", async () => {
    seedFunction("Evidence Capture");
    startEventMenu();

    // One Function, so it goes straight to what should be announced.
    const publishAsk = await handleCommandMenuReply("2");
    expect(publishAsk?.[0].label).toBe("What should it announce?");
    expect(publishAsk?.[0].body).toContain("Evidence Capture");

    const capabilityAsk = await handleCommandMenuReply("evidence-ready");
    expect(capabilityAsk?.[0].label).toBe("Only for certain work?");
    expect(capabilityAsk?.[0].body).toContain("1. Every finished task");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Event rule added");
    expect(isCommandMenuActive()).toBe(false);

    const [rule] = listJobCompletionEventRules();
    expect(rule.publishedEventLabel).toBe("evidence-ready");
    expect(rule.requiredCapability).toBeUndefined();
  });

  it("narrows an automatic announcement to one kind of work", async () => {
    seedFunction("Evidence Capture");
    startEventMenu();
    await handleCommandMenuReply("2");
    const capabilityAsk = await handleCommandMenuReply("evidence-ready");
    const done = await handleCommandMenuReply(
      optionNumber(capabilityAsk![0].body, "Only web-research work")
    );
    expect(done?.[0].label).toBe("Event rule added");
    expect(listJobCompletionEventRules()[0].requiredCapability).toBe("web-research");
  });

  it("asks which Function when more than one could trigger it", async () => {
    seedFunction("Evidence Capture");
    seedFunction("Report Writing");
    startEventMenu();

    const pick = await handleCommandMenuReply("2");
    expect(pick?.[0].label).toBe("Whose finished work should trigger it?");
    expect(pick?.[0].body).toContain("Evidence Capture (Solo Co)");
    expect(pick?.[0].body).toContain("Report Writing (Solo Co)");

    const publishAsk = await handleCommandMenuReply("2");
    expect(publishAsk?.[0].body).toContain("Report Writing");
  });

  it("removes an automatic announcement by number", async () => {
    seedFunction("Evidence Capture");
    startEventMenu();
    await handleCommandMenuReply("2");
    await handleCommandMenuReply("evidence-ready");
    await handleCommandMenuReply("1");
    expect(listJobCompletionEventRules()).toHaveLength(1);

    startEventMenu();
    const pick = await handleCommandMenuReply("4");
    expect(pick?.[0].body).toContain("evidence-ready");
    expect(pick?.[0].body).toContain("Evidence Capture");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Event rule removed");
    expect(listJobCompletionEventRules()).toHaveLength(0);
  });

  it("sends the operator to /function when there is nothing to announce from", async () => {
    startEventMenu();
    const none = await handleCommandMenuReply("1");
    expect(none?.[0].label).toBe("No Functions yet");
    expect(none?.[0].body).toContain("/function");
    expect(isCommandMenuActive()).toBe(false);
  });
});
