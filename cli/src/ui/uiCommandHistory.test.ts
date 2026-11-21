import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendCommandHistory,
  CommandHistoryNavigator,
  loadCommandHistory,
  parseCommandHistory,
} from "./uiCommandHistory";

let testDirectory: string;
let historyPath: string;

beforeEach(() => {
  testDirectory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "arturo-command-history-"
      )
    );
  historyPath =
    path.join(
      testDirectory,
      "history.json"
    );
});

afterEach(() => {
  fs.rmSync(
    testDirectory,
    {
      recursive: true,
      force: true,
    }
  );
});

describe("uiCommandHistory", () => {
  it("persists submitted commands across independent loads", () => {
    appendCommandHistory(
      '/enterprise list',
      historyPath
    );
    appendCommandHistory(
      '/runtime start "Product Safety"',
      historyPath
    );

    expect(
      loadCommandHistory(
        historyPath
      )
    ).toEqual([
      "/enterprise list",
      '/runtime start "Product Safety"',
    ]);
  });

  it("ignores malformed persisted history", () => {
    expect(
      parseCommandHistory(
        "not json"
      )
    ).toEqual([]);
  });

  it("navigates backward and forward and restores the draft", () => {
    const navigator =
      new CommandHistoryNavigator([
        "/enterprise list",
        "/jobs",
      ]);

    expect(
      navigator.previous(
        "/function"
      )
    ).toBe("/jobs");
    expect(
      navigator.previous(
        "/jobs"
      )
    ).toBe("/enterprise list");
    expect(
      navigator.next(
        "/enterprise list"
      )
    ).toBe("/jobs");
    expect(
      navigator.next(
        "/jobs"
      )
    ).toBe("/function");
  });
});
