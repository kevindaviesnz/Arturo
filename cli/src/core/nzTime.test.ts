import { describe, expect, it } from "vitest";

import { formatNzDay, formatNzTime } from "./nzTime";

describe("NZ time for people to read", () => {
  it("shows summer time with NZDT", () => {
    expect(formatNzTime(Date.UTC(2026, 10, 9, 23, 57))).toBe("10 Nov 2026, 12:57 pm NZDT");
  });

  it("shows winter time with NZST", () => {
    expect(formatNzTime(Date.UTC(2026, 5, 1, 3, 40))).toBe("1 Jun 2026, 3:40 pm NZST");
  });

  it("decides the day in New Zealand, not UTC", () => {
    // 11:30 am UTC on 10 Nov is 12:30 am on 11 Nov in Auckland.
    expect(formatNzDay(Date.UTC(2026, 10, 10, 11, 30))).toBe("11 Nov 2026");
  });

  it("reads ISO strings and leaves nothing for an unreadable time", () => {
    expect(formatNzTime("2026-11-09T23:57:00.000Z")).toBe("10 Nov 2026, 12:57 pm NZDT");
    expect(formatNzTime(undefined)).toBe("");
    expect(formatNzTime("not a time")).toBe("");
    expect(formatNzDay(undefined)).toBe("");
  });
});
