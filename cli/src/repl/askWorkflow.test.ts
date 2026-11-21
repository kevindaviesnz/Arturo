import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createWorkflowPlan,
} from "../agents/createWorkflowPlan";

import {
  classifyObjective,
} from "../agents/classifyObjective";

import {
  planAskWorkflow,
} from "./askWorkflow";

vi.mock("../agents/classifyObjective", () => ({
  classifyObjective: vi.fn(),
}));

vi.mock("../agents/createWorkflowPlan", () => ({
  createWorkflowPlan: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("planAskWorkflow objective handling", () => {
  it("uses the model planner after objective classification", async () => {
    vi.mocked(classifyObjective).mockResolvedValue({
      description: "Create a product company",
      type: "create",
      lifetime: "finite",
      businessPattern: "Product Company",
      supported: true,
      reason: "The request describes a product company.",
    });

    vi.mocked(createWorkflowPlan).mockResolvedValue({
      objective: "Create a fast fashion business",
      explanation: "A product company workflow is appropriate.",
      steps: [
        {
          archetype: "planner",
          instruction: "Create the operating plan.",
        },
      ],
    });

    await expect(
      planAskWorkflow([
        "--auto-workers",
        "Build me an AI-native fast fashion business",
      ])
    ).resolves.toMatchObject({
      objective: {
        supported: true,
      },
    });

    expect(createWorkflowPlan).toHaveBeenCalledOnce();
  });

  it("rejects unsupported objectives before workflow planning", async () => {
    vi.mocked(classifyObjective).mockResolvedValue({
      description: "Unknown request",
      type: "unknown",
      lifetime: "finite",
      businessPattern: "Unknown",
      supported: false,
      reason: "The request is unsupported.",
    });

    await expect(
      planAskWorkflow(["Tell me the meaning of life"])
    ).rejects.toThrow(
      "Arturo cannot help with this request yet."
    );

    expect(createWorkflowPlan).not.toHaveBeenCalled();
  });
});
