import fs from "node:fs";
import path from "node:path";

import {
  loadOrCreateApprovalSigningSecret,
} from "../storage/approvalSigningSecret";

import {
  resolveRuntimeDataDirectory,
} from "../storage/runtimeStoragePaths";

const APPROVAL_SIGNING_SECRET_KEY =
  "APPROVAL_SIGNING_SECRET";

const APPROVAL_SIGNING_SECRET_FILE_KEY =
  "APPROVAL_SIGNING_SECRET_FILE";

/**
 * Checks whether a secret value is usable.
 *
 * @param value Secret value to inspect.
 * @returns True when the secret is non-empty and not a placeholder.
 *
 * PURE: No side effects.
 */
export function isUsableRuntimeSecret(
  value: string | undefined
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 32 &&
    !/^(change-me|replace-with-random-secret|local-dev-)/i.test(value.trim())
  );
}

/**
 * Reads a required runtime secret from an environment-like object.
 *
 * @param env Environment-like key/value map.
 * @param key Required secret key.
 * @returns Validated secret value.
 *
 * PURE: No side effects. Reads only the supplied object.
 */
export function getRequiredRuntimeSecret(
  env: NodeJS.ProcessEnv,
  key: string
): string {
  const value = env[key];

  if (
    !isUsableRuntimeSecret(value)
  ) {
    throw new Error(
      `${key} is required, must contain at least 32 characters, and must not be a placeholder`
    );
  }

  return value;
}

function normalizeConfiguredSecret(
  value: string
): string {
  return value.trim();
}

function isPathInsideOrEqual(
  parentPath: string,
  childPath: string
): boolean {
  const relative =
    path.relative(
      parentPath,
      childPath
    );

  return (
    relative === "" ||
    (
      !relative.startsWith("..") &&
      !path.isAbsolute(
        relative
      )
    )
  );
}

function validateSecretFilePermissions(
  filePath: string,
  stat: fs.Stats
): void {
  if (process.platform === "win32") {
    return;
  }

  if (
    (
      stat.mode &
      0o077
    ) !== 0
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must not be readable, writable, or executable by group or others: ${filePath}`
    );
  }
}

function readApprovalSigningSecretFile(
  env: NodeJS.ProcessEnv,
  filePath: string
): string {
  if (
    !path.isAbsolute(
      filePath
    )
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must be an absolute path`
    );
  }

  const configuredPath =
    path.resolve(
      filePath
    );

  const dataDirectory =
    resolveRuntimeDataDirectory(
      env
    );

  const configuredDataDirectory =
    path.resolve(
      dataDirectory
    );

  if (
    isPathInsideOrEqual(
      configuredDataDirectory,
      configuredPath
    )
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must be outside ARTURO_DATA_DIRECTORY`
    );
  }

  const resolvedPath =
    fs.realpathSync(
      configuredPath
    );

  const resolvedDataDirectory =
    fs.existsSync(
      dataDirectory
    )
      ? fs.realpathSync(
          dataDirectory
        )
      : path.resolve(
          dataDirectory
        );

  if (
    isPathInsideOrEqual(
      resolvedDataDirectory,
      resolvedPath
    )
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must be outside ARTURO_DATA_DIRECTORY`
    );
  }

  const stat =
    fs.statSync(
      resolvedPath
    );

  if (
    !stat.isFile()
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must point to a regular file`
    );
  }

  validateSecretFilePermissions(
    resolvedPath,
    stat
  );

  const value =
    normalizeConfiguredSecret(
      fs.readFileSync(
        resolvedPath,
        "utf8"
      )
    );

  if (
    !isUsableRuntimeSecret(
      value
    )
  ) {
    throw new Error(
      `${APPROVAL_SIGNING_SECRET_FILE_KEY} must contain at least 32 characters and must not be a placeholder`
    );
  }

  return value;
}

function getConfiguredApprovalSigningSecret(
  env: NodeJS.ProcessEnv
): string | undefined {
  if (
    isUsableRuntimeSecret(
      env[APPROVAL_SIGNING_SECRET_KEY]
    )
  ) {
    return normalizeConfiguredSecret(
      env[APPROVAL_SIGNING_SECRET_KEY]
    );
  }

  const filePath =
    env[APPROVAL_SIGNING_SECRET_FILE_KEY]
      ?.trim();

  if (!filePath) {
    return undefined;
  }

  return readApprovalSigningSecretFile(
    env,
    filePath
  );
}

/**
 * Reads the approval signing secret.
 *
 * @param env Environment-like key/value map.
 * @returns Approval signing secret.
 *
 * SIDE EFFECT: May read a configured external secret file.
 */
export function getApprovalSigningSecret(
  env: NodeJS.ProcessEnv
): string {
  const configured =
    getConfiguredApprovalSigningSecret(
      env
    );

  if (configured) {
    return configured;
  }

  throw new Error(
    `${APPROVAL_SIGNING_SECRET_KEY} or ${APPROVAL_SIGNING_SECRET_FILE_KEY} is required, must contain at least 32 characters, and must not be a placeholder`
  );
}

/**
 * Whether a networked server is running. In networked mode the approval signing
 * secret must be supplied externally; auto-provisioning a secret next to the
 * approval store (which any local/in-process actor could then read and re-sign
 * with) is refused.
 */
let networkedRuntimeMode = false;

/**
 * Marks the process as running a networked server (fail-closed approval secret).
 * This is a one-way latch: once networked mode is on, it cannot be silently
 * turned off by later code, so ambient callers cannot re-enable secret
 * auto-provisioning. Use `resetNetworkedRuntimeModeForTests` to reset in tests.
 */
export function setNetworkedRuntimeMode(
  enabled = true
): void {
  if (enabled) {
    networkedRuntimeMode = true;
  }
}

/** Test-only: clears the networked-mode latch. Never call from production code. */
export function resetNetworkedRuntimeModeForTests(): void {
  networkedRuntimeMode = false;
}

/** Returns whether the process is in networked (fail-closed) mode. */
export function isNetworkedRuntimeMode(): boolean {
  return networkedRuntimeMode;
}

/**
 * Requires an externally configured approval signing secret and marks the
 * process networked. Servers call this at startup so the secret is validated
 * fail-fast rather than lazily at first approval.
 */
export function requireNetworkedApprovalSigningSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  setNetworkedRuntimeMode(true);
  return getApprovalSigningSecret(env);
}

/**
 * Uses an explicit configured secret, or provisions a private secret for
 * offline local mode only. In networked mode a missing secret fails closed.
 */
export function getLocalApprovalSigningSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured =
    getConfiguredApprovalSigningSecret(
      env
    );

  if (configured) {
    return configured;
  }

  if (networkedRuntimeMode) {
    throw new Error(
      "APPROVAL_SIGNING_SECRET or APPROVAL_SIGNING_SECRET_FILE is required when a networked server is running. " +
        "Refusing to auto-provision a co-located approval signing secret; set " +
        "one of them to at least 32 non-placeholder characters."
    );
  }

  return loadOrCreateApprovalSigningSecret();
}
