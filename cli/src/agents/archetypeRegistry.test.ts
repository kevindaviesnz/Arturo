import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildArchetypeInstructionBlock,
  getArchetypeCapabilities,
  getArchetypeDefinition,
} from "./archetypeRegistry";

describe("archetype registry", () => {
  it("attaches capabilities to researcher", () => {
    expect(
      getArchetypeCapabilities(
        "researcher"
      )
    ).toEqual([
      "llm",
      "research",
      "web-research",
      "summarisation",
      "human-contact",
    ]);
  });

  it("assigns backup capability to the operator archetype", () => {
    expect(
      getArchetypeCapabilities(
        "operator"
      )
    ).toContain(
      "backup"
    );
  });

  it("gives the operator archetype reasoning and execution, never the human-only approval capability", () => {
    const capabilities = getArchetypeCapabilities("operator");
    expect(capabilities).toContain("llm");
    expect(capabilities).toContain("execution");
    // human-review is reserved for accountable Human participation; an AI
    // archetype must not carry it (it would mislabel the Worker "Approve" and
    // surface an AI under /workers --capability "human-review").
    expect(capabilities).not.toContain("human-review");
  });

  it("grants no AI archetype the human-only human-review capability", () => {
    const archetypes = [
      "researcher", "creator", "reviewer", "assistant", "analyst",
      "converter", "advisor", "planner", "coordinator", "operator",
      "observer", "simulator", "optimizer", "negotiator", "guardian", "coach",
    ] as const;

    for (const archetype of archetypes) {
      expect(getArchetypeCapabilities(archetype)).not.toContain("human-review");
    }
  });

  it("does not allow researcher to send email", () => {
    expect(
      getArchetypeCapabilities(
        "researcher"
      )
    ).not.toContain(
      "email-send"
    );
  });

  it("does not allow creator to send email", () => {
    expect(
      getArchetypeCapabilities(
        "creator"
      )
    ).not.toContain(
      "email-send"
    );
  });

  it("includes anti-fabrication guardrails in researcher prompt", () => {
    expect(
      buildArchetypeInstructionBlock(
        "researcher"
      )
    ).toContain(
      "Do not invent facts, citations, papers, authors, statistics, URLs, studies, tool results, or source material."
    );
  });

  it("includes assigned capabilities in the archetype prompt", () => {
    expect(
      buildArchetypeInstructionBlock(
        "creator"
      )
    ).toContain(
      "Assigned capabilities:"
    );
  });

  it("keeps prompt and capabilities together", () => {
    const definition =
      getArchetypeDefinition(
        "creator"
      );

    expect(
      definition.instruction
    ).toContain(
      "creator"
    );

    expect(
      definition.capabilities
    ).toContain(
      "writing"
    );
  });

  it("allows researcher to request human contact", () => {
  expect(
    getArchetypeCapabilities(
      "researcher"
    )
  ).toContain(
    "human-contact"
  );
});

it("does not treat human contact as email send", () => {
  expect(
    getArchetypeCapabilities(
      "researcher"
    )
  ).not.toContain(
    "email-send"
  );
});
});
