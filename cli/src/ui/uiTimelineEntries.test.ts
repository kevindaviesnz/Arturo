import {
  createTimelineEntries,
  formatRuntimeEventTimestamp,
} from "./uiTimelineEntries";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiTimelineEntries",
  () => {
    it(
      "formats runtime event times in the reader's time zone, naming it",
      () => {
        expect(
          formatRuntimeEventTimestamp(
            0,
            "UTC"
          )
        ).toBe(
          "1 January 1970, 00:00:00 UTC"
        );
        // 20:22 UTC on the 13th is the morning of the 14th in Auckland.
        expect(
          formatRuntimeEventTimestamp(
            Date.UTC(2026, 9, 13, 20, 22, 38),
            "Pacific/Auckland"
          )
        ).toBe(
          "14 October 2026, 09:22:38 GMT+13"
        );
      }
    );

    it(
      "creates an empty timeline entry",
      () => {
        expect(
          createTimelineEntries(
            [],
            5
          )
        ).toEqual([
          {
            actor: "Arturo",
            label: "Timeline",
            body: "No runtime events found.",
          },
        ]);
      }
    );

    it(
      "creates timeline entries newest first",
      () => {
        const entries =
          createTimelineEntries(
            [
              {
                sequence: 1,
                id: "event-1",
                type: "job.queued",
                level: "info",
                message: "First event",
                timestamp: 0,
              },
              {
                sequence: 2,
                id: "event-2",
                type: "job.completed",
                level: "success",
                message: "Second event",
                timestamp: 1000,
              },
            ],
            2,
            "UTC"
          );

        expect(
          entries[0]
        ).toEqual({
          actor: "SUCCESS",
          label: "#2 · Task completed",
          body: [
            "Second event",
            "time: 1 January 1970, 00:00:01 UTC",
            "id: event-2",
          ].join("\n"),
        });
      }
    );
  }
);
