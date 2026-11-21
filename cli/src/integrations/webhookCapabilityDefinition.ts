import {
  createCapabilityDefinition,
} from "../kernel/capabilityDefinition";

import {
  createCapabilitySchema,
  createObjectCapabilitySchema,
} from "../kernel/capabilitySchema";

export const webhookCapabilityDefinition =
  createCapabilityDefinition({
    id: "webhook.send",
    description:
      "Sends an outbound webhook.",
    riskLevel: "medium",
    requiresApproval: true,
    timeoutMs: 30000,
    version: "1.0.0",
    inputSchema:
      createObjectCapabilitySchema({
        url:
          createCapabilitySchema(
            "string"
          ),
        payload:
          createCapabilitySchema(
            "any"
          ),
        timeoutMs:
          createCapabilitySchema(
            "number"
          ),
      }),
    outputSchema:
      createCapabilitySchema("any"),
  });
