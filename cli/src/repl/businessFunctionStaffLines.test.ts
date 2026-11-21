import { afterEach, describe, expect, it } from "vitest";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { formatBusinessFunctionStaffLines } from "./businessFunctionCommands";
import { MAX_CHAIN_DEPTH } from "../runtime/chainLimits";

const FUNCTION_ID = "threadline-fashion:trend-research";

afterEach(() => clearStaffingAssignments());

describe("who is assigned to a Function, in its detail view", () => {
  it("says nobody is, and how to change that", () => {
    expect(formatBusinessFunctionStaffLines(FUNCTION_ID)).toEqual([
      "  Workers:       none assigned — run /staff",
      "  Follow-on work: off — only does the work you ask for",
    ]);
  });

  it("names the AI Workers and the accountable approver", () => {
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "Trend Researcher", role: "ai", rationale: "Research." });
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "Kevin", role: "human-approver", rationale: "Owner." });

    expect(formatBusinessFunctionStaffLines(FUNCTION_ID)).toEqual([
      "  Workers:       Trend Researcher",
      "  Approver:      Kevin",
      "  Follow-on work: off — only does the work you ask for",
    ]);
  });

  it("shows an approval requirement nobody has been assigned to", () => {
    saveStaffingAssignment({ businessFunctionId: FUNCTION_ID, workerName: "", role: "human-approver", rationale: "Needs sign-off." });

    expect(formatBusinessFunctionStaffLines(FUNCTION_ID)).toContain("  Approver:      nobody yet");
  });
});

describe("the product's own Function detail", () => {
  it("shows the staff, not only the legacy view", async () => {
    const { handleUiCommand } = await import("../ui/uiCommandHandlers");
    const { seedDemoEnterprise } = await import("../demo/seedDemo");
    await seedDemoEnterprise(() => undefined);

    const [detail] = await handleUiCommand("/function", ["inspect", "Client Advice"]);

    expect(detail.label).toBe("Function detail");
    expect(detail.body).toContain("Advice Drafter");
    expect(detail.body).toContain("Principal Lawyer");
    expect(detail.body).toContain("off — only does the work you ask for");

    const [on] = await handleUiCommand("/function", ["update", "Client Advice", "--follow-on", "on"]);
    expect(on.body).toContain("Follow-on work is on.");
    expect((await handleUiCommand("/function", ["inspect", "Client Advice"]))[0].body).toContain(`may create up to ${MAX_CHAIN_DEPTH} further Tasks`);

    const [off] = await handleUiCommand("/function", ["update", "Client Advice", "--follow-on", "off"]);
    expect(off.body).toContain("Follow-on work is off.");
    expect((await handleUiCommand("/function", ["update", "Client Advice", "--follow-on", "maybe"]))[0].label).toBe("Usage");
  });

  it("sets where signed-off results go, refusing an unknown person before changing anything", async () => {
    const { handleUiCommand } = await import("../ui/uiCommandHandlers");
    const { seedDemoEnterprise } = await import("../demo/seedDemo");
    const { clearHandOffs } = await import("../runtime/handOff");
    const { getBusinessFunctionDefinitionByIdOrLabel } = await import("../business/businessFunctionDefinitionStore");
    await seedDemoEnterprise(() => undefined);
    clearHandOffs();
    const objective = getBusinessFunctionDefinitionByIdOrLabel("Client Advice")!.objective;

    const [refused] = await handleUiCommand("/function", ["update", "Client Advice", "--objective", "Changed.", "--hand-off-to", "Nobody", "--hand-off-task", "File it."]);
    expect(refused.label).toBe("Hand-off not set");
    expect(refused.body).toContain("Nothing was changed.");
    expect(getBusinessFunctionDefinitionByIdOrLabel("Client Advice")!.objective).toBe(objective);

    expect((await handleUiCommand("/function", ["update", "Client Advice", "--hand-off-to", "Principal Lawyer"]))[0].body).toContain("needs both");

    const [set] = await handleUiCommand("/function", ["update", "Client Advice", "--hand-off-to", "Principal Lawyer", "--hand-off-task", "Send the advice to the client.", "--as", "Principal Lawyer"]);
    expect(set.body).toContain('Hand-off set: when a result is signed off, it goes to Principal Lawyer to "Send the advice to the client."');
    expect((await handleUiCommand("/function", ["inspect", "Client Advice"]))[0].body).toContain("Hand-off:      when a result is signed off");

    const [off] = await handleUiCommand("/function", ["update", "Client Advice", "--hand-off", "off"]);
    expect(off.body).toContain("Hand-off off.");
    clearHandOffs();
  });
});
