import type {
  ApiSecretStore,
} from "./apiSecretStore";

import {
  getApiSecret,
} from "./apiSecretStore";

export type SecretReference = {
  secretName: string;
};

export type SecretInjectionResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Creates secret reference.
 *
 * @param secretName Secret name.
 * @returns Secret reference.
 *
 * PURE: No side effects.
 */
export function createSecretReference(
  secretName: string
): SecretReference {
  return {
    secretName,
  };
}

/**
 * Resolves secret reference from store.
 *
 * @param store API secret store.
 * @param reference Secret reference.
 * @returns Secret injection result.
 *
 * PURE: No side effects.
 */
export function resolveSecretReference(
  store: ApiSecretStore,
  reference: SecretReference
): SecretInjectionResult {
  const secret =
    getApiSecret(
      store,
      reference.secretName
    );

  if (!secret) {
    return {
      ok: false,
      error:
        `Secret '${reference.secretName}' not found`,
    };
  }

  return {
    ok: true,
    value:
      secret.value,
  };
}