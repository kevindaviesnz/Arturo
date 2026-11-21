import type {
  DeadLetterQueue,
} from "./deadLetterQueue";

import {
  loadDeadLetterQueue,
} from "../storage/deadLetterQueueRepository";

/**
 * Recovers persisted dead-letter queue.
 *
 * @returns Persisted dead-letter queue.
 *
 * SIDE EFFECT:
 * - Reads dead-letter queue from disk.
 */
export function recoverDeadLetterQueue():
  DeadLetterQueue {
  return loadDeadLetterQueue();
}

/**
 * Gets recovered dead-letter job count.
 *
 * @param queue Dead-letter queue.
 * @returns Dead-letter job count.
 *
 * PURE: No side effects.
 */
export function getRecoveredDeadLetterJobCount(
  queue: DeadLetterQueue
): number {
  return queue.jobs.length;
}