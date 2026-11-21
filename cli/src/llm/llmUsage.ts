let tokensUsed = 0;

/** Adds trusted provider token metadata to the current Arturo session total. */
export function recordLlmTokenUsage(
  count: number | undefined
): void {
  if (
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    count <= 0
  ) {
    return;
  }

  tokensUsed += Math.floor(
    count
  );
}

/** Returns tokens consumed by model calls in the current Arturo session. */
export function getLlmTokensUsed(): number {
  return tokensUsed;
}

/** Resets session usage. Intended for isolated tests. */
export function resetLlmTokenUsage(): void {
  tokensUsed = 0;
}
