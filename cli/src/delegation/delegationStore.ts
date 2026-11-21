import {
  type DelegationRequest,
} from "./delegation";

import {
  clearPersistedDelegations,
  loadPersistedDelegations,
  savePersistedDelegation,
} from "../storage/delegationRepository";

const delegations: Record<string, DelegationRequest> = Object.fromEntries(
  loadPersistedDelegations().map((request) => [request.id, request])
);

/**
 * Purpose: Saves a delegation request in memory.
 *
 * Params:
 * - request: Delegation request.
 *
 * Returns:
 * - Saved delegation request.
 *
 * SIDE EFFECT:
 * - Mutates module-level delegation state.
 */
export function saveDelegationRequest(
  request: DelegationRequest
): DelegationRequest {
  delegations[request.id] =
    request;

  savePersistedDelegation(request);

  return request;
}

/**
 * Purpose: Lists delegation requests.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Stored delegation requests.
 *
 * SIDE EFFECT:
 * - Reads module-level delegation state.
 */
export function listDelegationRequests():
  readonly DelegationRequest[] {
  return Object.values(
    delegations
  );
}

/**
 * Purpose: Gets a delegation request by id.
 *
 * Params:
 * - id: Delegation request id.
 *
 * Returns:
 * - Matching request or undefined.
 *
 * SIDE EFFECT:
 * - Reads module-level delegation state.
 */
export function getDelegationRequest(
  id: string
): DelegationRequest | undefined {
  return delegations[id];
}

/**
 * Purpose: Clears delegation requests.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates module-level delegation state.
 */
export function clearDelegationRequests(): void {
  for (const id of Object.keys(
    delegations
  )) {
    delete delegations[id];
  }

  clearPersistedDelegations();
}
