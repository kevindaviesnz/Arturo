import type {
  Worker,
} from "../control/workers";

import {
  assertWorkerCapability,
} from "../control/workers";

import type {
  HttpFetchFunction,
} from "./httpCapabilityAdapter";

import {
  capabilityExecutionAdapters,
  type CapabilityExecutionInput,
  type CapabilityExecutionResult,
} from "./capabilityExecutionAdapter";

import { getRequiredWorkerCapabilityForExecution } from "../capabilities/capabilityCatalog";
export { getRequiredWorkerCapabilityForExecution } from "../capabilities/capabilityCatalog";

/**
 * Dispatches capability execution without worker capability enforcement.
 *
 * This lower-level function is intended for tests, trusted system paths,
 * and adapter-level execution only. User/worker-triggered execution should
 * use dispatchCapabilityExecutionForWorker.
 *
 * @param capabilityId Capability identifier.
 * @param input Capability input.
 * @param fetchFn Fetch implementation.
 * @returns Capability execution result.
 *
 * SIDE EFFECT:
 * May execute external capability.
 */
export async function dispatchCapabilityExecution(
  capabilityId: string,
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
): Promise<CapabilityExecutionResult> {
  const adapter =
    capabilityExecutionAdapters[
      capabilityId
    ];

  if (!adapter) {
    throw new Error(
      `No execution adapter registered for capability '${capabilityId}'`
    );
  }

  return adapter(
    input,
    fetchFn
  );
}

/**
 * Dispatches capability execution for a worker after enforcing capability authority.
 *
 * @param worker Worker attempting the capability execution.
 * @param capabilityId Capability identifier.
 * @param input Capability input.
 * @param fetchFn Fetch implementation.
 * @returns Capability execution result.
 *
 * SIDE EFFECT:
 * May execute external capability after worker capability validation.
 */
export async function dispatchCapabilityExecutionForWorker(
  worker: Worker<any, any>,
  capabilityId: string,
  input: CapabilityExecutionInput,
  fetchFn: HttpFetchFunction
): Promise<CapabilityExecutionResult> {
  const requiredCapability =
    getRequiredWorkerCapabilityForExecution(
      capabilityId
    );

  if (!requiredCapability) {
    throw new Error(
      `No worker capability mapping registered for capability '${capabilityId}'`
    );
  }

  assertWorkerCapability(
    worker,
    requiredCapability
  );

  return dispatchCapabilityExecution(
    capabilityId,
    input,
    fetchFn
  );
}