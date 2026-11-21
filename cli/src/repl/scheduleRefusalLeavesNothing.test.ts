import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addEventScheduleFromArgs } from "./scheduleCommands";
import { clearJobs, listJobs } from "../runtime/jobQueue";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import { addWorker, clearWorkers } from "../control/workers";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";

/**
 * A refused schedule must not leave a Task behind.
 *
 * The recurrence, time and timezone were validated inside addEventSchedule,
 * which runs *after* enqueueScheduledJob. Scenario 046 used "--every weekly",
 * which is not a recurrence Arturo accepts, and the run printed "Task schedule
 * not changed" while the Tasks count went from 0 to 1: a scheduled Task with no
 * schedule that could ever fire it.
 */
describe("a schedule Arturo refuses", () => {
  beforeEach(() => {
    clearJobs();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearWorkers();
    clearStaffingAssignments();

    const enterprise = createAndSaveEnterprise({
      name: "Greenline Waste",
      mission: "Collect efficiently.",
    });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: `${enterprise.id}:route-planning`,
      enterpriseId: enterprise.id,
      label: "Route Planning",
      objective: "Frame route-planning questions.",
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
    clearJobs();
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearWorkers();
    clearStaffingAssignments();
  });

  /** The arguments the old scenario 046 typed. */
  function scheduleArgs(every: string, at = "06:00"): readonly string[] {
    return [
      "add",
      "List the routes under pressure this week.",
      "--every",
      every,
      "--at",
      at,
      "--timezone",
      "Pacific/Auckland",
      "--function",
      "Route Planning",
    ];
  }

  it("creates no Task when the recurrence is one it does not accept", () => {
    expect(() => addEventScheduleFromArgs(scheduleArgs("weekly"))).toThrow(
      /cannot repeat something/
    );
    expect(listJobs()).toHaveLength(0);
  });

  it("creates no Task when the time is unreadable", () => {
    expect(() => addEventScheduleFromArgs(scheduleArgs("daily", "half past six"))).toThrow();
    expect(listJobs()).toHaveLength(0);
  });

  it("still creates the Task and the schedule when both are good", () => {
    const schedule = addEventScheduleFromArgs(scheduleArgs("friday"));
    expect(schedule.frequency).toBe("weekly");
    expect(listJobs()).toHaveLength(1);
    // The schedule points at the Task that was created for it.
    expect(schedule.taskId).toBe(listJobs()[0].id);
  });
});
