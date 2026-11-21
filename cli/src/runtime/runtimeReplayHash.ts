import crypto from "node:crypto";

import {
  stableSerializeReplayState,
} from "./runtimeReplayVerification";

export type ReplayStateHash = string;

/**
 * Creates deterministic SHA-256 hash for replay state.
 *
 * @param value Replay state value.
 * @returns Stable replay state hash.
 *
 * PURE: No side effects.
 */
export function hashReplayState(
  value: unknown
): ReplayStateHash {
  return crypto
    .createHash("sha256")
    .update(
      stableSerializeReplayState(
        value
      )
    )
    .digest("hex");
}