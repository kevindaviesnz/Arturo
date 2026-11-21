/**
 * Task Factory
 *
 * PURE FUNCTION
 */

import type { Task } from "./types";

export function createTask(
  type: string,
  payload: unknown,
  createdBy: "system" | "user" | "scheduler" = "user"
): Task {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    type,
    payload,
    state: {
      status: "pending",
      attempts: 0
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy
    }
  };
}