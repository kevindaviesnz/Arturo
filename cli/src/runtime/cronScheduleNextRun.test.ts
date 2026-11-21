import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getNextCronExecutionTime,
} from "./cronScheduleNextRun";

describe(
  "cronScheduleNextRun",
  () => {
    it(
      "calculates next every-minute execution",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            15,
            42
          ).getTime();

        const next =
          getNextCronExecutionTime(
            {
              type:
                "every-minute",
            },
            now
          );

        const result =
          new Date(next);

        expect(
          result.getMinutes()
        ).toBe(16);

        expect(
          result.getSeconds()
        ).toBe(0);
      }
    );

    it(
      "calculates next hourly execution",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            20,
            0
          ).getTime();

        const next =
          getNextCronExecutionTime(
            {
              type: "hourly",
              minute: 30,
            },
            now
          );

        const result =
          new Date(next);

        expect(
          result.getHours()
        ).toBe(10);

        expect(
          result.getMinutes()
        ).toBe(30);
      }
    );

    it(
      "rolls hourly schedule forward",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            10,
            45,
            0
          ).getTime();

        const next =
          getNextCronExecutionTime(
            {
              type: "hourly",
              minute: 30,
            },
            now
          );

        const result =
          new Date(next);

        expect(
          result.getHours()
        ).toBe(11);

        expect(
          result.getMinutes()
        ).toBe(30);
      }
    );

    it(
      "calculates daily execution",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            8,
            0,
            0
          ).getTime();

        const next =
          getNextCronExecutionTime(
            {
              type: "daily",
              hour: 9,
              minute: 15,
            },
            now
          );

        const result =
          new Date(next);

        expect(
          result.getHours()
        ).toBe(9);

        expect(
          result.getMinutes()
        ).toBe(15);
      }
    );

    it(
      "rolls daily execution forward",
      () => {
        const now =
          new Date(
            2026,
            0,
            1,
            12,
            0,
            0
          ).getTime();

        const next =
          getNextCronExecutionTime(
            {
              type: "daily",
              hour: 9,
              minute: 15,
            },
            now
          );

        const result =
          new Date(next);

        expect(
          result.getDate()
        ).toBe(2);

        expect(
          result.getHours()
        ).toBe(9);
      }
    );
  }
);