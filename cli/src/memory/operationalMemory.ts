export type OperationalMemoryEntry = {
  readonly id: string;
  readonly scopeId: string;
  readonly content: string;
  readonly source: string | undefined;
  readonly createdAt: number;
  readonly updatedAt: number;
};

/**
 * Purpose: Creates an Operational Memory entry.
 *
 * Params:
 * - input: Memory entry creation input.
 *
 * Returns:
 * - Operational Memory entry.
 *
 * PURE: No side effects.
 */
export function createOperationalMemoryEntry(
  input: {
    readonly id: string;
    readonly scopeId: string;
    readonly content: string;
    readonly source?: string;
    readonly now?: number;
  }
): OperationalMemoryEntry {
  const now =
    input.now ?? Date.now();

  return {
    id:
      input.id,
    scopeId:
      input.scopeId,
    content:
      input.content,
    source:
      input.source,
    createdAt:
      now,
    updatedAt:
      now,
  };
}