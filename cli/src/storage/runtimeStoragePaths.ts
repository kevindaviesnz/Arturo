import os from "node:os";
import path from "node:path";

export type RuntimeStorageEnvironment =
  Readonly<Record<string, string | undefined>>;

/**
 * Resolves a stable directory for Arturo's file-backed runtime state.
 * Test processes receive a separate temporary directory.
 *
 * PURE: No side effects.
 */
export function resolveRuntimeDataDirectory(
  environment: RuntimeStorageEnvironment =
    process.env,
  applicationDirectory: string =
    path.resolve(
      __dirname,
      "../.."
    ),
  temporaryDirectory: string =
    os.tmpdir(),
  processId: number =
    process.pid
): string {
  const configuredDirectory =
    environment.ARTURO_DATA_DIRECTORY
      ?.trim();

  if (configuredDirectory) {
    return path.resolve(
      configuredDirectory
    );
  }

  if (
    environment.NODE_ENV === "test" ||
    environment.VITEST === "true"
  ) {
    return path.join(
      temporaryDirectory,
      `arturo-tests-${processId}`
    );
  }

  return path.join(
    applicationDirectory,
    ".data"
  );
}
