// src/control/eventStore.ts

export type Event = {
  pid: number;
  type: string;
  name?: string;
  message?: string;
  state?: string;
  ts: number;
};

const store: Record<number, Event[]> = {};

/**
 * Records a kernel/process event.
 *
 * @param e Event to record.
 * @returns void
 *
 * SIDE EFFECT: Mutates the in-memory event store.
 */
export function recordEvent(
  e: Event
): void {
  const current =
    store[e.pid] ?? [];

  store[e.pid] = [
    ...current,
    e,
  ];
}

/**
 * Gets process events for a pid.
 *
 * @param pid Process id.
 * @returns Events for the process.
 *
 * SIDE EFFECT: Reads from the in-memory event store.
 */
export function getEvents(
  pid: number
): Event[] {
  return [
    ...(store[pid] || []),
  ];
}

/**
 * Clears all process events.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the in-memory event store.
 */
export function clearEvents(): void {
  for (const key of Object.keys(store)) {
    delete store[Number(key)];
  }
}