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
  classifyObjective,
} from "./classifyObjective";

vi.mock("../llm/ollamaClient", () => ({
  generateWithOllama: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("classifyObjective", () => {
  it("uses validated model output for business creation", async () => {
    vi.mocked(
      generateWithOllama
    ).mockResolvedValue({
      response: JSON.stringify({
        description: "Create a product company",
        type: "create",
        lifetime: "finite",
        businessPattern: "Product Company",
        supported: true,
        reason: "The request describes a product business.",
      }),
    });

    const result =
      await classifyObjective(
        "Build me an AI-native fast fashion business"
      );

    expect(
      generateWithOllama
    ).toHaveBeenCalledOnce();

    expect(
      result
    ).toEqual({
      description:
        "Create a product company",
      type:
        "create",
      lifetime:
        "finite",
      businessPattern:
        "Product Company",
      supported:
        true,
      reason: "The request describes a product business.",
    });
  });

  it("uses Ollama when an objective is unsupported", async () => {
    vi.mocked(
      generateWithOllama
    ).mockResolvedValue({
      response: JSON.stringify({
        description:
          "Unusual request",
        type:
          "unknown",
        lifetime:
          "finite",
        businessPattern:
          "Unknown",
        supported:
          false,
        reason:
          "No supported objective matched.",
      }),
    });

    const result =
      await classifyObjective(
        "Tell me the meaning of life"
      );

    expect(
      generateWithOllama
    ).toHaveBeenCalledWith({
      model:
        "llama3.2:latest",
      prompt:
        expect.stringContaining(
          "You are Arturo's Objective Classifier."
        ),
    });

    expect(
      result
    ).toEqual({
      description:
        "Unusual request",
      type:
        "unknown",
      lifetime:
        "finite",
      businessPattern:
        "Unknown",
      supported:
        false,
      reason:
        "No supported objective matched.",
    });
  });

  /**
   * The prompt asks for a reason only when supported is false, so a model that
   * returns supported: true without one is obeying it. The parser required the
   * field unconditionally, and /ask died on its very first step with
   * "Invalid objective classification: reason must be a string".
   */
  it("accepts a supported classification that omits the reason", async () => {
    vi.mocked(
      generateWithOllama
    ).mockResolvedValue({
      response: JSON.stringify({
        description: "Find fabric suppliers",
        type: "create",
        lifetime: "finite",
        businessPattern: "Product Company",
        supported: true,
      }),
    });

    const result =
      await classifyObjective(
        "Find where I can get materials"
      );

    expect(result.supported).toBe(true);
    expect(result.reason).toBe("");
    expect(generateWithOllama).toHaveBeenCalledOnce();
  });

  it("shows the model its own invalid reply and takes the correction", async () => {
    vi.mocked(generateWithOllama)
      .mockResolvedValueOnce({ response: "not json at all" })
      .mockResolvedValueOnce({
        response: JSON.stringify({
          description: "Find fabric suppliers",
          type: "create",
          lifetime: "finite",
          businessPattern: "Product Company",
          supported: true,
          reason: "Sourcing is ordinary business work.",
        }),
      });

    const result =
      await classifyObjective("Find where I can get materials");

    expect(result.description).toBe("Find fabric suppliers");
    expect(generateWithOllama).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(generateWithOllama).mock.calls[1][0].prompt
    ).toContain("Your previous response was rejected.");
  });

  it("tells the operator what to do when every attempt fails", async () => {
    vi.mocked(
      generateWithOllama
    ).mockResolvedValue({ response: "still not json" });

    await expect(
      classifyObjective("Toy Sourcing Analyst")
    ).rejects.toThrow(
      /could not work out what "Toy Sourcing Analyst" is asking for/
    );

    // Three attempts, not one, and the operator gets an instruction rather
    // than a schema error.
    expect(generateWithOllama).toHaveBeenCalledTimes(3);
  });
});
