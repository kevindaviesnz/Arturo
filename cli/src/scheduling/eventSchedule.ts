export type EventSchedule = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly owningJobId: string;
  readonly taskId: string;
  readonly taskLabel: string;
  readonly frequency: EventScheduleFrequency;
  readonly dayOfWeek?: EventScheduleDayOfWeek;
  readonly hour: number;
  readonly minute: number;
  readonly timezone: string;
  readonly searchQuery?: string;
  readonly enabled: boolean;
  readonly nextRunAt: number;
  readonly lastRunAt?: number;
  readonly createdAt: number;
};

export type EventScheduleOccurrenceStatus =
  | "queued"
  | "skipped";

export type EventScheduleOccurrence = {
  readonly id: string;
  readonly scheduleId: string;
  readonly taskId?: string;
  readonly scheduledFor: number;
  readonly status: EventScheduleOccurrenceStatus;
  readonly reason?: string;
  readonly worker?: string;
  readonly recordedAt: number;
};

export type CreateEventScheduleInput = {
  readonly enterpriseId: string;
  readonly owningJobId: string;
  readonly taskId: string;
  readonly taskLabel: string;
  readonly every?: string;
  readonly at: string;
  readonly timezone: string;
  readonly searchQuery?: string;
  readonly now?: number;
  readonly id?: string;
};

export type EventScheduleFrequency =
  | "daily"
  | "weekly";

export type EventScheduleDayOfWeek =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6;

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_ALIASES: Readonly<Record<string, EventScheduleDayOfWeek>> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/** Parses a daily or weekly recurrence value. */
export function parseEventScheduleRecurrence(
  value?: string
): {
  readonly frequency: EventScheduleFrequency;
  readonly dayOfWeek?: EventScheduleDayOfWeek;
} {
  const normalized =
    value?.trim().toLowerCase() ||
    "daily";
  if (normalized === "daily") {
    return {
      frequency: "daily",
    };
  }

  const dayOfWeek =
    DAY_ALIASES[normalized];
  if (dayOfWeek !== undefined) {
    return {
      frequency: "weekly",
      dayOfWeek,
    };
  }

  throw new Error(
    `Arturo cannot repeat something "${value}". Use daily, or a day of the week such as friday.`
  );
}

/** Formats a recurrence for terminal output. */
export function formatEventScheduleRecurrence(
  schedule: Pick<EventSchedule, "frequency" | "dayOfWeek">
): string {
  if (schedule.frequency === "weekly") {
    return schedule.dayOfWeek === undefined
      ? "weekly"
      : `weekly · ${DAY_NAMES[schedule.dayOfWeek]}`;
  }
  return "daily";
}

type LocalDateTime = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

/** Parses one 24-hour HH:MM value. */
export function parseDailyTime(
  value: string
): {
  readonly hour: number;
  readonly minute: number;
} {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      value.trim()
    );
  if (!match) {
    throw new Error(
      `Invalid daily time: ${value}. Use 24-hour HH:MM, for example 09:00.`
    );
  }

  return {
    hour:
      Number(
        match[1]
      ),
    minute:
      Number(
        match[2]
      ),
  };
}

/** Validates and normalizes one IANA timezone name. */
export function validateEventScheduleTimezone(
  value: string
): string {
  const timezone =
    value.trim();
  if (!timezone) {
    throw new Error(
      "A timezone is required."
    );
  }

  try {
    new Intl.DateTimeFormat(
      "en-NZ",
      {
        timeZone:
          timezone,
      }
    ).format(
      new Date()
    );
  } catch {
    throw new Error(
      `Invalid timezone: ${value}. Use an IANA name such as Pacific/Auckland.`
    );
  }

  return timezone;
}

function getLocalDateTime(
  timestamp: number,
  timezone: string
): LocalDateTime {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          timezone,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date(
        timestamp
      )
    );
  const read =
    (
      type:
        Intl.DateTimeFormatPartTypes
    ): number =>
      Number(
        parts.find(
          (part) =>
            part.type ===
            type
        )?.value
      );

  return {
    year:
      read(
        "year"
      ),
    month:
      read(
        "month"
      ),
    day:
      read(
        "day"
      ),
    hour:
      read(
        "hour"
      ),
    minute:
      read(
        "minute"
      ),
    second:
      read(
        "second"
      ),
  };
}

function addLocalDays(
  input:
    Pick<
      LocalDateTime,
      "year" |
      "month" |
      "day"
    >,
  days: number
): Pick<
  LocalDateTime,
  "year" |
  "month" |
  "day"
> {
  const date =
    new Date(
      Date.UTC(
        input.year,
        input.month -
          1,
        input.day +
          days
      )
    );

  return {
    year:
      date.getUTCFullYear(),
    month:
      date.getUTCMonth() +
      1,
    day:
      date.getUTCDate(),
  };
}

function localDateTimeMatches(
  left:
    LocalDateTime,
  right:
    LocalDateTime
): boolean {
  return (
    left.year ===
      right.year &&
    left.month ===
      right.month &&
    left.day ===
      right.day &&
    left.hour ===
      right.hour &&
    left.minute ===
      right.minute
  );
}

/**
 * Resolves a local wall-clock date and time to an instant.
 *
 * During a daylight-saving gap, the first valid minute after the requested
 * local time is used. During an overlap, one occurrence is selected and the
 * stored nextRunAt prevents a second run.
 */
function resolveLocalDateTime(
  input:
    Omit<
      LocalDateTime,
      "second"
    >,
  timezone:
    string
): number {
  for (
    let adjustment =
      0;
    adjustment <=
      180;
    adjustment +=
      1
  ) {
    const adjustedDate =
      new Date(
        Date.UTC(
          input.year,
          input.month -
            1,
          input.day,
          input.hour,
          input.minute +
            adjustment
        )
      );
    const target:
      LocalDateTime =
      {
        year:
          adjustedDate
            .getUTCFullYear(),
        month:
          adjustedDate
            .getUTCMonth() +
          1,
        day:
          adjustedDate
            .getUTCDate(),
        hour:
          adjustedDate
            .getUTCHours(),
        minute:
          adjustedDate
            .getUTCMinutes(),
        second:
          0,
      };
    const targetAsUtc =
      Date.UTC(
        target.year,
        target.month -
          1,
        target.day,
        target.hour,
        target.minute
      );
    let candidate =
      targetAsUtc;

    for (
      let iteration =
        0;
      iteration <
        5;
      iteration +=
        1
    ) {
      const observed =
        getLocalDateTime(
          candidate,
          timezone
        );
      const observedAsUtc =
        Date.UTC(
          observed.year,
          observed.month -
            1,
          observed.day,
          observed.hour,
          observed.minute
        );
      const correction =
        targetAsUtc -
        observedAsUtc;
      candidate +=
        correction;
      if (
        correction ===
          0 &&
        localDateTimeMatches(
          getLocalDateTime(
            candidate,
            timezone
          ),
          target
        )
      ) {
        return candidate;
      }
    }
  }

  throw new Error(
    `Could not resolve ${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")} in ${timezone}.`
  );
}

/** Computes the first daily run strictly after the supplied instant. */
export function computeNextDailyEventScheduleRun(
  input: {
    readonly hour:
      number;
    readonly minute:
      number;
    readonly timezone:
      string;
    readonly after:
      number;
  }
): number {
  const localNow =
    getLocalDateTime(
      input.after,
      input.timezone
    );
  const today =
    resolveLocalDateTime(
      {
        year:
          localNow.year,
        month:
          localNow.month,
        day:
          localNow.day,
        hour:
          input.hour,
        minute:
          input.minute,
      },
      input.timezone
    );
  if (
    today >
    input.after
  ) {
    return today;
  }

  const tomorrow =
    addLocalDays(
      localNow,
      1
    );
  return resolveLocalDateTime(
    {
      ...tomorrow,
      hour:
        input.hour,
      minute:
        input.minute,
    },
    input.timezone
  );
}

/** Computes the first weekly run strictly after the supplied instant. */
export function computeNextWeeklyEventScheduleRun(
  input: {
    readonly dayOfWeek: EventScheduleDayOfWeek;
    readonly hour: number;
    readonly minute: number;
    readonly timezone: string;
    readonly after: number;
  }
): number {
  const localNow =
    getLocalDateTime(
      input.after,
      input.timezone
    );
  const localDayOfWeek =
    new Date(
      Date.UTC(
        localNow.year,
        localNow.month - 1,
        localNow.day
      )
    ).getUTCDay() as EventScheduleDayOfWeek;
  let daysUntil =
    (input.dayOfWeek - localDayOfWeek + 7) % 7;

  if (daysUntil === 0) {
    const today =
      resolveLocalDateTime(
        {
          year: localNow.year,
          month: localNow.month,
          day: localNow.day,
          hour: input.hour,
          minute: input.minute,
        },
        input.timezone
      );
    if (today > input.after) {
      return today;
    }
    daysUntil = 7;
  }

  const nextDate =
    addLocalDays(
      localNow,
      daysUntil
    );
  return resolveLocalDateTime(
    {
      ...nextDate,
      hour: input.hour,
      minute: input.minute,
    },
    input.timezone
  );
}

/** Computes the next run for any supported Event schedule recurrence. */
export function computeNextEventScheduleRun(
  input: {
    readonly frequency: EventScheduleFrequency;
    readonly dayOfWeek?: EventScheduleDayOfWeek;
    readonly hour: number;
    readonly minute: number;
    readonly timezone: string;
    readonly after: number;
  }
): number {
  if (input.frequency === "weekly") {
    if (input.dayOfWeek === undefined) {
      throw new Error(
        "A weekly Event schedule requires a weekday."
      );
    }
    return computeNextWeeklyEventScheduleRun({
      ...input,
      dayOfWeek: input.dayOfWeek,
    });
  }

  return computeNextDailyEventScheduleRun(input);
}

/** Creates a validated daily or weekly Task schedule. */
export function createEventSchedule(
  input:
    CreateEventScheduleInput
): EventSchedule {
  const enterpriseId =
    input.enterpriseId
      .trim();
  const owningJobId =
    input
      .owningJobId
      .trim();
  const taskId =
    input.taskId.trim();
  const taskLabel =
    input.taskLabel
      .trim();
  const searchQuery =
    input.searchQuery
      ?.trim();
  if (
    !enterpriseId ||
    !owningJobId ||
    !taskId ||
    !taskLabel
  ) {
    throw new Error(
      "Enterprise, owning Function, Task, and Task outcome are required."
    );
  }
  if (
    taskLabel.length >
    200
  ) {
    throw new Error(
      "The Task outcome must be 200 characters or fewer."
    );
  }

  const at =
    parseDailyTime(
      input.at
    );
  const timezone =
    validateEventScheduleTimezone(
      input.timezone
    );
  const createdAt =
    input.now ??
    Date.now();

  const recurrence =
    parseEventScheduleRecurrence(
      input.every
    );

  return {
    id:
      input.id ??
      `schedule-${crypto.randomUUID()}`,
    enterpriseId,
    owningJobId,
    taskId,
    taskLabel,
    ...recurrence,
    hour:
      at.hour,
    minute:
      at.minute,
    timezone,
    searchQuery:
      searchQuery ||
      undefined,
    enabled:
      true,
    nextRunAt:
      computeNextEventScheduleRun(
        {
          ...at,
          ...recurrence,
          timezone,
          after:
            createdAt,
        }
      ),
    createdAt,
  };
}

/** Formats the stored daily wall-clock time. */
export function formatEventScheduleTime(
  schedule:
    Pick<
      EventSchedule,
      "hour" |
      "minute"
    >
): string {
  return `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
}
