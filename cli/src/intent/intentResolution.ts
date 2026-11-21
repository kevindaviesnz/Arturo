import type {
  BusinessPatternId,
} from "./businessPattern";

export type IntentType =
  | "create_business"
  | "operate_business"
  | "create_content"
  | "launch_product"
  | "improve_process"
  | "monitor"
  | "support"
  | "unknown";

export type IntentResolution = {
  readonly originalRequest: string;
  readonly normalizedIntent: string;
  readonly intentType: IntentType;
  readonly businessPatternId: BusinessPatternId;
  readonly confidence: number;
  readonly needsClarification: boolean;
  readonly clarificationQuestion?: string;
  readonly reason: string;
};

/**
 * Purpose: Creates a fallback unknown intent resolution.
 *
 * Params:
 * - request: Original user request.
 * - reason: Reason the intent could not be resolved.
 *
 * Returns:
 * - Unknown intent resolution.
 *
 * PURE: No side effects.
 */
export function createUnknownIntentResolution(
  request: string,
  reason: string
): IntentResolution {
  return {
    originalRequest:
      request,
    normalizedIntent:
      "Unknown",
    intentType:
      "unknown",
    businessPatternId:
      "unknown",
    confidence:
      0,
    needsClarification:
      true,
    clarificationQuestion:
      "What are you trying to create, operate, improve, monitor, or support?",
    reason,
  };
}