import { afterEach, describe, expect, it } from "vitest";
import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "./staffingStore";
import {
  designatedApproversForFunction,
  formatApproverRefusal,
  mayDecideForFunction,
} from "./functionApprovers";

afterEach(() => clearStaffingAssignments());

describe("designatedApproversForFunction", () => {
  it("returns the Humans the applied plan made accountable", () => {
    saveStaffingAssignment({
      businessFunctionId: "e-1:safeguarding",
      workerName: "Sam Okonjo",
      role: "human-approver",
      rationale: "Safeguarding lead.",
    });
    saveStaffingAssignment({
      businessFunctionId: "e-1:safeguarding",
      workerName: "Record Keeper",
      role: "ai",
      rationale: "Drafts the summaries.",
    });

    expect(designatedApproversForFunction("e-1:safeguarding")).toEqual([
      "Sam Okonjo",
    ]);
  });

  it("ignores an approval requirement with nobody assigned to it", () => {
    saveStaffingAssignment({
      businessFunctionId: "e-1:safeguarding",
      workerName: "",
      role: "human-approver",
      rationale: "Needs a Human.",
    });

    expect(designatedApproversForFunction("e-1:safeguarding")).toEqual([]);
  });

  it("returns nobody for work that names no Function", () => {
    expect(designatedApproversForFunction(undefined)).toEqual([]);
  });
});

describe("mayDecideForFunction", () => {
  it("allows the designated approver", () => {
    expect(mayDecideForFunction(["Sam Okonjo"], "Sam Okonjo")).toBe(true);
  });

  it("ignores case and surrounding space in the name", () => {
    expect(mayDecideForFunction(["Sam Okonjo"], "  sam okonjo ")).toBe(true);
  });

  it("refuses a Human the plan did not make accountable", () => {
    expect(mayDecideForFunction(["Sam Okonjo"], "Dev Patel")).toBe(false);
  });

  it("allows anyone when the plan designated nobody", () => {
    expect(mayDecideForFunction([], "Dev Patel")).toBe(true);
  });
});

describe("formatApproverRefusal", () => {
  it("names who is accountable and how to decide as them", () => {
    const message = formatApproverRefusal(["Sam Okonjo"], "Dev Patel", "approve");

    expect(message).toContain("Dev Patel is not an approver for this Function");
    expect(message).toContain("was not recorded");
    expect(message).toContain("made Sam Okonjo accountable");
    expect(message).toContain('/approve <task-id> --as "Sam Okonjo"');
    expect(message).toContain("re-run /staff");
  });

  it("lists several accountable approvers readably", () => {
    expect(
      formatApproverRefusal(["Sam Okonjo", "Ana Reyes"], "Dev Patel", "reject")
    ).toContain("made Sam Okonjo or Ana Reyes accountable");
  });
});
