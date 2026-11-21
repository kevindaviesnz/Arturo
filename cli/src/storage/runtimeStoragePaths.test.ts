import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

describe("runtimeStoragePaths", () => {
  it("isolates test files from production state", () => {
    expect(
      resolveRuntimeDataDirectory(
        {
          VITEST: "true",
        },
        "/opt/arturo/cli",
        "/tmp",
        42
      )
    ).toBe(
      path.join(
        "/tmp",
        "arturo-tests-42"
      )
    );
  });

  it("uses a stable application data directory in production", () => {
    expect(
      resolveRuntimeDataDirectory(
        {},
        "/opt/arturo/cli",
        "/tmp",
        42
      )
    ).toBe(
      path.join(
        "/opt/arturo/cli",
        ".data"
      )
    );
  });
});
