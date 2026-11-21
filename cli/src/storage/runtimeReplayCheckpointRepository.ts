import fs from "node:fs";
import path from "node:path";
import { writePrivateFileAtomic } from "./atomicFile";

import type {
  RuntimeReplayCheckpoint,
} from "../runtime/runtimeReplayCheckpoint";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const RUNTIME_REPLAY_CHECKPOINT_PATH =
  path.join(
    DATA_DIR,
    "runtime-replay-checkpoint.json"
  );

/**
 * Ensures replay checkpoint data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT: Creates directory on disk when missing.
 */
export function ensureReplayCheckpointDataDir():
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
 * Serializes runtime replay checkpoint.
 *
 * @param checkpoint Runtime replay checkpoint.
 * @returns Serialized checkpoint.
 *
 * PURE: No side effects.
 */
export function serializeRuntimeReplayCheckpoint(
  checkpoint: RuntimeReplayCheckpoint
): string {
  return JSON.stringify(
    checkpoint,
    null,
    2
  );
}

/**
 * Parses runtime replay checkpoint.
 *
 * @param value Serialized checkpoint.
 * @returns Parsed runtime replay checkpoint.
 *
 * PURE: No side effects.
 */
export function parseRuntimeReplayCheckpoint(
  value: string
): RuntimeReplayCheckpoint {
  return JSON.parse(
    value
  ) as RuntimeReplayCheckpoint;
}

/**
 * Saves runtime replay checkpoint to disk.
 *
 * @param checkpoint Runtime replay checkpoint.
 * @returns Runtime replay checkpoint.
 *
 * SIDE EFFECT: Writes checkpoint to disk.
 */
export function saveRuntimeReplayCheckpoint(
  checkpoint: RuntimeReplayCheckpoint
): RuntimeReplayCheckpoint {
  ensureReplayCheckpointDataDir();

  writePrivateFileAtomic(
    RUNTIME_REPLAY_CHECKPOINT_PATH,
    serializeRuntimeReplayCheckpoint(checkpoint)
  );

  return checkpoint;
}

/**
 * Loads runtime replay checkpoint from disk.
 *
 * @returns Runtime replay checkpoint or undefined.
 *
 * SIDE EFFECT: Reads checkpoint from disk.
 */
export function loadRuntimeReplayCheckpoint():
  | RuntimeReplayCheckpoint
  | undefined {
  if (
    !fs.existsSync(
      RUNTIME_REPLAY_CHECKPOINT_PATH
    )
  ) {
    return undefined;
  }

  return parseRuntimeReplayCheckpoint(
    fs.readFileSync(
      RUNTIME_REPLAY_CHECKPOINT_PATH,
      "utf8"
    )
  );
}

/**
 * Clears persisted runtime replay checkpoint.
 *
 * @returns void
 *
 * SIDE EFFECT: Deletes checkpoint file when present.
 */
export function clearRuntimeReplayCheckpoint():
  void {
  if (
    fs.existsSync(
      RUNTIME_REPLAY_CHECKPOINT_PATH
    )
  ) {
    fs.unlinkSync(
      RUNTIME_REPLAY_CHECKPOINT_PATH
    );
  }
}
