import fs from "node:fs";
import crypto from "node:crypto";

import type {
  ApiSecretStore,
} from "../integrations/apiSecretStore";

import {
  createApiSecretStore,
} from "../integrations/apiSecretStore";

import {
  validateApiSecret,
} from "../integrations/apiSecret";

import {
  writePrivateFileAtomic,
} from "./atomicFile";

import {
  getRequiredRuntimeSecret,
} from "../runtime/runtimeSecrets";

type EncryptedApiSecretEnvelope = {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
};

/** Encrypts serialized API secrets with authenticated AES-256-GCM. */
export function encryptApiSecrets(
  value: string,
  secret: string
): string {
  const iv = crypto.randomBytes(12);
  const key = crypto
    .createHash("sha256")
    .update(secret)
    .digest();
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const envelope: EncryptedApiSecretEnvelope = {
    version: 1,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return JSON.stringify(envelope);
}

/** Decrypts and authenticates an API-secret envelope. */
export function decryptApiSecrets(
  value: string,
  secret: string
): string {
  const envelope =
    JSON.parse(value) as EncryptedApiSecretEnvelope;

  if (
    envelope.version !== 1 ||
    !envelope.iv ||
    !envelope.authTag ||
    !envelope.ciphertext
  ) {
    throw new Error(
      "API secret file is not a supported encrypted envelope"
    );
  }

  const key = crypto
    .createHash("sha256")
    .update(secret)
    .digest();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64")
  );
  decipher.setAuthTag(
    Buffer.from(envelope.authTag, "base64")
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(envelope.ciphertext, "base64")
    ),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Serializes API secret store.
 *
 * @param store API secret store.
 * @returns JSON string.
 *
 * PURE: No side effects.
 */
export function serializeApiSecrets(
  store: ApiSecretStore
): string {
  return JSON.stringify({
    secrets: store,
  });
}

/**
 * Deserializes API secret store.
 *
 * @param json JSON string.
 * @returns API secret store.
 *
 * PURE: No side effects.
 */
export function deserializeApiSecrets(
  json: string
): ApiSecretStore {
  const parsed = JSON.parse(json) as {
    secrets?: unknown;
  };

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !parsed.secrets ||
    typeof parsed.secrets !== "object" ||
    Array.isArray(parsed.secrets)
  ) {
    throw new Error(
      "API secret file has an invalid structure"
    );
  }

  const secrets =
    parsed.secrets as Record<string, unknown>;

  for (const [name, value] of Object.entries(secrets)) {
    if (
      !value ||
      typeof value !== "object" ||
      !validateApiSecret(
        value as Parameters<typeof validateApiSecret>[0]
      ).ok ||
      (value as { name?: unknown }).name !== name
    ) {
      throw new Error(
        `API secret '${name}' is invalid`
      );
    }
  }

  return secrets as ApiSecretStore;
}

/**
 * Saves API secrets to disk.
 *
 * @param filePath File path.
 * @param store API secret store.
 *
 * SIDE EFFECT:
 * Writes API secrets to disk.
 */
export function saveApiSecrets(
  filePath: string,
  store: ApiSecretStore
): void {
  writePrivateFileAtomic(
    filePath,
    encryptApiSecrets(
      serializeApiSecrets(store),
      getRequiredRuntimeSecret(
        process.env,
        "API_SECRET_ENCRYPTION_KEY"
      )
    )
  );
}

/**
 * Loads API secrets from disk.
 *
 * @param filePath File path.
 * @returns API secret store.
 *
 * SIDE EFFECT:
 * Reads API secrets from disk.
 */
export function loadApiSecrets(
  filePath: string
): ApiSecretStore {
  if (
    !fs.existsSync(filePath)
  ) {
    return createApiSecretStore();
  }

  return deserializeApiSecrets(
    decryptApiSecrets(
      fs.readFileSync(
        filePath,
        "utf8"
      ),
      getRequiredRuntimeSecret(
        process.env,
        "API_SECRET_ENCRYPTION_KEY"
      )
    )
  );
}
