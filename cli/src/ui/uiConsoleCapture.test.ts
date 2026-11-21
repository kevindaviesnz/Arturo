import {
  createConsoleCaptureEntry,
  captureUiCommandOutput,
  formatConsoleArgs,
  formatConsoleValue,
  readsAsRefusal,
} from "./uiConsoleCapture";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createResetSuccessEntry,
} from "./uiCommandHandlers";

describe(
  "uiConsoleCapture",
  () => {
    it(
      "captures a synchronous command as a UI entry",
      () => {
        expect(
          captureUiCommandOutput(
            "Approval",
            () => console.log("approval recorded")
          )
        ).toEqual({
          actor: "Arturo",
          label: "Approval",
          body: "approval recorded",
        });
      }
    );

    it(
      "formats string console values",
      () => {
        expect(
          formatConsoleValue(
            "hello"
          )
        ).toBe(
          "hello"
        );
      }
    );

      it(
    "creates reset success entry",
    () => {
      expect(
        createResetSuccessEntry()
      ).toEqual({
        actor: "Arturo",
        label: "Everything deleted",
        body: "Arturo is now empty, as though you had just installed it.",
      });
    }
      );
    
    it(
      "formats error console values",
      () => {
        expect(
          formatConsoleValue(
            new Error(
              "broken"
            )
          )
        ).toBe(
          "broken"
        );
      }
    );

    it(
      "joins console args",
      () => {
        expect(
          formatConsoleArgs([
            "hello",
            "world",
          ])
        ).toBe(
          "hello world"
        );
      }
    );

    it(
      "creates a background event entry",
      () => {
        expect(
          createConsoleCaptureEntry(
            "log",
            [
              "Human task required",
            ]
          )
        ).toEqual({
          actor: "Arturo",
          label: "Background event",
          body: "Human task required",
        });
      }
    );
  }
);

describe("truthful labels", () => {
  it("does not report a refusal under a success label", () => {
    const entry = captureUiCommandOutput("Task created", () => {
      console.log("Parent Communication has no Worker assigned to it.");
    });

    expect(entry.label).toBe("Refused");
    expect(entry.body).toContain("no Worker assigned");
  });

  it.each([
    ["Worker added", "Refused"],
    ["Function removed", "Refused"],
    ["Runtime started", "Refused"],
    ["Human task completed", "Refused"],
    ["Human task blocked", "Refused"],
    ["Human task revision requested", "Refused"],
    ["Approval published", "Refused"],
  ])("turns %s into %s on refusal", (label, expected) => {
    expect(
      captureUiCommandOutput(label, () => {
        console.log("enterprise not found: missing");
      }).label
    ).toBe(expected);
  });

  it.each([
    "Approval status",
    "Human task",
    "Rejection",
    "Artefact",
  ])("keeps the plain-noun label %s unchanged on refusal", (label) => {
    expect(
      captureUiCommandOutput(label, () => {
        console.log("approval chain not found: task-9");
      }).label
    ).toBe(label);
  });

  it.each([
    // Both verbatim from a scenario 051 run.
    "Human task is assigned to Client Liaison, not Principal Architect.",
    "Artefact review is assigned to Principal Architect, not Technical Lead.",
  ])("reads a refusal that only names the wrong person: %s", (body) => {
    // These carry none of the usual refusal words, so completing somebody
    // else's task was announced as "Human task completed".
    expect(readsAsRefusal(body)).toBe(true);
    expect(captureUiCommandOutput("Human task completed", () => {
      console.log(body);
    }).label).toBe("Refused");
  });

  it("labels a named-work refusal [Refused], not [Task created] (Amy)", () => {
    const body = "Estate of R. Hemi, will is a will matter, a type that never goes to an AI worker. Nothing was started.";
    expect(readsAsRefusal(body)).toBe(true);
    expect(captureUiCommandOutput("Task created", () => {
      console.log(body);
    }).label).toBe("Refused");
    expect(readsAsRefusal("Nothing was changed yet. To go ahead: /work cancel w --confirm")).toBe(false);
  });

  it("does not read an ordinary assignment as a refusal", () => {
    expect(readsAsRefusal("Human task is assigned to Client Liaison.")).toBe(false);
    expect(
      captureUiCommandOutput("Human task completed", () => {
        console.log("Completed by Client Liaison. Assigned to Client Liaison.");
      }).label
    ).toBe("Human task completed");
  });

  it("keeps the success label when the command succeeded", () => {
    const entry = captureUiCommandOutput("Task created", () => {
      console.log("Task queued task-1");
    });

    expect(entry.label).toBe("Task created");
  });

  it("says so plainly when a command produced no output at all", () => {
    expect(
      captureUiCommandOutput("Task created", () => undefined).label
    ).toBe("Task created");
  });
});

/**
 * Success output echoes the operator's own instructions back, and those are
 * ordinary English. Both of these created a Human Task and both announced
 * "Human task not created", because a refusal word appears further down the
 * body -- in the words the operator typed.
 */
describe("refusal words in the operator's own text", () => {
  it.each([
    "Record what failed and how.",
    "Record what you can see and what you cannot.",
  ])("does not read %s as a refusal", (instructions) => {
    const body = [
      "Human task created  human-task-1",
      "",
      "Instructions:",
      instructions,
    ].join("\n");

    expect(readsAsRefusal(body)).toBe(false);
    expect(
      captureUiCommandOutput("Human task created", () => {
        console.log(body);
      }).label
    ).toBe("Human task created");
  });

  it("still reads a refusal that leads with one", () => {
    const body = [
      "Order Preparation has no Worker assigned to it, so there is nobody to do this.",
      "",
      "  /staff",
    ].join("\n");

    expect(readsAsRefusal(body)).toBe(true);
    expect(
      captureUiCommandOutput("Task created", () => {
        console.log(body);
      }).label
    ).toBe("Refused");
  });
});
