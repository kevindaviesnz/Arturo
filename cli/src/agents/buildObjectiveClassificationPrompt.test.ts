import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildObjectiveClassificationPrompt,
} from "./buildObjectiveClassificationPrompt";

describe("buildObjectiveClassificationPrompt", () => {
  it("includes the objective classifier role", () => {
    expect(
      buildObjectiveClassificationPrompt(
        "Create a fast fashion business"
      )
    ).toContain(
      "You are Arturo's Objective Classifier."
    );
  });

  it("includes all supported objective types", () => {
    const prompt =
      buildObjectiveClassificationPrompt(
        "Operate my mentoring business"
      );

    expect(prompt).toContain("create");
    expect(prompt).toContain("operate");
    expect(prompt).toContain("improve");
    expect(prompt).toContain("analyze");
    expect(prompt).toContain("research");
    expect(prompt).toContain("monitor");
    expect(prompt).toContain("manage");
    expect(prompt).toContain("support");
    expect(prompt).toContain("automate");
    expect(prompt).toContain("learn");
    expect(prompt).toContain("unknown");
  });

  it("includes finite and persistent lifetimes", () => {
    const prompt =
      buildObjectiveClassificationPrompt(
        "Monitor competitors daily"
      );

    expect(prompt).toContain("finite");
    expect(prompt).toContain("persistent");
  });

  it("includes the user request", () => {
    expect(
      buildObjectiveClassificationPrompt(
        "Create a fast fashion business"
      )
    ).toContain(
      "Create a fast fashion business"
    );
  });
});