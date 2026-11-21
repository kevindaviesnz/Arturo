export type CapabilityPolicyDecision =
  | {
      type: "allow";
    }
  | {
      type: "deny";
      reason: string;
    }
  | {
      type: "require-approval";
      reason: string;
    };

/**
 * Decides whether a process may request a capability.
 *
 * @param capability Requested capability name.
 * @returns Capability policy decision.
 *
 * PURE: No side effects.
 */
export function decideCapabilityPolicy(
  capability: string
): CapabilityPolicyDecision {
  if (
    capability === "email.send" ||
    capability === "shell.exec" ||
    capability === "file.delete" ||
    capability === "http.get" ||
    capability === "http.post" ||
    capability === "webhook.send"
  ) {
    return {
      type: "require-approval",
      reason:
        `Capability requires approval: ${capability}`,
    };
  }

  if (
    capability.startsWith(
      "admin."
    )
  ) {
    return {
      type: "deny",
      reason:
        `Capability denied: ${capability}`,
    };
  }

  return {
    type: "allow",
  };
}
