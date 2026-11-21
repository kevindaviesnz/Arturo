export type CronSchedule =
  | {
      type: "every-minute";
    }
  | {
      type: "hourly";
      minute: number;
    }
  | {
      type: "daily";
      hour: number;
      minute: number;
    };

/**
 * Parses supported cron schedule expression.
 *
 * Supported:
 * - "* * * * *"
 * - "M * * * *"
 * - "M H * * *"
 *
 * @param expression Cron expression.
 * @returns Cron schedule.
 *
 * PURE: No side effects.
 */
export function parseCronSchedule(
  expression: string
): CronSchedule {
  const parts =
    expression.trim().split(/\s+/);

  if (parts.length !== 5) {
    throw new Error(
      "Cron expression must contain 5 fields"
    );
  }

  const [
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
  ] = parts;

  if (
    dayOfMonth !== "*" ||
    month !== "*" ||
    dayOfWeek !== "*"
  ) {
    throw new Error(
      "Only wildcard day/month fields are supported"
    );
  }

  if (
    minute === "*" &&
    hour === "*"
  ) {
    return {
      type: "every-minute",
    };
  }

  if (
    minute !== "*" &&
    hour === "*"
  ) {
    return {
      type: "hourly",
      minute:
        parseCronNumber(
          minute,
          0,
          59,
          "minute"
        ),
    };
  }

  if (
    minute !== "*" &&
    hour !== "*"
  ) {
    return {
      type: "daily",
      minute:
        parseCronNumber(
          minute,
          0,
          59,
          "minute"
        ),
      hour:
        parseCronNumber(
          hour,
          0,
          23,
          "hour"
        ),
    };
  }

  throw new Error(
    "Unsupported cron expression"
  );
}

/**
 * Parses bounded cron number field.
 *
 * @param value Cron field value.
 * @param min Minimum value.
 * @param max Maximum value.
 * @param label Field label.
 * @returns Parsed number.
 *
 * PURE: No side effects.
 */
export function parseCronNumber(
  value: string,
  min: number,
  max: number,
  label: string
): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid cron ${label}`
    );
  }

  const parsed =
    Number(value);

  if (
    parsed < min ||
    parsed > max
  ) {
    throw new Error(
      `Cron ${label} out of range`
    );
  }

  return parsed;
}