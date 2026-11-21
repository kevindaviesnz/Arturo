import type {
  PendingCall,
} from "./state";

export type KernelCallDispatchDecision =
  | {
      type: "dispatch";
      callId: string;
      capability: string;
      input: any;
    }
  | {
      type: "ignore";
      reason: string;
    };

/**
 * Creates a dispatch decision for a pending kernel call.
 *
 * @param call Pending kernel call to dispatch.
 * @returns Dispatch decision describing how the call should be handled.
 *
 * PURE: No side effects.
 */
export function createKernelCallDispatchDecision(
  call: PendingCall | undefined
): KernelCallDispatchDecision {
  if (!call) {
    return {
      type: "ignore",
      reason: "No pending call provided",
    };
  }

  return {
    type: "dispatch",
    callId: call.callId,
    capability: call.capability,
    input: call.input,
  };
}

/**
 * Lists dispatchable pending kernel calls.
 *
 * @param pendingCalls Pending call record from kernel state.
 * @returns Dispatch decisions for each pending call.
 *
 * PURE: No side effects.
 */
export function listKernelCallDispatchDecisions(
  pendingCalls: Record<
    string,
    PendingCall
  >
): KernelCallDispatchDecision[] {
  return Object.values(
    pendingCalls
  ).map(
    createKernelCallDispatchDecision
  );
}