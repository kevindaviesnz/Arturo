import fs from "node:fs";
import path from "node:path";

/**
 * Saves a provider API key so a paid model can be used, without the operator
 * ever touching a config file. The key is written to the gitignored `.env`
 * (the same file Arturo already loads at startup) and set on the running
 * process so it takes effect immediately.
 *
 * A key is a secret: it is never echoed back to the operator or logged. This
 * module only writes it to the local env file on the operator-trusted host.
 */

/** The `.env` file Arturo loads (dotenv reads it from the app's working dir). */
export function getEnvFilePath(
  appRoot: string = path.resolve(__dirname, "../..")
): string {
  return path.join(appRoot, ".env");
}

/**
 * Whether a key looks superficially plausible (non-empty, no newline, not an
 * obvious placeholder). This is a typo guard, not validation of the real key.
 *
 * PURE: No side effects.
 */
export function looksLikePlausibleKey(
  value: string
): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 8 &&
    !/\s/.test(trimmed) &&
    !/^<.*>$/.test(trimmed) &&
    !/^your[-_]/i.test(trimmed)
  );
}

/**
 * Upserts `NAME=value` in the env file, preserving every other line. Creates
 * the file if it does not exist.
 *
 * PURE: No side effects (string transform only).
 */
export function upsertEnvLine(
  existing: string,
  name: string,
  value: string
): string {
  const line = `${name}=${value}`;
  const lines = existing.length ? existing.split("\n") : [];
  const pattern = new RegExp(`^${name}=`);
  let replaced = false;

  const next = lines.map((current) => {
    if (pattern.test(current.trimStart())) {
      replaced = true;
      return line;
    }
    return current;
  });

  if (!replaced) {
    // Keep a single trailing newline tidy.
    if (next.length && next[next.length - 1] === "") {
      next.splice(next.length - 1, 0, line);
    } else {
      next.push(line);
    }
  }

  const joined = next.join("\n");
  return joined.endsWith("\n") ? joined : `${joined}\n`;
}

/**
 * Persists an API key to `.env` and to the running process.
 *
 * SIDE EFFECT:
 * - Reads and writes the local `.env` file.
 * - Sets process.env[name] for the current session.
 */
export function saveApiKey(
  name: string,
  value: string,
  envFilePath: string = getEnvFilePath()
): void {
  const trimmed = value.trim();
  const existing = fs.existsSync(envFilePath)
    ? fs.readFileSync(envFilePath, "utf8")
    : "";

  fs.writeFileSync(
    envFilePath,
    upsertEnvLine(existing, name, trimmed),
    { mode: 0o600 }
  );

  process.env[name] = trimmed;
}

/** Whether a provider API key is already set in the environment. */
export function hasApiKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}
