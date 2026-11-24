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

import { clearEventSchedules, listEventSchedules } from "../scheduling/eventScheduleStore";
import { addWorker, clearWorkers } from "../control/workers";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { ensureTestSigner } from "../testing/cliTestSetup";

/**
 * "--every weekly" is what five separate scenarios typed unprompted. It names a
 * cadence Arturo can keep but leaves out the day, and it used to be refused
 * outright — the operator's whole line thrown away over one missing word.
 */
describe("a weekly schedule typed with no day", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearEventSchedules();
    clearWorkers();
    clearStaffingAssignments();
    process.stdin.isTTY = true;
    const enterprise = createAndSaveEnterprise({
      name: "Greenline Waste",
      mission: "Collect waste.",
    });
    ensureTestSigner({ enterpriseId: enterprise.id });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:route-planning`,
      enterpriseId: enterprise.id,
      label: "Route Planning",
      objective: "Plan collection routes.",
    });
    addWorker({
      name: "Route Planner",
      kind: "ai",
      capabilities: ["llm", "planning"],
      run: function* (input: unknown) {
        return input;
      },
    });
    saveStaffingAssignment({
      businessFunctionId: definition.id,
      workerName: "Route Planner",
      role: "ai",
      rationale: "For this test.",
    });
  });

  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearEventSchedules();
    clearWorkers();
    clearStaffingAssignments();
    process.stdin.isTTY = false;
  });

  // As the tokenizer hands them over: quotes already stripped.
  const weeklyLine = [
    "add",
    "List the routes under pressure this week.",
    "--every",
    "weekly",
    "--at",
    "06:00",
    "--timezone",
    "Pacific/Auckland",
    "--function",
    "Route Planning",
  ];

  it("asks which day instead of refusing the line", async () => {
    const entries = await handleUiCommand("/schedule", weeklyLine);
    expect(entries[0].label).toBe("Which day?");
    expect(entries[0].body).toContain("Monday");
    expect(isCommandMenuActive()).toBe(true);
  });

  it("keeps every other flag the operator already typed", async () => {
    await handleUiCommand("/schedule", weeklyLine);
    await handleCommandMenuReply("5"); // friday

    const [schedule] = listEventSchedules();
    expect(schedule).toBeDefined();
    // The timezone is the one that proves the point: the guided flow never
    // collects it, so re-running that flow instead of the typed line would
    // have dropped it silently.
    expect(schedule.timezone).toBe("Pacific/Auckland");
    expect(schedule.hour).toBe(6);
    expect(schedule.minute).toBe(0);
    expect(schedule.frequency).toBe("weekly");
    expect(schedule.dayOfWeek).toBe(5);
  });

  it("takes the day by name as readily as by number", async () => {
    await handleUiCommand("/schedule", weeklyLine);
    await handleCommandMenuReply("friday");
    expect(listEventSchedules()[0]?.dayOfWeek).toBe(5);
  });

  it("still refuses a cadence Arturo cannot keep, rather than downgrading it", async () => {
    const monthly = weeklyLine.map((token) => (token === "weekly" ? "monthly" : token));
    const entries = await handleUiCommand("/schedule", monthly);
    expect(isCommandMenuActive()).toBe(false);
    expect(entries.map((entry) => entry.body).join("\n")).toContain("monthly");
    expect(listEventSchedules()).toHaveLength(0);
  });
});
