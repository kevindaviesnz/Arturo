import path from "node:path";

import {
  createRuntimeDatabase,
} from "./database";

export type RuntimeDatabaseEnvironment =
  Readonly<Record<string, string | undefined>>;

/**
 * Resolves one stable database location for every Arturo launch mode.
 * Tests always use an isolated in-memory database so they cannot erase
 * production data through store cleanup hooks.
 *
 * PURE: No side effects.
 */
export function resolveRuntimeDatabasePath(
  environment: RuntimeDatabaseEnvironment =
    process.env,
  applicationDirectory: string =
    path.resolve(
      __dirname,
      "../.."
    )
): string {
  const configuredPath =
    environment.ARTURO_RUNTIME_DATABASE_PATH
      ?.trim();

  if (configuredPath) {
    return path.resolve(
      configuredPath
    );
  }

  if (
    environment.NODE_ENV === "test" ||
    environment.VITEST === "true"
  ) {
    return ":memory:";
  }

  // Arturo's state is split across two resolvers: this database holds the
  // Enterprises, Workers, approvals and policies, while the approval signing
  // key and the runtime event log live under ARTURO_DATA_DIRECTORY. An operator
  // who relocates or backs up only one of them separates signed approvals from
  // the key that signs them. So when a data directory is chosen and no explicit
  // database path is, the database belongs inside it.
  const dataDirectory =
    environment.ARTURO_DATA_DIRECTORY
      ?.trim();

  return dataDirectory
    ? path.join(
        path.resolve(
          dataDirectory
        ),
        "worker-runtime.db"
      )
    : path.join(
        applicationDirectory,
        "worker-runtime.db"
      );
}

export const runtimeDb =
  createRuntimeDatabase(
    resolveRuntimeDatabasePath()
  );
