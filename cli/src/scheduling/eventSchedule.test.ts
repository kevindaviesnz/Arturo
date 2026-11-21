import {
  describe,
  expect,
  it,
} from "vitest";

import {
  computeNextDailyEventScheduleRun,
  computeNextWeeklyEventScheduleRun,
  createEventSchedule,
  parseEventScheduleRecurrence,
  parseDailyTime,
  validateEventScheduleTimezone,
} from "./eventSchedule";

describe(
  "Task schedules",
  () => {
    it(
      "parses strict 24-hour times and IANA timezones",
      () => {
        expect(
          parseDailyTime(
            "09:05"
          )
        ).toEqual({
          hour:
            9,
          minute:
            5,
        });
        expect(
          validateEventScheduleTimezone(
            "Pacific/Auckland"
          )
        ).toBe(
          "Pacific/Auckland"
        );
        expect(
          () =>
            parseDailyTime(
              "9am"
            )
        ).toThrow(
          "24-hour HH:MM"
        );
        expect(
          () =>
            validateEventScheduleTimezone(
              "Auckland"
            )
        ).toThrow(
          "Invalid timezone"
        );
      }
    );

    it(
      "parses daily and weekly recurrences",
      () => {
        expect(
          parseEventScheduleRecurrence()
        ).toEqual({
          frequency:
            "daily",
        });
        expect(
          parseEventScheduleRecurrence(
            "Friday"
          )
        ).toEqual({
          frequency:
            "weekly",
          dayOfWeek:
            5,
        });
        expect(
          () =>
            parseEventScheduleRecurrence(
              "fortnightly"
            )
        ).toThrow(
          "a day of the week"
        );
      }
    );

    it(
      "computes the next Auckland 09:00 before and after today's run",
      () => {
        expect(
          new Date(
            computeNextDailyEventScheduleRun(
              {
                hour:
                  9,
                minute:
                  0,
                timezone:
                  "Pacific/Auckland",
                after:
                  Date.parse(
                    "2026-07-18T20:00:00.000Z"
                  ),
              }
            )
          ).toISOString()
        ).toBe(
          "2026-07-18T21:00:00.000Z"
        );
        expect(
          new Date(
            computeNextDailyEventScheduleRun(
              {
                hour:
                  9,
                minute:
                  0,
                timezone:
                  "Pacific/Auckland",
                after:
                  Date.parse(
                    "2026-07-18T22:00:00.000Z"
                  ),
              }
            )
          ).toISOString()
        ).toBe(
          "2026-07-19T21:00:00.000Z"
        );
      }
    );

    it(
      "computes Friday evening before and after this week's run",
      () => {
        expect(
          new Date(
            computeNextWeeklyEventScheduleRun(
              {
                dayOfWeek:
                  5,
                hour:
                  18,
                minute:
                  0,
                timezone:
                  "Pacific/Auckland",
                after:
                  Date.parse(
                    "2026-07-24T05:00:00.000Z"
                  ),
              }
            )
          ).toISOString()
        ).toBe(
          "2026-07-24T06:00:00.000Z"
        );
        expect(
          new Date(
            computeNextWeeklyEventScheduleRun(
              {
                dayOfWeek:
                  5,
                hour:
                  18,
                minute:
                  0,
                timezone:
                  "Pacific/Auckland",
                after:
                  Date.parse(
                    "2026-07-24T07:00:00.000Z"
                  ),
              }
            )
          ).toISOString()
        ).toBe(
          "2026-07-31T06:00:00.000Z"
        );
      }
    );

    it(
      "creates a persistent-ready Task schedule with a fixed search query",
      () => {
        const schedule =
          createEventSchedule({
            id:
              "schedule-1",
            enterpriseId:
              "enterprise-1",
            owningJobId:
              "enterprise-1:function-1",
            taskId:
              "task-1",
            taskLabel:
              "Retrieve current public science news.",
            at:
              "09:00",
            timezone:
              "Pacific/Auckland",
            searchQuery:
              " latest public science news ",
            now:
              Date.parse(
                "2026-07-18T20:00:00.000Z"
              ),
          });

        expect(
          schedule
        ).toMatchObject({
          id:
            "schedule-1",
          hour:
            9,
          minute:
            0,
          timezone:
            "Pacific/Auckland",
          searchQuery:
            "latest public science news",
          enabled:
            true,
          nextRunAt:
            Date.parse(
              "2026-07-18T21:00:00.000Z"
            ),
        });
      }
    );

    it(
      "creates a weekly Friday backup Task schedule",
      () => {
        const schedule =
          createEventSchedule({
            id:
              "schedule-backup",
            enterpriseId:
              "enterprise-1",
            owningJobId:
              "enterprise-1:function-1",
            taskId:
              "task-backup",
            taskLabel:
              "Create and verify one code backup.",
            every:
              "friday",
            at:
              "18:00",
            timezone:
              "Pacific/Auckland",
            now:
              Date.parse(
                "2026-07-18T00:00:00.000Z"
              ),
          });

        expect(
          schedule
        ).toMatchObject({
          frequency:
            "weekly",
          dayOfWeek:
            5,
          nextRunAt:
            Date.parse(
              "2026-07-24T06:00:00.000Z"
            ),
        });
      }
    );
  }
);
