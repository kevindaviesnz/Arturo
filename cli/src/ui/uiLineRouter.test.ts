import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  classifyUiLine,
  routeUiLine,
} from "./uiLineRouter";

import {
  clearCommandMenu,
  clearNextReview,
  clearPendingResetConfirmation,
  handleUiCommand,
  startEnterpriseMenu,
  startTaskMenu,
} from "./uiCommandHandlers";

import {
  clearAddHumanWorkerFlow,
  startAddHumanWorkerFlow,
} from "./uiAddHumanWorkerFlow";

import {
  clearPendingStaffingPlan,
  clearStaffReview,
} from "./uiStaffingEntries";

import {
  clearPendingModelState,
} from "./uiModelEntries";

import {
  clearEnterprises,
  createAndSaveEnterprise,
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  clearWorkers,
  getWorker,
} from "../control/workers";

/**
 * The precedence chain that decides what a typed line means.
 *
 * It lived inside the readline callback in lineInterface.ts and was reachable
 * nowhere else, so nothing tested it directly — an ordering mistake would have
 * shown up only as a person's reply going to the wrong place. These tests are
 * characterisation: they pin the behaviour that exists, so extracting the chain
 * for the bot driver to share cannot quietly change it.
 */
describe("routing one submitted line", () => {
  let originalIsTty: boolean | undefined;

  beforeEach(() => {
    // The guided flows are interactive-only, and this is the chain that routes
    // their replies, so the tests need a session that looks interactive.
    originalIsTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    clearAddHumanWorkerFlow();
    clearCommandMenu();
    clearPendingModelState();
    clearStaffReview();
    clearPendingStaffingPlan();
    clearNextReview();
    clearPendingResetConfirmation();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearWorkers();
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", {
      value: originalIsTty,
      configurable: true,
    });
    clearAddHumanWorkerFlow();
    clearCommandMenu();
    clearPendingModelState();
    clearStaffReview();
    clearPendingStaffingPlan();
    clearNextReview();
    clearPendingResetConfirmation();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearWorkers();
  });

  describe("classifyUiLine", () => {
    it("separates the lines the interface handles itself from the rest", () => {
      expect(classifyUiLine("")).toBe("empty");
      expect(classifyUiLine("   ")).toBe("empty");
      expect(classifyUiLine("/exit")).toBe("exit");
      expect(classifyUiLine("/quit")).toBe("exit");
      expect(classifyUiLine("/clear")).toBe("clear");
      expect(classifyUiLine("/overview")).toBe("route");
      expect(classifyUiLine("yes")).toBe("route");
    });
  });

  it("gives an open guided flow the reply, ahead of anything else", async () => {
    startAddHumanWorkerFlow();

    const named = await routeUiLine("Dana Blue");
    expect(named.route).toBe("guided-flow");
    expect(named.entries[0].label).toBe("Responsibilities:");
  });

  // The prompts stopped advertising "or type skip", the menu handler was
  // taught to take a blank reply, and the line never reached it: routeUiLine
  // only routes an "ask", and parseUiInput calls an empty line "empty". So
  // Enter did nothing at all, and "Description:" could not be left blank.
  it("gives an open guided flow an empty line as an empty answer", async () => {
    startEnterpriseMenu();
    await routeUiLine("1");
    await routeUiLine("BrightSky Solar");
    await routeUiLine("Fit rooftop solar.");

    const done = await routeUiLine("");

    expect(done.route).toBe("guided-flow");
    expect(done.entries[0].label).toBe("Enterprise created");
    expect(listEnterprises()[0].description ?? "").toBe("");
  });

  // With nothing open it claims no flow. The interface does not call this for
  // an empty line in that case — Enter there is how a blank line is typed and
  // how a paused bot run is handed back — so the unhandled entry is never
  // shown; what matters here is that no flow takes it.
  it("claims no flow for an empty line when none is open", async () => {
    const result = await routeUiLine("");

    expect(result.route).toBe("unhandled");
  });

  it("gives an open command menu a bare number", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startEnterpriseMenu();

    const picked = await routeUiLine("5");
    expect(picked.route).toBe("guided-flow");
    expect(picked.entries[0].label).toBe("Enterprises");
  });

  it("routes a real command to the command handler even while a menu is open", async () => {
    startTaskMenu();

    // A genuine command is never swallowed by a pending question: typing one
    // is how the operator says they want to do something else instead.
    const listed = await routeUiLine("/workers");
    expect(listed.route).toBe("command");
    expect(JSON.stringify(listed.entries)).toContain("Workers");
  });

  /**
   * The exception to the rule above. "/skip" instead of "skip" abandoned the
   * menu, discarded every answer already collected along with staff review,
   * next review and pending model state, and answered "The terminal UI does not
   * handle /skip yet." Every other line the operator types starts with a slash,
   * so the slip is constant — and the whole namespace behaved this way, so
   * "/cancel", "/yes" and "/1" destroyed work in progress too.
   */
  it("forgives a slash typed in front of an answer while a flow is open", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    startEnterpriseMenu();

    const picked = await routeUiLine("/5");
    expect(picked.route).toBe("guided-flow");
    expect(picked.entries[0].label).toBe("Enterprises");
  });

  it("forgives a slashed cancel rather than reporting an unsupported command", async () => {
    startTaskMenu();

    const cancelled = await routeUiLine("/cancel");
    expect(cancelled.route).toBe("guided-flow");
    expect(cancelled.entries[0].label).toBe("Cancelled");
    expect(
      JSON.stringify(cancelled.entries)
    ).not.toContain("Stopped part-way");
  });

  it("still treats a reply word as a command when nothing is waiting", async () => {
    // Outside a flow, "/skip" answers nothing and must not be invented into a
    // command that exists.
    const stray = await routeUiLine("/skip");
    expect(stray.route).toBe("command");
  });

  it("lets a reset confirmation claim a yes when no guided flow is open", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    await handleUiCommand("/reset", []);

    const confirmed = await routeUiLine("yes");
    expect(confirmed.route).toBe("confirmation");
    expect(confirmed.entries[0].label).toBe("Everything deleted");
    expect(listEnterprises()).toHaveLength(0);
  });

  it("lets an open guided flow outrank a pending reset confirmation", async () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });
    await handleUiCommand("/reset", []);
    // The operator ignores the confirmation and starts adding a person; their
    // next reply belongs to the question actually on screen.
    startAddHumanWorkerFlow();

    const claimed = await routeUiLine("Dana Blue");
    expect(claimed.route).toBe("guided-flow");
    expect(claimed.entries[0].label).toBe("Responsibilities:");
    // The stale confirmation did not fire: the business is still there.
    expect(listEnterprises()).toHaveLength(1);
  });

  it("falls back to the unhandled-input reply when nothing claims the line", async () => {
    // The entry's wording depends on how far set-up has got, so the route is
    // the part a driver can rely on: nothing claimed the line, and the operator
    // got the recovery advice rather than silence.
    const stray = await routeUiLine("what is going on");
    expect(stray.route).toBe("unhandled");
    expect(stray.entries).toHaveLength(1);
    expect(stray.entries[0].body.length).toBeGreaterThan(0);
  });

  it("carries a guided flow through to completion across several lines", async () => {
    startAddHumanWorkerFlow();

    await routeUiLine("Dana Blue");
    await routeUiLine("1");
    const done = await routeUiLine("skip");

    expect(done.route).toBe("guided-flow");
    expect(getWorker("Dana Blue")?.archetype).toBe("guardian");
  });
});
