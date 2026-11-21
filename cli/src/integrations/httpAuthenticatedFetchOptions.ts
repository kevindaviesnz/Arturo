import type {
  ApiSecretStore,
} from "./apiSecretStore";

import type {
  HttpCapabilityRequest,
  HttpMethod,
} from "./httpCapabilityAdapter";

import {
  createHttpFetchOptions,
} from "./httpCapabilityAdapter";

import {
  resolveHttpRequestAuthHeaders,
} from "./httpAuthenticatedRequest";

/**
 * Creates authenticated fetch options.
 *
 * @param store Secret store.
 * @param request HTTP request.
 * @returns Fetch options or failure.
 *
 * PURE: No side effects.
 */
export function createAuthenticatedFetchOptions(
  store: ApiSecretStore,
  request: HttpCapabilityRequest
):
  | {
      ok: true;
      options: {
        method: HttpMethod;
        body?: string;
        headers?: Record<string, string>;
      };
    }
  | {
      ok: false;
      error: string;
    } {
  const authResult =
    resolveHttpRequestAuthHeaders(
      store,
      request
    );

  if (!authResult.ok) {
    return authResult;
  }

  const options =
    createHttpFetchOptions(
      request
    );

  return {
    ok: true,
    options: {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...authResult.headers,
      },
    },
  };
}
