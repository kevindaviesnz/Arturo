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
  startDelegationMenu,
  startMemoryMenu,
} from "./uiCommandHandlers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  attachRuntimeToBusinessFunctionDefinition,
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  clearDelegationRequests,
} from "../delegation/delegationStore";

import {
  clearOperationalMemory,
  listAllOperationalMemory,
} from "../memory/operationalMemoryStore";

/**
 * Writing a note used to need --scope with an exact Enterprise or Function
 * reference, and handing work over needed --from and --to. Both now ask, and
 * offer only the answers the underlying runtime would accept.
 */
describe("guided /memory menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearOperationalMemory();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearOperationalMemory();
  });

  it("offers write / see / remove without any switches", () => {
    const start = startMemoryMenu();
    expect(start[0].label).toBe("What Arturo remembers");
    expect(start[0].body).toContain("1. Write a note down");
    // The middle option has to say "memory" somewhere. It read "See what is
    // written down", which describes the right thing without ever naming it,
    // so /memory looked like a command that answers with a menu rather than
    // with what is stored.
    expect(start[0].body).toContain("2. Show me everything in memory");
    expect(start[0].body).toContain("3. Remove a note");
    expect(start[0].body).not.toContain("--");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("writes a note against a Function picked by number", async () => {
    const enterprise = createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:writing`,
      enterpriseId: enterprise.id,
      label: "Customer Writing",
      objective: "Write to customers.",
    });

    startMemoryMenu();
    const textAsk = await handleCommandMenuReply("1");
    expect(textAsk?.[0].label).toBe("Write something down");

    const scopeAsk = await handleCommandMenuReply("Our house style is short sentences and no jargon.");
    expect(scopeAsk?.[0].label).toBe("Where does it apply?");
    expect(scopeAsk?.[0].body).toContain("Customer Writing");
    expect(scopeAsk?.[0].body).toContain("Solo Co");
    expect(scopeAsk?.[0].body).toContain("Everything on this computer");
    expect(scopeAsk?.[0].body).not.toContain("--scope");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Operational Memory added");
    expect(isCommandMenuActive()).toBe(false);

    const [entry] = listAllOperationalMemory();
    expect(entry.content).toContain("short sentences");
    // Human-entered notes stay marked as assertions, not verified evidence.
    expect(entry.source).toBe("manual");
  });

  it("files a note against everything when nothing else exists", async () => {
    startMemoryMenu();
    await handleCommandMenuReply("1");
    const done = await handleCommandMenuReply("Always label uncertainty.");

    expect(done?.[0].label).toBe("Operational Memory added");
    expect(listAllOperationalMemory()[0].scopeId).toBe("global");
  });

  it("removes a note picked by number", async () => {
    startMemoryMenu();
    await handleCommandMenuReply("1");
    await handleCommandMenuReply("Always label uncertainty.");
    expect(listAllOperationalMemory()).toHaveLength(1);

    startMemoryMenu();
    const pick = await handleCommandMenuReply("3");
    expect(pick?.[0].body).toContain("Always label uncertainty.");

    const done = await handleCommandMenuReply("1");
    expect(done?.[0].label).toBe("Operational Memory removed");
    expect(listAllOperationalMemory()).toHaveLength(0);
  });

  it("says there is nothing to remove when no note exists", async () => {
    startMemoryMenu();
    const none = await handleCommandMenuReply("3");
    expect(none?.[0].label).toBe("Nothing written down yet");
    expect(isCommandMenuActive()).toBe(false);
  });
});

describe("guided /delegation menu", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    clearDelegationRequests();
  });
  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearBusinessFunctions();
    clearDelegationRequests();
  });

  function seedFunctions(
    enterpriseName: string,
    labels: readonly string[]
  ): void {
    const enterprise =
      createAndSaveEnterprise({ name: enterpriseName, mission: "Mission." });
    for (const label of labels) {
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:${label.toLowerCase().replace(/\s+/g, "-")}`,
        enterpriseId: enterprise.id,
        label,
        objective: `Keep doing ${label}.`,
      });
    }
  }

  /** Puts a Function into the running state, as /function start would. */
  function startFunction(label: string, runtimeId: string): void {
    attachRuntimeToBusinessFunctionDefinition(label, runtimeId);
    saveBusinessFunction({
      id: runtimeId,
      label,
      objective: `Keep doing ${label}.`,
      ownerWorker: "Enquiry Assistant",
      refinements: [],
      state: "running",
      jobIds: [],
    });
  }

  it("offers hand-over / see / look-at without any switches", () => {
    const start = startDelegationMenu();
    expect(start[0].label).toBe("Handing work between Functions");
    expect(start[0].body).not.toContain("--");
  });

  it("asks who needs help, who does it, and what the work is", async () => {
    seedFunctions("Solo Co", ["Client Intake", "Legal Research"]);
    startFunction("Legal Research", "runtime-legal");
    startDelegationMenu();

    const fromAsk = await handleCommandMenuReply("1");
    expect(fromAsk?.[0].label).toBe("Which Function needs the help?");
    expect(fromAsk?.[0].body).toContain("Client Intake (Solo Co)");

    const toAsk = await handleCommandMenuReply("1");
    expect(toAsk?.[0].label).toContain("Client Intake");
    // The asking Function is not offered as its own receiver.
    expect(toAsk?.[0].body).not.toContain("1. Client Intake");
    expect(toAsk?.[0].body).toContain("Legal Research");

    const workAsk = await handleCommandMenuReply("1");
    expect(workAsk?.[0].label).toBe("What is being handed over?");
    expect(workAsk?.[0].body).toContain("Legal Research");
    expect(workAsk?.[0].body).toContain("Client Intake");

    const done = await handleCommandMenuReply("Check whether the supplied contract has a termination clause.");
    expect(isCommandMenuActive()).toBe(false);
    expect(done?.[0].label).toBe("Delegation requested");
  });

  it("refuses to start when there is only one Function", async () => {
    seedFunctions("Solo Co", ["Client Intake"]);
    startDelegationMenu();
    const none = await handleCommandMenuReply("1");
    expect(none?.[0].label).toBe("Not enough Functions");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("does not offer a Function from another business as the receiver", async () => {
    seedFunctions("First Co", ["Client Intake"]);
    seedFunctions("Second Co", ["Legal Research"]);
    startFunction("Legal Research", "runtime-legal");
    startDelegationMenu();
    await handleCommandMenuReply("1");

    const result = await handleCommandMenuReply("1"); // Client Intake (First Co)
    expect(result?.[0].label).toBe("No other Function in this business");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("will not offer a Function that has not been started", async () => {
    seedFunctions("Solo Co", ["Client Intake", "Legal Research"]);
    startDelegationMenu();
    await handleCommandMenuReply("1");

    const refused = await handleCommandMenuReply("1"); // Client Intake
    expect(refused?.[0].label).toBe("Nothing is running to take it");
    expect(refused?.[0].body).toContain("/function start");
    expect(isCommandMenuActive()).toBe(false);
  });

  it("says there is nothing to look at before anything is handed over", async () => {
    startDelegationMenu();
    const none = await handleCommandMenuReply("3");
    expect(none?.[0].label).toBe("No handovers yet");
  });
});
