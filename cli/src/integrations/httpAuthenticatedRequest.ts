import type {
  ApiSecretStore,
} from "./apiSecretStore";

import {
  createBearerTokenAuth,
  resolveHttpAuthHeaders,
} from "./httpAuth";

import type {
  HttpCapabilityRequest,
} from "./httpCapabilityAdapter";

/**
 * Resolves auth headers for HTTP request.
 *
 * @param store API secret store.
 * @param request HTTP request.
 * @returns Headers or failure.
 *
 * PURE: No side effects.
 */
export function resolveHttpRequestAuthHeaders(
  store: ApiSecretStore,
  request: HttpCapabilityRequest
):
  | {
      ok: true;
      headers: Record<string, string>;
    }
  | {
      ok: false;
      error: string;
    } {
  const secretName =
    request.auth?.bearerTokenSecretName;

  if (!secretName) {
    return {
      ok: true,
      headers: {},
    };
  }

  return resolveHttpAuthHeaders(
    store,
    createBearerTokenAuth(
      secretName
    )
  );
}