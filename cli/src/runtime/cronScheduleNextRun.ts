import type {
  CronSchedule,
} from "./cronSchedule";

/**
 * Calculates next execution time for cron schedule.
 *
 * @param schedule Parsed cron schedule.
 * @param now Current timestamp (ms).
 * @returns Next execution timestamp.
 *
 * PURE: No side effects.
 */
export function getNextCronExecutionTime(
  schedule: CronSchedule,
  now: number
): number {
  const date =
    new Date(now);

  if (
    schedule.type ===
    "every-minute"
  ) {
    date.setSeconds(0, 0);
    date.setMinutes(
      date.getMinutes() + 1
    );

    return date.getTime();
  }

  if (
    schedule.type ===
    "hourly"
  ) {
    date.setSeconds(0, 0);

    const candidate =
      new Date(date);

    candidate.setMinutes(
      schedule.minute
    );

    if (
      candidate.getTime() <= now
    ) {
      candidate.setHours(
        candidate.getHours() + 1
      );
    }

    return candidate.getTime();
  }

  const candidate =
    new Date(date);

  candidate.setSeconds(0, 0);

  candidate.setHours(
    schedule.hour
  );

  candidate.setMinutes(
    schedule.minute
  );

  if (
    candidate.getTime() <= now
  ) {
    candidate.setDate(
      candidate.getDate() + 1
    );
  }

  return candidate.getTime();
}