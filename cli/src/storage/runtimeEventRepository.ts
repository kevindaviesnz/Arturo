import fs from "fs";
import path from "path";
import { writePrivateFileAtomic } from "./atomicFile";

import {
  createRuntimeEventLog,
  parseRuntimeEventLog,
  serializeRuntimeEventLog,
  type RuntimeEventLog,
} from "../runtime/runtimeEventLog";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const RUNTIME_EVENT_LOG_PATH =
  path.join(
    DATA_DIR,
    "runtime-events.json"
  );

/**
 * Ensures runtime event data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT: Creates directory on disk when missing.
 */
export function ensureRuntimeEventDataDir():
  void {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive: true,
      mode: 0o700,
    }
  );
}

/**
 * Safely reads runtime event log file.
 *
 * @returns Runtime event log file content,
 * or undefined when file is missing.
 *
 * SIDE EFFECT:
 * - Reads runtime event log file from disk.
 */
export function readRuntimeEventLogFile():
  | string
  | undefined {
  try {
    return fs.readFileSync(
      RUNTIME_EVENT_LOG_PATH,
      "utf8"
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Saves runtime event log to disk.
 *
 * @param log Runtime event log to persist.
 * @returns Runtime event log.
 *
 * SIDE EFFECT: Writes runtime event log to disk.
 */
export function saveRuntimeEventLog(
  log: RuntimeEventLog
): RuntimeEventLog {
  ensureRuntimeEventDataDir();

  writePrivateFileAtomic(
    RUNTIME_EVENT_LOG_PATH,
    serializeRuntimeEventLog(log)
  );

  return log;
}

/**
 * Loads runtime event log from disk.
 *
 * @returns Persisted runtime event log,
 * or empty log when missing.
 *
 * SIDE EFFECT:
 * - Reads runtime event log from disk.
 */
export function loadRuntimeEventLog():
  RuntimeEventLog {
  const value =
    readRuntimeEventLogFile();

  if (!value) {
    return createRuntimeEventLog();
  }

  const trimmed =
    value.trim();

  if (
    trimmed.length === 0
  ) {
    return createRuntimeEventLog();
  }

  return parseRuntimeEventLog(
    trimmed
  );
}

/**
 * Clears persisted runtime event log.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Deletes runtime event log file when present.
 */
export function clearRuntimeEventLog():
  void {
  if (
    fs.existsSync(
      RUNTIME_EVENT_LOG_PATH
    )
  ) {
    fs.unlinkSync(
      RUNTIME_EVENT_LOG_PATH
    );
  }
}
