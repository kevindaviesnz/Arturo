import fs from "fs";
import path from "path";
import { writePrivateFileAtomic } from "./atomicFile";

import {
  createDeadLetterQueue,
  type DeadLetterQueue,
} from "../runtime/deadLetterQueue";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

const DATA_DIR =
  resolveRuntimeDataDirectory();

const DEAD_LETTER_QUEUE_PATH =
  path.join(
    DATA_DIR,
    "dead-letter-queue.json"
  );

/**
 * Ensures dead-letter queue data directory exists.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates data directory on disk when missing.
 */
export function ensureDeadLetterQueueDataDir():
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
 * Serializes dead-letter queue.
 *
 * @param queue Dead-letter queue.
 * @returns Serialized dead-letter queue.
 *
 * PURE: No side effects.
 */
export function serializeDeadLetterQueue(
  queue: DeadLetterQueue
): string {
  return JSON.stringify(
    queue,
    null,
    2
  );
}

/**
 * Parses serialized dead-letter queue.
 *
 * @param value Serialized dead-letter queue.
 * @returns Dead-letter queue.
 *
 * PURE: No side effects.
 */
export function parseDeadLetterQueue(
  value: string
): DeadLetterQueue {
  if (
    value.trim().length === 0
  ) {
    return createDeadLetterQueue();
  }

  return JSON.parse(
    value
  ) as DeadLetterQueue;
}

/**
 * Checks whether persisted dead-letter queue exists.
 *
 * @returns True when persisted queue exists.
 *
 * SIDE EFFECT:
 * - Reads filesystem metadata.
 */
export function deadLetterQueueExists():
  boolean {
  return fs.existsSync(
    DEAD_LETTER_QUEUE_PATH
  );
}

/**
 * Saves dead-letter queue to disk.
 *
 * @param queue Dead-letter queue.
 * @returns Dead-letter queue.
 *
 * SIDE EFFECT:
 * - Writes dead-letter queue to disk.
 */
export function saveDeadLetterQueue(
  queue: DeadLetterQueue
): DeadLetterQueue {
  ensureDeadLetterQueueDataDir();

  writePrivateFileAtomic(
    DEAD_LETTER_QUEUE_PATH,
    serializeDeadLetterQueue(queue)
  );

  return queue;
}

/**
 * Loads dead-letter queue from disk.
 *
 * @returns Persisted dead-letter queue, or empty queue when missing.
 *
 * SIDE EFFECT:
 * - Reads dead-letter queue from disk.
 */
export function loadDeadLetterQueue():
  DeadLetterQueue {
  if (
    !deadLetterQueueExists()
  ) {
    return createDeadLetterQueue();
  }

  return parseDeadLetterQueue(
    fs.readFileSync(
      DEAD_LETTER_QUEUE_PATH,
      "utf8"
    )
  );
}

/**
 * Clears persisted dead-letter queue.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Deletes dead-letter queue file when present.
 */
export function clearDeadLetterQueue():
  void {
  if (
    deadLetterQueueExists()
  ) {
    fs.unlinkSync(
      DEAD_LETTER_QUEUE_PATH
    );
  }
}
