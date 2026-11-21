import type {
  ApiSecretStore,
} from "./apiSecretStore";

import type {
  ApiRetryPolicy,
} from "./apiRetryPolicy";

import type {
  HttpCapabilityRequest,
  HttpCapabilityResult,
  HttpFetchFunction,
  HttpHostnameResolver,
} from "./httpCapabilityAdapter";

import { executeBoundedHttpRequest } from "./httpCapabilityAdapter";
import { createAuthenticatedFetchOptions } from "./httpAuthenticatedFetchOptions";

/**
 * Executes authenticated HTTP request.
 *
 * @param store Secret store.
 * @param request HTTP request.
 * @param fetchFn Fetch implementation.
 * @param retryPolicy Optional retry policy.
 * @returns HTTP capability result.
 *
 * SIDE EFFECT:
 * Performs HTTP request.
 */
export async function executeAuthenticatedHttpRequest(
  store: ApiSecretStore,
  request: HttpCapabilityRequest,
  fetchFn: HttpFetchFunction,
  retryPolicy?: ApiRetryPolicy,
  resolver?: HttpHostnameResolver
): Promise<HttpCapabilityResult> {
  return executeBoundedHttpRequest(
    request, fetchFn, resolver,
    () => createAuthenticatedFetchOptions(store, request),
    retryPolicy
  );
}
