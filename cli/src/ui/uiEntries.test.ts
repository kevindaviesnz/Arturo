import {
  createInputEchoEntry,
  createUiOnlyQueuedEntry,
} from "./uiEntries";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiEntries",
  () => {
    it(
      "creates an ignored entry for empty input",
      () => {
        expect(
          createInputEchoEntry(
            "   "
          )
        ).toEqual({
          actor: "Arturo",
          label: "Ignored",
          body: "No input provided.",
        });
      }
    );

    it(
      "creates a request entry for plain input",
      () => {
        expect(
          createInputEchoEntry(
            "Plan a launch"
          )
        ).toEqual({
          actor: "You",
          label: "Request",
          body: "Plan a launch",
        });
      }
    );

    it(
      "creates a command entry for slash input with args",
      () => {
        expect(
          createInputEchoEntry(
            "/jobs active"
          )
        ).toEqual({
          actor: "You",
          label: "/jobs",
          body: "active",
        });
      }
    );

    it(
      "creates a command entry for slash input without args",
      () => {
expect(
  createInputEchoEntry(
    "/jobs"
  )
).toEqual({
  actor: "You",
  label: "/jobs",
  body: "",
});
      }
    );

    it(
      "creates the UI-only queued entry",
      () => {
        expect(
          createUiOnlyQueuedEntry()
        ).toEqual({
          actor: "Arturo",
          label: "Queued",
          body: "This is currently UI-only. Command execution will be connected next.",
        });
      }
    );
  }
);
