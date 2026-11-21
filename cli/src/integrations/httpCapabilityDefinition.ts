import { builtInCapabilityRegistry } from "../kernel/builtInCapabilities";
import type {
  CapabilityDefinition,
} from "../kernel/capabilityDefinition";

import {
  createCapabilitySchema,
  createObjectCapabilitySchema,
} from "../kernel/capabilitySchema";

/**
 * Creates HTTP GET capability definition.
 *
 * @returns Capability definition for HTTP GET.
 *
 * PURE: No side effects.
 */
export function createHttpGetCapabilityDefinition():
  CapabilityDefinition {
  return {
    id: "http.get",
    description:
      "Perform an HTTPS GET request and parse a JSON response",
    riskLevel: builtInCapabilityRegistry["http.get"].riskLevel,
    requiresApproval: builtInCapabilityRegistry["http.get"].requiresApproval,
    timeoutMs: builtInCapabilityRegistry["http.get"].timeoutMs,
    version: "1.0.0",
    inputSchema:
      createObjectCapabilitySchema({
        url:
          createCapabilitySchema(
            "string"
          ),
        timeoutMs:
          createCapabilitySchema(
            "number"
          ),
      }),
    outputSchema:
      createObjectCapabilitySchema({
        ok:
          createCapabilitySchema(
            "boolean"
          ),
      }),
  };
}