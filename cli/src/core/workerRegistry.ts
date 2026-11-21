/**
 * Worker Registry (Pure Functional Core)
 *
 * Side Effects: ❌ NONE
 */

export type WorkerState = Set<string>;

export function createState(initial: string[] = []): WorkerState {
  return new Set(initial);
}

export function addWorker(state: WorkerState, name: string): WorkerState {
  const cleaned = name?.trim();

  // ✅ core invariant enforcement
  if (!cleaned) {
    throw new Error("Worker name cannot be empty");
  }

  if (state.has(cleaned)) {
    throw new Error(`Worker '${cleaned}' already exists`);
  }

  const next = new Set(state);
  next.add(cleaned);
  return next;
}

export function listWorkers(state: WorkerState): string[] {
  return Array.from(state);
}