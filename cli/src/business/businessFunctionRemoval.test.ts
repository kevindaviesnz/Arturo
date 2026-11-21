import { beforeEach, describe, expect, it } from "vitest";
import { removeBusinessFunction, resolveRemovableFunction } from "./businessFunctionRemoval";
import { createBusinessFunctionDefinition } from "./businessFunctionDefinition";
import {
  clearBusinessFunctionDefinitions,
  saveBusinessFunctionDefinition,
} from "./businessFunctionDefinitionStore";
import { clearStaffingAssignments, listStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { clearJobs, enqueueJob } from "../runtime/jobQueue";

const define = (
  id: string,
  label: string,
  runtimeId?: string
) =>
  saveBusinessFunctionDefinition(
    createBusinessFunctionDefinition({
      id,
      enterpriseId: "enterprise-1",
      label,
      objective: "An ongoing responsibility.",
      runtimeId,
    })
  );

describe("removeBusinessFunction", () => {
  beforeEach(() => {
    clearBusinessFunctionDefinitions();
    clearStaffingAssignments();
    clearJobs();
  });

  it("removes a stopped Function with no unfinished work", () => {
    define("fn-1", "Marketing");

    const result = removeBusinessFunction("Marketing");

    expect(result.ok).toBe(true);
    expect(resolveRemovableFunction("Marketing")).toBeUndefined();
  });

  it("releases staffing assignments and reports how many", () => {
    define("fn-1", "Marketing");
    saveStaffingAssignment({
      businessFunctionId: "fn-1",
      workerName: "Marketing Analyst",
      role: "ai",
      rationale: "test",
    });

    const result = removeBusinessFunction("fn-1");

    expect(result.ok && result.releasedAssignments).toBe(1);
    expect(listStaffingAssignments("fn-1")).toHaveLength(0);
  });

  it("refuses while the Function is running, so it cannot create orphan work", () => {
    define("fn-1", "Marketing", "runtime-1");

    const result = removeBusinessFunction("Marketing");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("still running");
  });

  it("refuses while unfinished Tasks still depend on it", () => {
    define("fn-1", "Marketing");
    enqueueJob("Something in progress", undefined, { owningJobId: "fn-1" });

    const result = removeBusinessFunction("Marketing");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("unfinished Task");
  });

  it("ignores unfinished work belonging to a different Function", () => {
    define("fn-1", "Marketing");
    define("fn-2", "Billing");
    enqueueJob("Other work", undefined, { owningJobId: "fn-2" });

    expect(removeBusinessFunction("Marketing").ok).toBe(true);
  });

  it("names Workers left staffing nothing", () => {
    define("fn-1", "Marketing");
    saveStaffingAssignment({
      businessFunctionId: "fn-1",
      workerName: "Marketing Analyst",
      role: "ai",
      rationale: "test",
    });

    const result = removeBusinessFunction("Marketing");

    expect(result.ok && result.orphanedWorkers).toEqual(["Marketing Analyst"]);
  });

  it("does not report a Worker that still staffs another Function", () => {
    define("fn-1", "Marketing");
    define("fn-2", "Billing");
    for (const businessFunctionId of ["fn-1", "fn-2"]) {
      saveStaffingAssignment({
        businessFunctionId,
        workerName: "Shared Analyst",
        role: "ai",
        rationale: "test",
      });
    }

    const result = removeBusinessFunction("Marketing");

    expect(result.ok && result.orphanedWorkers).toEqual([]);
  });

  it("reports an unknown Function rather than failing silently", () => {
    const result = removeBusinessFunction("Nonexistent");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("No Function matches");
  });

  it("resolves by id as well as by label", () => {
    define("fn-1", "Marketing");

    expect(resolveRemovableFunction("fn-1")?.label).toBe("Marketing");
  });

  it("does not remove a same-named Function from another Enterprise", () => {
    define("fn-1", "Marketing");

    const result = removeBusinessFunction("Marketing", "enterprise-2");

    expect(result.ok).toBe(false);
  });
});
