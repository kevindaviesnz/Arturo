import { afterEach, describe, expect, it } from "vitest";

import {
  clearRealPersonTest,
  formatRealPersonTestInstructions,
  isRealPersonTestPassed,
  realPersonTestOutcome,
  recordRealPersonTest,
} from "./realPersonTest";

afterEach(clearRealPersonTest);

describe("the real-person test gate", () => {
  it("starts not run, and only passes when the person was unaided", () => {
    expect(realPersonTestOutcome()).toBe("not_run");
    expect(isRealPersonTestPassed()).toBe(false);
    expect(
      recordRealPersonTest({
        outcome: "passed",
        personName: "Amy Clarke",
        recordedBy: "Kevin Brown",
        startedAt: 1,
        unaided: false,
      })
    ).toEqual({
      refused: "This test only passes if the person enrolled and signed off without help.",
    });
    const recorded = recordRealPersonTest({
      outcome: "passed",
      personName: "Amy Clarke",
      recordedBy: "Kevin Brown",
      startedAt: 1,
      enrolledAt: 2,
      signedOffAt: 3,
      unaided: true,
      timedMinutes: 18,
      now: 4,
    });
    expect(recorded).toMatchObject({ outcome: "passed", unaided: true, timedMinutes: 18 });
    expect(isRealPersonTestPassed()).toBe(true);
  });

  it("tells the owner to use the business's own tunnel, with the waits, and not the hosted relay", () => {
    const text = formatRealPersonTestInstructions();
    expect(text).toContain("hosted relay is not used");
    expect(text).toContain("PUBLIC_BASE_URL");
    expect(text).toContain("TLS must end here");
    expect(text).toContain("npx ts-node scripts/startOffTerminalListener.ts");
    expect(text).toContain("Wait 12 hours");
    expect(text).toContain("without help");
    expect(text).toContain("the rest is not built");
  });
});
