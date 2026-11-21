import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { writePrivateFileAtomic } from "./atomicFile";
import { resolveRuntimeDataDirectory } from "./runtimeStoragePaths";

export function resolveApprovalSigningSecretPath(): string {
  return path.join(resolveRuntimeDataDirectory(), "approval-signing-secret");
}

/** Loads or creates a private, stable local signing secret. */
export function loadOrCreateApprovalSigningSecret(
  filePath: string = resolveApprovalSigningSecretPath()
): string {
  try {
    const existing = fs.readFileSync(filePath, "utf8").trim();
    if (existing.length >= 32) return existing;
    throw new Error(`Stored approval signing secret is invalid: ${filePath}`);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const generated = randomBytes(32).toString("base64url");
  writePrivateFileAtomic(filePath, `${generated}\n`);
  return generated;
}
