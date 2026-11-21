import fs from "fs";
import path from "path";
import { ExecutionEvent } from "./types";

import {
  resolveRuntimeDataDirectory,
} from "../storage/runtimeStoragePaths";

const FILE_PATH = path.join(
  resolveRuntimeDataDirectory(),
  "worker-events.jsonl"
);

export function appendEvent(event: ExecutionEvent) {
  fs.mkdirSync(
    path.dirname(FILE_PATH),
    {
      recursive: true,
    }
  );
  fs.appendFileSync(FILE_PATH, JSON.stringify(event) + "\n");
}

export function loadEvents(): ExecutionEvent[] {
  if (!fs.existsSync(FILE_PATH)) return [];

  return fs
    .readFileSync(FILE_PATH, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function loadTaskEvents(taskId: string): ExecutionEvent[] {
  return loadEvents().filter((e) => e.taskId === taskId);
}
