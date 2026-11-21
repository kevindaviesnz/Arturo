/**
 * Deterministic capability call emitted by the kernel.
 */
export type CapabilityCall = {
  callId: string;

  pid: number;

  capability: string;

  input: any;

  createdAt: number;
};

/**
 * Creates a deterministic capability call.
 *
 * @param callId Stable call id.
 * @param pid Source process id.
 * @param capability Requested capability.
 * @param input Capability input payload.
 * @returns Capability call.
 *
 * PURE: No side effects.
 */
export function createCapabilityCall(
  callId: string,
  pid: number,
  capability: string,
  input: any
): CapabilityCall {
  return {
    callId,
    pid,
    capability,
    input,
    createdAt:
      Date.now(),
  };
}