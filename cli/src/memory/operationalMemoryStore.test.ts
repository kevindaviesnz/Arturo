import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addOperationalMemory,
  clearOperationalMemory,
  ensureChapterEightOperationalMemory,
  listOperationalMemory,
  isOperationalMemoryEligibleForExecution,
  isRetainedOperationalLesson,
} from "./operationalMemoryStore";

describe("operationalMemoryStore", () => {
  beforeEach(() => {
    clearOperationalMemory();
  });

  it("adds and lists Operational Memory", () => {
    addOperationalMemory({
      scopeId: "enterprise-1",
      content: "Customer prefers SMS reminders.",
      source: "test",
      now: 1,
    });

    expect(
      listOperationalMemory(
        "enterprise-1"
      ).map(
        (entry) => entry.content
      )
    ).toEqual([
      "Customer prefers SMS reminders.",
    ]);
  });

  it("keeps memory scoped", () => {
    addOperationalMemory({
      scopeId: "enterprise-1",
      content: "Enterprise memory.",
    });

    addOperationalMemory({
      scopeId: "enterprise-2",
      content: "Other enterprise memory.",
    });

    expect(
      listOperationalMemory(
        "enterprise-1"
      ).map(
        (entry) => entry.content
      )
    ).toEqual([
      "Enterprise memory.",
    ]);
  });

  it("does not fabricate Chapter 8 memory when empty", () => {
    const entries =
      ensureChapterEightOperationalMemory();

    expect(
      entries.map(
        (entry) => entry.content
      )
    ).toEqual([]);
  });

  it("quarantines model-derived memory while allowing explicit human or verified sources", () => {
    const legacy = addOperationalMemory({ content: "Model lesson", source: "runtime-outcome:job-1" });
    const manual = addOperationalMemory({ content: "Founder instruction", source: "manual" });
    const verified = addOperationalMemory({ content: "Verified result", source: "verified:source-1" });
    expect(isOperationalMemoryEligibleForExecution(legacy)).toBe(false);
    expect(isOperationalMemoryEligibleForExecution(manual)).toBe(true);
    expect(isOperationalMemoryEligibleForExecution(verified)).toBe(true);
    expect(isRetainedOperationalLesson(legacy)).toBe(false);
    expect(isRetainedOperationalLesson(manual)).toBe(false);
    expect(isRetainedOperationalLesson(verified)).toBe(true);
  });

  it("leaves empty Chapter 8 memory unchanged across reads", () => {
    ensureChapterEightOperationalMemory();
    ensureChapterEightOperationalMemory();

    expect(
      listOperationalMemory()
    ).toHaveLength(0);
  });
});
