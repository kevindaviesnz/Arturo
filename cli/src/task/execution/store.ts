/**
 * In-memory execution store
 * Backing store for task/execution/replay.ts
 */

const store = new Map<string, unknown>();

export const executionStore = {
  get(id: string): unknown {
    return store.get(id);
  },

  set(id: string, value: unknown): void {
    store.set(id, value);
  },

  delete(id: string): void {
    store.delete(id);
  },

  has(id: string): boolean {
    return store.has(id);
  }
};