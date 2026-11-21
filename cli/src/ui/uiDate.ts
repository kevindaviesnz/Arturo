/**
 * Dates as a person writes them: 8 August 2026.
 *
 * Every display site rendered a raw `toISOString()` —
 * `2026-08-10T10:33:10.917Z` — which carries a millisecond precision nothing
 * about a business record needs, and reads as machine output in the middle of
 * a page of plain English.
 *
 * Display only. The stored records keep their ISO strings: they are compared,
 * sorted and replayed, and a localised string is not a timestamp.
 *
 * The day is the day in New Zealand (Pacific/Auckland), whatever the
 * machine's own zone (Amy, addendum 1), so a record made at 9 am NZ time is
 * not shown as the day before.
 *
 * PURE: No side effects.
 */

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Pacific/Auckland",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Formats a millisecond timestamp for reading, not for storage. */
export function formatDisplayDate(
  value: number | string | undefined
): string {
  if (value === undefined) return "(not recorded)";

  const date = new Date(value);
  // An unparseable stored value must not become "Invalid Date" on screen.
  if (Number.isNaN(date.getTime())) return "(not recorded)";

  return DAY_MONTH_YEAR.format(date);
}
