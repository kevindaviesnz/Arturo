import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveRuntimeDatabasePath,
} from "./runtimeDatabase";

describe("runtimeDatabase", () => {
  it("uses an in-memory database during tests", () => {
    expect(
      resolveRuntimeDatabasePath(
        {
          NODE_ENV: "test",
        },
        "/opt/arturo/cli"
      )
    ).toBe(":memory:");
  });

  it("uses the application directory rather than the current working directory", () => {
    expect(
      resolveRuntimeDatabasePath(
        {},
        "/opt/arturo/cli"
      )
    ).toBe(
      path.join(
        "/opt/arturo/cli",
        "worker-runtime.db"
      )
    );
  });

  it("allows an explicit database location", () => {
    expect(
      resolveRuntimeDatabasePath(
        {
          ARTURO_RUNTIME_DATABASE_PATH:
            "/var/lib/arturo/runtime.db",
          NODE_ENV: "test",
        },
        "/opt/arturo/cli"
      )
    ).toBe(
      "/var/lib/arturo/runtime.db"
    );
  });
});

describe("runtimeDatabase state locality", () => {
  it("keeps the database with the approval signing key when a data directory is chosen", () => {
    expect(
      resolveRuntimeDatabasePath(
        {
          ARTURO_DATA_DIRECTORY: "/srv/arturo-state",
        },
        "/opt/arturo/cli"
      )
    ).toBe(
      path.join(
        "/srv/arturo-state",
        "worker-runtime.db"
      )
    );
  });

  it("still honours an explicit database path over the data directory", () => {
    expect(
      resolveRuntimeDatabasePath(
        {
          ARTURO_DATA_DIRECTORY: "/srv/arturo-state",
          ARTURO_RUNTIME_DATABASE_PATH: "/var/lib/arturo/runtime.db",
        },
        "/opt/arturo/cli"
      )
    ).toBe("/var/lib/arturo/runtime.db");
  });
});
