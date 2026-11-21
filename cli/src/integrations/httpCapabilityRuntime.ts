import {
  executeHttpCapabilityRequest,
  type HttpCapabilityRequest,
  type HttpCapabilityResult,
  type HttpFetchFunction,
} from "./httpCapabilityAdapter";

/**
 * Executes HTTP capability runtime.
 *
 * @param request HTTP request.
 * @param fetchFn Fetch implementation.
 * @returns HTTP capability result.
 *
 * SIDE EFFECT:
 * Performs HTTP request through supplied fetch function.
 */
export async function executeHttpCapabilityRuntime(
  request: HttpCapabilityRequest,
  fetchFn: HttpFetchFunction
): Promise<HttpCapabilityResult> {
  return executeHttpCapabilityRequest(
    request,
    fetchFn
  );
}