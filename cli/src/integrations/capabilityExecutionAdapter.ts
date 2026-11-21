import type {
  HttpFetchFunction,
} from "./httpCapabilityAdapter";

import {
  createHttpGetRequest,
  createHttpPostRequest,
} from "./httpCapabilityAdapter";

import {
  executeHttpCapabilityRuntime,
} from "./httpCapabilityRuntime";

export type CapabilityExecutionInput =
  Record<string, unknown>;

export type CapabilityExecutionResult =
  unknown;

export type CapabilityExecutionAdapter = (
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
) => Promise<CapabilityExecutionResult>;

/**
 * Executes http.get capability.
 *
 * @param input Capability input.
 * @param fetchFn Fetch implementation.
 * @returns Capability execution result.
 *
 * SIDE EFFECT:
 * Performs HTTP request through supplied fetch function.
 */
export async function executeHttpGetCapability(
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
): Promise<CapabilityExecutionResult> {
  return executeHttpCapabilityRuntime(
    createHttpGetRequest(
      String(input.url),
      Number(input.timeoutMs)
    ),
    fetchFn
  );
}

/**
 * Executes http.post capability.
 *
 * @param input Capability input.
 * @param fetchFn Fetch implementation.
 * @returns Capability execution result.
 *
 * SIDE EFFECT:
 * Performs HTTP request through supplied fetch function.
 */
export async function executeHttpPostCapability(
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
): Promise<CapabilityExecutionResult> {
  return executeHttpCapabilityRuntime(
    createHttpPostRequest(
      String(input.url),
      input.body,
      Number(input.timeoutMs)
    ),
    fetchFn
  );
}

/**
 * Executes webhook.send capability.
 *
 * @param input Capability input.
 * @param fetchFn Fetch implementation.
 * @returns Capability execution result.
 *
 * SIDE EFFECT:
 * Performs HTTP POST request through supplied fetch function.
 */
export async function executeWebhookSendCapability(
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
): Promise<CapabilityExecutionResult> {
  return executeHttpCapabilityRuntime(
    createHttpPostRequest(
      String(input.url),
      input.payload,
      Number(input.timeoutMs)
    ),
    fetchFn
  );
}

export const capabilityExecutionAdapters:
  Record<string, CapabilityExecutionAdapter> = {
    "http.get":
      executeHttpGetCapability,

    "http.post":
      executeHttpPostCapability,

    "webhook.send":
      executeWebhookSendCapability,
  };