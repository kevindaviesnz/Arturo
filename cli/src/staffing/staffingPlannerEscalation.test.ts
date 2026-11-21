import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import { generateWithConfiguredLlm, generateWithPaidEscalation } from "../llm/llmClient";
import { canUsePaidEscalation } from "../llm/modelRouting";
import { createStaffingPlan } from "./staffingPlanner";

vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: vi.fn(),
  generateWithPaidEscalation: vi.fn(),
}));
vi.mock("../llm/modelRouting", () => ({ canUsePaidEscalation: vi.fn() }));

const functions = [
  createBusinessFunctionDefinition({ id: "f-1", enterpriseId: "e-1", label: "Safety" }),
];

describe("staffing paid escalation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses one declared paid escalation only after all local corrections fail", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({ response: "not-json" });
    vi.mocked(canUsePaidEscalation).mockReturnValue(true);
    vi.mocked(generateWithPaidEscalation).mockResolvedValue({
      response: JSON.stringify({
        summary: "Paid repair",
        workers: [{
          name: "Safety Worker",
          archetype: "guardian",
          functionIds: ["f-1"],
          existing: false,
          rationale: "Bounded coverage.",
        }],
        humanApprovals: [],
      }),
    });

    const plan = await createStaffingPlan(functions, []);

    expect(plan.summary).toContain("Paid repair");
    // The local model answered "not-json" to every yes/no question, which is
    // not recognisably "no" — a governance control does not clear a
    // requirement on an unreadable answer.
    expect(plan.humanApprovals).toEqual([
      expect.objectContaining({ functionId: "f-1" }),
    ]);
    // Six sensitive-work questions for the one Function, then the plan and its
    // three retries.
    expect(generateWithConfiguredLlm).toHaveBeenCalledTimes(10);
    expect(generateWithPaidEscalation).toHaveBeenCalledWith(expect.objectContaining({
      reason: "repeated-structured-output-failure",
    }));
  });

  it("preserves local-only failure behavior when escalation is unavailable", async () => {
    vi.mocked(generateWithConfiguredLlm).mockResolvedValue({ response: "not-json" });
    vi.mocked(canUsePaidEscalation).mockReturnValue(false);
    await expect(createStaffingPlan(functions, []))
      .rejects.toThrow("after 3 correction attempts");
    expect(generateWithPaidEscalation).not.toHaveBeenCalled();
  });
});
