export type KernelCallEvent = {
  type: string;
  callId?: string;
  capability?: string;
  input?: any;
};

export type AutoDispatchDecision =
  | {
      type: "dispatch";
      callId: string;
      capability: string;
      input: any;
    }
  | {
      type: "human-review";
      callId: string;
      input: any;
    }
  | {
      type: "ignore";
      reason: string;
    };

/**
 * Decides whether a kernel event should be auto-dispatched.
 *
 * @param event Kernel event to inspect.
 * @returns Dispatch decision.
 *
 * PURE: No side effects.
 */
export function createAutoDispatchDecision(
  event: KernelCallEvent
): AutoDispatchDecision {
  if (event.type !== "process:call") {
    return {
      type: "ignore",
      reason: "Event is not a kernel call",
    };
  }

  if (!event.callId) {
    return {
      type: "ignore",
      reason: "Kernel call event has no call id",
    };
  }

  if (!event.capability) {
    return {
      type: "ignore",
      reason: "Kernel call event has no capability",
    };
  }

  if (event.capability === "human-review") {
    return {
      type: "human-review",
      callId: event.callId,
      input: event.input,
    };
  }

  return {
    type: "dispatch",
    callId: event.callId,
    capability: event.capability,
    input: event.input,
  };
}