/**
 * Worker Contract
 *
 * PURE FUNCTIONS ONLY
 */

import type { Task } from "./types";

export type Effect =
  | { type: "log"; message: string };

export type WorkerResult = {
  task: Task;
  next?: string;
  effects?: Effect[];
  waitFor?: "human" | "time";
};

export type Worker = (task: Task) => WorkerResult;

export type Flow = {
  workers: Record<string, Worker>;
};