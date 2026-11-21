import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearCommandMenu,
  handleCommandMenuReply,
  handleUiCommand,
  isCommandMenuActive,
} from "./uiCommandHandlers";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

/**
 * Taken from transcript 013, where `/function start "Client Advice"` answered
 * "function not found" nine times over. The Functions that did exist were one
 * lookup away and were never offered, so a run that had already typed the
 * command correctly could only fail.
 */
describe("a typed name that matches nothing", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    process.stdin.isTTY = true;
    const enterprise = createAndSaveEnterprise({
      name: "Larkfield Software",
      mission: "Ship software.",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:support`,
      enterpriseId: enterprise.id,
      label: "Customer Support",
      objective: "Answer customers.",
    });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:research`,
      enterpriseId: enterprise.id,
      label: "Research Support",
      objective: "Investigate questions.",
    });
  });

  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    process.stdin.isTTY = false;
  });

  it("offers the Functions that do exist instead of dead-ending", async () => {
    const entries = await handleUiCommand("/function", ["start", "Client Advice"]);
    const body = entries.map((entry) => entry.body).join("\n");
    expect(body).toContain("Client Advice");
    expect(body).toContain("Customer Support");
    expect(body).toContain("Research Support");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("runs the original command against the chosen name", async () => {
    await handleUiCommand("/function", ["start", "Client Advice"]);
    const entries = (await handleCommandMenuReply("1")) ?? [];
    expect(entries.map((entry) => entry.label).join(" ")).not.toContain("not found");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("takes the name itself, not only its number", async () => {
    await handleUiCommand("/function", ["start", "Client Advice"]);
    const entries = (await handleCommandMenuReply("Research Support")) ?? [];
    expect(entries.map((entry) => entry.body).join("\n")).toContain("Research Support");
  });

  it("keeps the not-found message when there is nothing to offer", async () => {
    clearBusinessFunctionDefinitions();
    const entries = await handleUiCommand("/function", ["start", "Client Advice"]);
    expect(isCommandMenuActive()).toBe(false);
    expect(entries.map((entry) => entry.label).join(" ")).toContain("not found");
  });

  // The other two commands transcript 013 lost to the same missing name.
  it("offers the real Functions to /task create --job", async () => {
    const entries = await handleUiCommand("/task", [
      "create",
      "Review a synthetic draft advice note.",
      "--job",
      "Client Advice",
    ]);
    expect(entries.map((entry) => entry.body).join("\n")).toContain("Customer Support");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("offers the real Functions to /event rule add", async () => {
    const entries = await handleUiCommand("/event", [
      "rule",
      "add",
      "--when",
      "task.completed",
      "--job",
      "Client Advice",
      "--publish",
      "Advice ready for filing",
    ]);
    expect(entries.map((entry) => entry.body).join("\n")).toContain("Customer Support");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("offers the real Functions to /delegation request --from", async () => {
    const entries = await handleUiCommand("/delegation", [
      "request",
      "Prepare a plain-English summary.",
      "--from",
      "Client Advice",
      "--to",
      "Customer Support",
    ]);
    expect(entries.map((entry) => entry.body).join("\n")).toContain("Research Support");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("leaves a name that does match alone", async () => {
    const entries = await handleUiCommand("/function", ["start", "Customer Support"]);
    expect(isCommandMenuActive()).toBe(false);
    expect(entries.map((entry) => entry.label).join(" ")).not.toContain("not found");
  });
});
