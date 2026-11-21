import type {
  ApiSecretStore,
} from "./apiSecretStore";

import type {
  SecretReference,
} from "./apiSecretInjection";

import {
  resolveSecretReference,
} from "./apiSecretInjection";

export type HttpAuthInput = {
  bearerToken?: SecretReference;
};

export type HttpAuthResult =
  | {
      ok: true;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Creates bearer-token auth input.
 *
 * @param secretName Secret name.
 * @returns HTTP auth input.
 *
 * PURE: No side effects.
 */
export function createBearerTokenAuth(
  secretName: string
): HttpAuthInput {
  return {
    bearerToken: {
      secretName,
    },
  };
}

/**
 * Resolves HTTP auth headers from secret store.
 *
 * @param store API secret store.
 * @param auth HTTP auth input.
 * @returns HTTP auth result.
 *
 * PURE: No side effects.
 */
export function resolveHttpAuthHeaders(
  store: ApiSecretStore,
  auth: HttpAuthInput
): HttpAuthResult {
  if (!auth.bearerToken) {
    return {
      ok: true,
      headers: {},
    };
  }

  const resolved =
    resolveSecretReference(
      store,
      auth.bearerToken
    );

  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    headers: {
      authorization:
        `Bearer ${resolved.value}`,
    },
  };
}