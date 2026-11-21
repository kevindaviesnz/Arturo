import { runtimeDb } from "./runtimeDatabase";

/**
 * Small persisted key/value settings for operator choices that must survive a
 * restart — the first user is the active model selection behind /model.
 *
 * Settings live in the runtime database rather than a side file so that
 * Arturo's state stays together: backing up or relocating the database moves
 * the operator's choices with it.
 */

export function saveRuntimeSetting(
  key: string,
  value: string
): void {
  runtimeDb.prepare(`
    INSERT INTO runtime_settings (key, value, updated_at)
    VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run({
    key,
    value,
    updatedAt: Date.now(),
  });
}

export function loadRuntimeSetting(
  key: string
): string | undefined {
  const row = runtimeDb.prepare(
    "SELECT value FROM runtime_settings WHERE key = ?"
  ).get(key) as { value?: unknown } | undefined;

  return row === undefined
    ? undefined
    : String(row.value);
}

export function clearRuntimeSetting(
  key: string
): void {
  runtimeDb.prepare(
    "DELETE FROM runtime_settings WHERE key = ?"
  ).run(key);
}
