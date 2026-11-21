import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearRuntimeSetting,
  loadRuntimeSetting,
  saveRuntimeSetting,
} from "./settingsRepository";

describe("settingsRepository", () => {
  afterEach(() => {
    clearRuntimeSetting("test.key");
  });

  it("returns undefined for a key never written", () => {
    expect(loadRuntimeSetting("test.key")).toBeUndefined();
  });

  it("round-trips a value", () => {
    saveRuntimeSetting("test.key", "hello");
    expect(loadRuntimeSetting("test.key")).toBe("hello");
  });

  it("overwrites on a second save rather than duplicating", () => {
    saveRuntimeSetting("test.key", "first");
    saveRuntimeSetting("test.key", "second");
    expect(loadRuntimeSetting("test.key")).toBe("second");
  });

  it("clears a value back to absent", () => {
    saveRuntimeSetting("test.key", "hello");
    clearRuntimeSetting("test.key");
    expect(loadRuntimeSetting("test.key")).toBeUndefined();
  });
});
