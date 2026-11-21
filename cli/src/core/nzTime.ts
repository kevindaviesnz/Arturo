/**
 * Times as a person in New Zealand reads them: "10 Nov 2026, 12:57 pm NZDT",
 * or "NZST" in winter (Amy, addendum 1: anything read or exported shows NZ
 * time with the zone). A date with no time still uses NZ time to decide the
 * day.
 *
 * Display only. Stored times stay as they are (milliseconds or ISO strings,
 * UTC): they are compared, sorted and replayed, and a formatted string is
 * not a timestamp. The company page has the same rule written into its
 * script (companyView.ts nzAt / nzDay); companyView.test.ts checks the two
 * agree.
 *
 * PURE: No side effects.
 */

export const NZ_TIME_ZONE = "Pacific/Auckland";

const AT = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

const DAY = new Intl.DateTimeFormat("en-NZ", {
  timeZone: NZ_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** The zone's name: NZDT or NZST, whatever the runtime's locale data calls it. PURE. */
function zoneLabel(raw: string): string {
  if (/^NZ[DS]T$/.test(raw)) return raw;
  // Some runtimes say "GMT+13" rather than the abbreviation.
  if (/^(GMT|UTC)\+13(:00)?$/.test(raw)) return "NZDT";
  if (/^(GMT|UTC)\+12(:00)?$/.test(raw)) return "NZST";
  return raw;
}

/** A valid Date from a stored time, or undefined. PURE. */
function dateOf(value: number | string | Date | undefined | null): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * "10 Nov 2026, 12:57 pm NZDT". An empty or unreadable time gives "".
 *
 * PURE: No side effects.
 */
export function formatNzTime(value: number | string | Date | undefined | null): string {
  const date = dateOf(value);
  if (!date) return "";
  const part = (type: string) => AT.formatToParts(date).find((one) => one.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} ${part("dayPeriod").toLowerCase()} ${zoneLabel(part("timeZoneName"))}`;
}

/**
 * "10 Nov 2026", the day as it is in New Zealand. An empty or unreadable time gives "".
 *
 * PURE: No side effects.
 */
export function formatNzDay(value: number | string | Date | undefined | null): string {
  const date = dateOf(value);
  if (!date) return "";
  const part = (type: string) => DAY.formatToParts(date).find((one) => one.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}`;
}
