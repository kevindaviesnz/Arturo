/**
 * Durable runtime event publisher for the CLI.
 *
 * Persists named operational events into `runtimeEventStore` for `/timeline`,
 * `/events`, and deterministic replay without any HTTP or WebSocket server.
 */
import crypto from "node:crypto";
import type { RuntimeLevel } from "../types/runtime";
import { appendRuntimeEventToStore } from "./runtimeEventStore";

/**
 * Records a named runtime event in the immutable runtime event log.
 *
 * SIDE EFFECT: Persists runtime event log state.
 */
export function broadcastEvent(
  type: string,
  level: RuntimeLevel,
  message: string
): void {
  appendRuntimeEventToStore({
    id: crypto.randomUUID(),
    type,
    level,
    message,
    timestamp: Date.now(),
  });
}
