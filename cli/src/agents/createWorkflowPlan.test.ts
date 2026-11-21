import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  generateWithOllama,
} from "../llm/ollamaClient";

import {
  createWorkflowPlan,
} from "./createWorkflowPlan";

vi.mock("../llm/ollamaClient", () => ({
  generateWithOllama: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createWorkflowPlan", () => {
  it("includes objective classification context in the planner prompt", async () => {
    vi.mocked(
      generateWithOllama
    ).mockResolvedValue({
      response: JSON.stringify({
        objective: "Create a fast fashion business",
        explanation: "A broader startup creation workflow is required.",
        steps: [
          {
            archetype: "planner",
            instruction: "Create the startup execution plan.",
          },
        ],
      }),
    });

    await createWorkflowPlan(
      "Create a fast fashion business",
      {
        description: "Create a fast fashion business",
        type: "create",
        lifetime: "finite",
        businessPattern: "Fashion Retail",
        supported: true,
        reason: "The request asks Arturo to create a business.",
      }
    );

    const prompt =
      vi.mocked(
        generateWithOllama
      ).mock.calls[0]?.[0].prompt ?? "";

    expect(prompt).toContain(
      "Objective classification:"
    );

    expect(prompt).toContain(
      "- type: create"
    );

    expect(prompt).toContain(
      "- business pattern: Fashion Retail"
    );
  });
});