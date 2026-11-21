import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildWorkflowPlanPrompt,
  formatObjectivePlanningContext,
} from "./buildWorkflowPlanPrompt";

describe("formatObjectivePlanningContext", () => {
  it("returns empty text when no objective is provided", () => {
    expect(
      formatObjectivePlanningContext()
    ).toBe("");
  });

  it("formats objective classification context", () => {
    expect(
      formatObjectivePlanningContext({
        description: "Create a fast fashion business",
        type: "create",
        lifetime: "finite",
        businessPattern: "Fashion Retail",
        supported: true,
        reason: "The request asks Arturo to create a business.",
      })
    ).toContain(
      "- business pattern: Fashion Retail"
    );
  });

  it("formats resolved intent context when present", () => {
    const result =
      formatObjectivePlanningContext({
        description: "Create a fast fashion business",
        type: "create",
        lifetime: "finite",
        businessPattern: "Fashion Retail",
        supported: true,
        reason: "The request asks Arturo to create a business.",
        intent: {
          originalRequest:
            "Build me an AI-native fast fashion business",
          normalizedIntent:
            "Create a product company",
          intentType:
            "create_business",
          businessPatternId:
            "product_company",
          confidence:
            0.92,
          needsClarification:
            false,
          reason:
            "The request asks Arturo to create a business around products.",
        },
      });

    expect(result).toContain(
      "Resolved intent:"
    );

    expect(result).toContain(
      "- normalized intent: Create a product company"
    );

    expect(result).toContain(
      "- intent type: create_business"
    );

    expect(result).toContain(
      "- business pattern id: product_company"
    );
  });
});

describe("buildWorkflowPlanPrompt", () => {
  it("includes objective-aware planning rules", () => {
    expect(
      buildWorkflowPlanPrompt(
        "Create a fast fashion business"
      )
    ).toContain(
      "Objective-aware planning rules"
    );
  });

  it("explains that every archetype plans its own work", () => {
  expect(
    buildWorkflowPlanPrompt(
      "Create a fast fashion business"
    )
  ).toContain(
    "Every archetype is expected to plan its own work."
  );

  expect(
    buildWorkflowPlanPrompt(
      "Create a fast fashion business"
    )
  ).toContain(
    "Use the planner archetype only when the step is explicitly about:"
  );
});

it("uses a business pattern as context without prescribing a fixed answer", () => {
  const prompt = buildWorkflowPlanPrompt(
      "Create a fast fashion business",
      {
        description: "Create a product company",
        type: "create",
        lifetime: "finite",
        businessPattern: "Product Company",
        supported: true,
        reason: "The request asks Arturo to create a business around products.",
      }
    );
  expect(prompt).toContain("Business pattern context: Product Company");
  expect(prompt).toContain("Infer the smallest relevant workflow");
  expect(prompt).not.toContain("unit economics");
});
  
  it("includes objective context when provided", () => {
    const prompt =
      buildWorkflowPlanPrompt(
        "Create a fast fashion business",
        {
          description: "Create a fast fashion business",
          type: "create",
          lifetime: "finite",
          businessPattern: "Fashion Retail",
          supported: true,
          reason: "The request asks Arturo to create a business.",
          intent: {
            originalRequest:
              "Build me an AI-native fast fashion business",
            normalizedIntent:
              "Create a product company",
            intentType:
              "create_business",
            businessPatternId:
              "product_company",
            confidence:
              0.92,
            needsClarification:
              false,
            reason:
              "The request asks Arturo to create a business around products.",
          },
        }
      );

    expect(prompt).toContain(
      "Objective classification:"
    );

    expect(prompt).toContain(
      "- type: create"
    );

    expect(prompt).toContain(
      "- business pattern: Fashion Retail"
    );

    expect(prompt).toContain(
      "Resolved intent:"
    );

    expect(prompt).toContain(
      "- normalized intent: Create a product company"
    );

    expect(prompt).toContain(
      "- intent type: create_business"
    );

    expect(prompt).toContain(
      "- business pattern id: product_company"
    );
  });
});
