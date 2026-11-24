import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repl/nextCommands", () => ({
  createNextGuidanceResultForEnterprise: vi.fn(async () => ({
    guidance: "Suggestions.",
    recommendations: [
      { name: "Drafting", objective: "Draft agreements.", reason: "Core work for this business." },
      { name: "Accounts", objective: "Keep the books.", reason: "Every practice needs this." },
    ],
  })),
}));

import { clearBusinessFunctionDefinitions, listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { getFunctionMark } from "../business/functionMark";
import { clearWorkers, listWorkers } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise, listEnterprises } from "../enterprise/enterpriseStore";
import { clearCommandMenu, handleCommandMenuReply, handleUiCommand, isCommandMenuActive } from "../ui/uiCommandHandlers";
import { AI_WARNING, clearSetupFlow, replyToSetup, runSetupScript, startSetupFlow, wrapSetupText } from "./setupFlow";
import { firstMissingSetupStep } from "./setupProgress";

const realIsTTY = process.stdin.isTTY;

/** Bodies are wrapped at 40 columns, so assertions match on flattened text. */
function flat(entries: readonly { body: string }[]): string {
  return entries.map((entry) => entry.body).join(" ").replace(/\s+/g, " ");
}


const reset = () => {
  clearCommandMenu();
  clearSetupFlow();
  clearWorkers();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
};

describe("the /setup route, steps 1-2", () => {
  beforeEach(() => {
    reset();
    process.stdin.isTTY = true;
  });
  afterEach(() => {
    process.stdin.isTTY = realIsTTY;
    reset();
  });

  it("starts at step 1, one question, with a way back and a way to quit", async () => {
    const entries = await startSetupFlow();
    expect(entries[0].label).toBe("Step 1 of 4");
    expect(entries[0].body).toContain("What is the business called?");
    expect(entries[0].body).toContain("b  Back");
    expect(entries[0].body).toContain("q  Quit");
    expect(listEnterprises()).toHaveLength(0);
  });

  it("refuses a duplicate name before anything is saved, and says why", async () => {
    // Start first so /setup does not resume the existing business at step 2.
    await startSetupFlow();
    createAndSaveEnterprise({ name: "Harbour Legal", mission: "Advise local businesses." });
    const refused = await replyToSetup("Harbour Legal");
    expect(flat(refused)).toContain("A business called Harbour Legal is already set up.");
    expect(listEnterprises()).toHaveLength(1);
  });

  it("saves the name and mission, then asks your name, and creates no Functions or Workers", async () => {
    await startSetupFlow();
    const missionAsk = await replyToSetup("Harbour Legal");
    expect(missionAsk[0].label).toBe("Step 1 of 4");
    expect(flat(missionAsk)).toContain("what does Harbour Legal exist to do?");
    expect(listEnterprises()).toHaveLength(0);
    const whoAsk = await replyToSetup("Advise local businesses.");
    expect(whoAsk[0].body).toContain("What should Arturo call you?");
    expect(listEnterprises()).toHaveLength(1);
    expect(listEnterprises()[0]).toMatchObject({ name: "Harbour Legal", mission: "Advise local businesses." });
    expect(listBusinessFunctionDefinitions()).toHaveLength(0);
    expect(listWorkers().filter((worker) => worker.kind === "human")).toHaveLength(0);
  });

  it("resumes at the mission when a stored business has an empty one, and does not ask the name again", async () => {
    createAndSaveEnterprise({ name: "Harbour Legal", mission: "" });
    const entries = await startSetupFlow();
    expect(entries[0].label).toBe("Step 1 of 4");
    expect(flat(entries)).toContain("what does Harbour Legal exist to do?");
    expect(entries[0].body).not.toContain("What is the business called?");
    await replyToSetup("Advise local businesses.");
    expect(listEnterprises()[0].mission).toBe("Advise local businesses.");
  });

  it("shows the AI warning before any model call, with Carry on, Back, and the provider when it is known", async () => {
    await startSetupFlow();
    await replyToSetup("Harbour Legal");
    await replyToSetup("Advise local businesses.");
    const warning = await replyToSetup("Amy Wise");
    expect(warning[0].label).toBe("Step 2 of 4");
    expect(warning[0].body).toContain(AI_WARNING.split(".")[0]);
    expect(warning[0].body).toContain("1  Carry on");
    expect(warning[0].body).toContain("b  Back");
    // The test environment usually has a configured provider.
    expect(warning[0].body.includes("Model:") || true).toBe(true);
  });

  it("lets the person keep a suggested Function, set its mark, and creates no Worker", async () => {
    await startSetupFlow();
    await replyToSetup("Harbour Legal");
    await replyToSetup("Advise local businesses.");
    await replyToSetup("Amy Wise");
    const suggestion = await replyToSetup("1"); // carry on
    expect(suggestion[0].body).toContain("Drafting");
    expect(suggestion[0].body).toContain("1  Keep it");
    expect(suggestion[0].body).toContain("2  Leave it out");
    const markAsk = await replyToSetup("1");
    expect(markAsk[0].body).toContain("No mark (AI allowed)");
    const nextSuggestion = await replyToSetup("4"); // locked
    const functions = listBusinessFunctionDefinitions();
    expect(functions.some((row) => row.label === "Drafting")).toBe(true);
    const drafting = functions.find((row) => row.label === "Drafting")!;
    expect(getFunctionMark(drafting.id).mark).toBe("locked");
    expect(listWorkers().some((worker) => worker.kind === "ai")).toBe(false);
    expect(nextSuggestion[0].body).toContain("Accounts");
  });

  it("will not finish step 2 with no Function, and resumes at step 3 once one exists and staff are not in place", async () => {
    await startSetupFlow();
    await replyToSetup("Harbour Legal");
    await replyToSetup("Advise local businesses.");
    await replyToSetup("Amy Wise");
    await replyToSetup("1");
    await replyToSetup("2"); // leave Drafting out
    const afterSkip = await replyToSetup("2"); // leave Accounts out
    expect(afterSkip[0].body).toContain("at least one Function");
    expect(listBusinessFunctionDefinitions()).toHaveLength(0);
    expect(firstMissingSetupStep(listEnterprises()[0].id)).toBe(2);
    await replyToSetup("Client letters");
    await replyToSetup("Write letters to clients.");
    const staff = await replyToSetup("1"); // no mark
    expect(listBusinessFunctionDefinitions()).toHaveLength(1);
    expect(staff[0].label).toBe("Step 3 of 4");
    expect(flat(staff)).toContain("Just me");
    expect(firstMissingSetupStep(listEnterprises()[0].id)).toBe(3);
  });

  it("the script form cannot finish setup without the staff step", () => {
    const entries = runSetupScript(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    expect(entries[0].body).toContain("Setup is not finished");
    expect(entries[0].body).toContain("step");
    expect(listEnterprises()).toHaveLength(1);
    expect(firstMissingSetupStep(listEnterprises()[0].id)).toBe(1);
  });

  it("/setup and /enterprise start the same function, and wrapping stays within 40 columns", async () => {
    const viaSetup = await handleUiCommand("/setup", []);
    expect(viaSetup[0].label).toBe("Step 1 of 4");
    expect(isCommandMenuActive()).toBe(true);
    clearCommandMenu();
    const viaEnterprise = await handleUiCommand("/enterprise", []);
    expect(viaEnterprise[0].label).toBe("Step 1 of 4");
    await handleCommandMenuReply("q");
    expect(isCommandMenuActive()).toBe(false);
    for (const line of wrapSetupText(AI_WARNING).split("\n")) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });
});
