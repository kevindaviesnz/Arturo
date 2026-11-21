import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildWorkerPrompt,
  formatWorkerRefinementBlock,
} from "./buildWorkerPrompt";

describe(
  "formatWorkerRefinementBlock",
  () => {
    it(
      "returns empty text when refinement is missing",
      () => {
        expect(
          formatWorkerRefinementBlock(
            undefined
          )
        ).toBe(
          ""
        );
      }
    );

    it(
      "formats worker refinement instructions",
      () => {
        expect(
          formatWorkerRefinementBlock(
            "Produce detailed garment specs."
          )
        ).toBe(
          [
            "Worker-specific refinement:",
            "",
            "Produce detailed garment specs.",
          ].join("\n")
        );
      }
    );
  }
);

describe(
  "buildWorkerPrompt",
  () => {
    it(
      "includes researcher instructions",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "researcher",
              archetype:
                "researcher",
              run:
                function* () {},
            },
            "What is quantum computing?"
          );

        expect(
          prompt
        ).toContain(
          "You are a researcher"
        );
      }
    );

    it(
      "includes reviewer instructions",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "reviewer",
              archetype:
                "reviewer",
              run:
                function* () {},
            },
            "Review this article"
          );

        expect(
          prompt
        ).toContain(
          "You are a reviewer"
        );
      }
    );

    it(
      "includes assistant instructions",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "assistant",
              archetype:
                "assistant",
              run:
                function* () {},
            },
            "Hello"
          );

        expect(
          prompt
        ).toContain(
          "You are a helpful assistant"
        );
      }
    );

    it(
      "includes worker refinement instructions",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "designer",
              archetype:
                "creator",
              refinement:
                "Produce detailed garment specs.",
              run:
                function* () {},
            },
            "Create three dress designs."
          );

        expect(
          prompt
        ).toContain(
          "Worker-specific refinement:"
        );

        expect(
          prompt
        ).toContain(
          "Produce detailed garment specs."
        );
      }
    );

    it(
      "includes refinement even when archetype is missing",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "legacy-worker",
              refinement:
                "Always return detailed output.",
              run:
                function* () {},
            },
            "Do the task."
          );

        expect(
          prompt
        ).toContain(
          "Worker-specific refinement:"
        );

        expect(
          prompt
        ).toContain(
          "Always return detailed output."
        );

        expect(
          prompt
        ).toContain(
          "Instruction:"
        );

        expect(
          prompt
        ).toContain(
          "Do the task."
        );
      }
    );

    it(
      "includes task",
      () => {
        const prompt =
          buildWorkerPrompt(
            {
              name: "assistant",
              archetype:
                "assistant",
              run:
                function* () {},
            },
            "Hello"
          );

        expect(
          prompt
        ).toContain(
          "Instruction:"
        );

        expect(
          prompt
        ).toContain(
          "Hello"
        );
      }
    );

    it("includes shared Operational Memory separately from Job evidence", () => {
      const prompt = buildWorkerPrompt(
        {
          name: "safety-worker",
          archetype: "assistant",
          run: function* () {},
        },
        "Review the new toy evidence.",
        [
          "Failed small-parts tests must block release.",
        ]
      );

      expect(prompt).toContain("Relevant Operational Memory:");
      expect(prompt).toContain("Failed small-parts tests must block release.");
      expect(prompt).toContain("do not treat it as the current Task's raw evidence");
    });
  }
);

describe("data provenance boundary", () => {
  const worker = { name: "Inventory Analyst", archetype: "analyst" } as any;

  it("forbids inventing values and presenting them as real", () => {
    const prompt = buildWorkerPrompt(worker, "List slow-moving stock.");

    expect(prompt).toContain("Never invent a figure, quantity, price");
  });

  it("forbids claiming a data source the Worker does not have", () => {
    expect(
      buildWorkerPrompt(worker, "List slow-moving stock.")
    ).toContain("Never state or imply that anything came from records");
  });

  it("tells the Worker what to produce instead of invented data", () => {
    expect(
      buildWorkerPrompt(worker, "List slow-moving stock.")
    ).toContain("say plainly which data is missing");
  });

  it("applies to a Worker with no archetype", () => {
    const prompt = buildWorkerPrompt(
      { name: "legacy" } as any,
      "List slow-moving stock."
    );

    expect(prompt).toContain("You have no access to the Enterprise's records");
    expect(prompt).toContain("List slow-moving stock.");
  });

  it("still applies when memory and context are supplied", () => {
    const prompt = buildWorkerPrompt(
      worker,
      "List slow-moving stock.",
      ["A remembered lesson."],
      ["An authoritative record."]
    );

    expect(prompt).toContain("You have no access to the Enterprise's records");
  });
});

